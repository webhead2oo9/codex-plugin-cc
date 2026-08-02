import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveWorkspaceRoot } from "./workspace.mjs";

const STATE_VERSION = 1;
const PLUGIN_DATA_ENV = "CLAUDE_PLUGIN_DATA";
const FALLBACK_STATE_ROOT_DIR = path.join(os.tmpdir(), "codex-companion");
const STATE_FILE_NAME = "state.json";
const STATE_LOCK_FILE_NAME = "state.lock";
const JOBS_DIR_NAME = "jobs";
const MAX_JOBS = 50;
const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 30000;
const LOCK_RETRY_MS = 20;
const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4));

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    version: STATE_VERSION,
    config: {
      stopReviewGate: false
    },
    jobs: []
  };
}

function normalizeState(parsed = {}) {
  return {
    ...defaultState(),
    ...parsed,
    config: {
      ...defaultState().config,
      ...(parsed.config ?? {})
    },
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
  };
}

function sleepSync(milliseconds) {
  Atomics.wait(SLEEP_ARRAY, 0, 0, milliseconds);
}

export function resolveStateDir(cwd) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  let canonicalWorkspaceRoot = workspaceRoot;
  try {
    canonicalWorkspaceRoot = fs.realpathSync.native(workspaceRoot);
  } catch {
    canonicalWorkspaceRoot = workspaceRoot;
  }

  const slugSource = path.basename(workspaceRoot) || "workspace";
  const slug = slugSource.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  const hash = createHash("sha256").update(canonicalWorkspaceRoot).digest("hex").slice(0, 16);
  const pluginDataDir = process.env[PLUGIN_DATA_ENV];
  const stateRoot = pluginDataDir ? path.join(pluginDataDir, "state") : FALLBACK_STATE_ROOT_DIR;
  return path.join(stateRoot, `${slug}-${hash}`);
}

export function resolveStateFile(cwd) {
  return path.join(resolveStateDir(cwd), STATE_FILE_NAME);
}

export function resolveJobsDir(cwd) {
  return path.join(resolveStateDir(cwd), JOBS_DIR_NAME);
}

function resolveStateLockFile(cwd) {
  return path.join(resolveStateDir(cwd), STATE_LOCK_FILE_NAME);
}

export function ensureStateDir(cwd) {
  fs.mkdirSync(resolveJobsDir(cwd), { recursive: true });
}

function loadStateUnlocked(cwd) {
  const stateFile = resolveStateFile(cwd);
  if (!fs.existsSync(stateFile)) {
    return defaultState();
  }

  try {
    return normalizeState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return defaultState();
  }
}

export function loadState(cwd) {
  return loadStateUnlocked(cwd);
}

function pruneJobs(jobs) {
  return [...jobs]
    .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")))
    .slice(0, MAX_JOBS);
}

function removeFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function writeFileAtomically(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  try {
    fs.writeFileSync(temporaryFile, content, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryFile, filePath);
  } finally {
    removeFileIfExists(temporaryFile);
  }
}

function readLockOwnerLiveness(lockFile) {
  const [pidText] = fs.readFileSync(lockFile, "utf8").trim().split(/\s+/, 1);
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") {
      return false;
    }
    if (error?.code === "EPERM") {
      return true;
    }
    return null;
  }
}

function acquireStateLock(cwd) {
  ensureStateDir(cwd);
  const lockFile = resolveStateLockFile(cwd);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      const descriptor = fs.openSync(lockFile, "wx");
      fs.writeFileSync(descriptor, `${process.pid} ${Date.now()}\n`, "utf8");
      return () => {
        try {
          fs.closeSync(descriptor);
        } finally {
          removeFileIfExists(lockFile);
        }
      };
    } catch (error) {
      const lockFileExists = fs.existsSync(lockFile);
      if (error?.code !== "EEXIST" && !(error?.code === "EPERM" && lockFileExists)) {
        throw error;
      }

      try {
        if (readLockOwnerLiveness(lockFile) === false) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch (ownerError) {
        if (ownerError?.code === "ENOENT") {
          continue;
        }
        if (ownerError?.code !== "EPERM") {
          throw ownerError;
        }
      }

      try {
        const ageMs = Date.now() - fs.statSync(lockFile).mtimeMs;
        if (ageMs > STALE_LOCK_MS) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch (statError) {
        if (statError?.code === "ENOENT") {
          continue;
        }
        throw statError;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Codex companion state lock: ${lockFile}`);
      }
      sleepSync(LOCK_RETRY_MS);
    }
  }
}

function withStateLock(cwd, callback) {
  const release = acquireStateLock(cwd);
  try {
    return callback();
  } finally {
    release();
  }
}

function saveStateUnlocked(cwd, state) {
  const previousJobs = loadStateUnlocked(cwd).jobs;
  const nextJobs = pruneJobs(state.jobs ?? []);
  const nextState = {
    version: STATE_VERSION,
    config: {
      ...defaultState().config,
      ...(state.config ?? {})
    },
    jobs: nextJobs
  };

  writeFileAtomically(resolveStateFile(cwd), `${JSON.stringify(nextState, null, 2)}\n`);

  const retainedIds = new Set(nextJobs.map((job) => job.id));
  for (const job of previousJobs) {
    if (retainedIds.has(job.id)) {
      continue;
    }
    removeJobFile(resolveJobFile(cwd, job.id));
    removeFileIfExists(job.logFile);
  }

  return nextState;
}

export function saveState(cwd, state) {
  return withStateLock(cwd, () => saveStateUnlocked(cwd, state));
}

export function updateState(cwd, mutate) {
  return withStateLock(cwd, () => {
    const state = loadStateUnlocked(cwd);
    mutate(state);
    return saveStateUnlocked(cwd, state);
  });
}

export function generateJobId(prefix = "job") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function upsertJob(cwd, jobPatch) {
  return updateState(cwd, (state) => {
    const timestamp = nowIso();
    const existingIndex = state.jobs.findIndex((job) => job.id === jobPatch.id);
    if (existingIndex === -1) {
      state.jobs.unshift({
        createdAt: timestamp,
        updatedAt: timestamp,
        ...jobPatch
      });
      return;
    }
    state.jobs[existingIndex] = {
      ...state.jobs[existingIndex],
      ...jobPatch,
      updatedAt: timestamp
    };
  });
}

export function patchActiveJob(cwd, jobId, patch) {
  return updateState(cwd, (state) => {
    const existingIndex = state.jobs.findIndex((job) => job.id === jobId);
    if (existingIndex === -1) {
      return;
    }

    const existing = state.jobs[existingIndex];
    if (existing.status !== "queued" && existing.status !== "running") {
      return;
    }

    state.jobs[existingIndex] = {
      ...existing,
      ...patch,
      updatedAt: nowIso()
    };
  });
}

export function listJobs(cwd) {
  return loadState(cwd).jobs;
}

export function setConfig(cwd, key, value) {
  return updateState(cwd, (state) => {
    state.config = {
      ...state.config,
      [key]: value
    };
  });
}

export function getConfig(cwd) {
  return loadState(cwd).config;
}

export function writeJobFile(cwd, jobId, payload) {
  return withStateLock(cwd, () => {
    const jobFile = resolveJobFile(cwd, jobId);
    writeFileAtomically(jobFile, `${JSON.stringify(payload, null, 2)}\n`);
    return jobFile;
  });
}

export function readJobFile(jobFile) {
  return JSON.parse(fs.readFileSync(jobFile, "utf8"));
}

function removeJobFile(jobFile) {
  removeFileIfExists(jobFile);
}

export function resolveJobLogFile(cwd, jobId) {
  ensureStateDir(cwd);
  return path.join(resolveJobsDir(cwd), `${jobId}.log`);
}

export function resolveJobFile(cwd, jobId) {
  ensureStateDir(cwd);
  return path.join(resolveJobsDir(cwd), `${jobId}.json`);
}
