import fs from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { makeTempDir } from "./helpers.mjs";
import { resolveJobFile, resolveJobLogFile, resolveStateDir, resolveStateFile, saveState } from "../plugins/codex/scripts/lib/state.mjs";
const STATE_MODULE_URL = new URL("../plugins/codex/scripts/lib/state.mjs", import.meta.url).href;

function runStateWriter(workspace, prefix, count) {
  const script = `
    const [workspace, prefix, count] = process.argv.slice(1);
    const { upsertJob } = await import(${JSON.stringify(STATE_MODULE_URL)});
    for (let index = 0; index < Number(count); index += 1) {
      upsertJob(workspace, {
        id: prefix + "-" + index,
        status: "completed",
        createdAt: new Date().toISOString()
      });
    }
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, workspace, prefix, String(count)], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`state writer exited ${code}: ${stderr}`));
    });
  });
}


test("saveState recovers a lock left by an exited process", async () => {
  const workspace = makeTempDir();
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });

  const stateDir = resolveStateDir(workspace);
  fs.mkdirSync(stateDir, { recursive: true });
  const lockFile = path.join(stateDir, "state.lock");
  fs.writeFileSync(lockFile, `${child.pid} ${Date.now()}\n`, "utf8");

  saveState(workspace, {
    version: 1,
    config: { stopReviewGate: false },
    jobs: []
  });

  assert.equal(fs.existsSync(lockFile), false);
  assert.equal(fs.existsSync(resolveStateFile(workspace)), true);
});

test("resolveStateDir uses a temp-backed per-workspace directory", () => {
  const workspace = makeTempDir();
  const stateDir = resolveStateDir(workspace);

  assert.equal(stateDir.startsWith(os.tmpdir()), true);
  assert.match(path.basename(stateDir), /.+-[a-f0-9]{16}$/);
  assert.match(stateDir, new RegExp(`^${os.tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("resolveStateDir uses CLAUDE_PLUGIN_DATA when it is provided", () => {
  const workspace = makeTempDir();
  const pluginDataDir = makeTempDir();
  const previousPluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
  process.env.CLAUDE_PLUGIN_DATA = pluginDataDir;

  try {
    const stateDir = resolveStateDir(workspace);

    assert.equal(stateDir.startsWith(path.join(pluginDataDir, "state")), true);
    assert.match(path.basename(stateDir), /.+-[a-f0-9]{16}$/);
    assert.match(
      stateDir,
      new RegExp(`^${path.join(pluginDataDir, "state").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    );
  } finally {
    if (previousPluginDataDir == null) {
      delete process.env.CLAUDE_PLUGIN_DATA;
    } else {
      process.env.CLAUDE_PLUGIN_DATA = previousPluginDataDir;
    }
  }
});

test("saveState prunes dropped job artifacts when indexed jobs exceed the cap", () => {
  const workspace = makeTempDir();
  const stateFile = resolveStateFile(workspace);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });

  const jobs = Array.from({ length: 51 }, (_, index) => {
    const jobId = `job-${index}`;
    const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString();
    const logFile = resolveJobLogFile(workspace, jobId);
    const jobFile = resolveJobFile(workspace, jobId);
    fs.writeFileSync(logFile, `log ${jobId}\n`, "utf8");
    fs.writeFileSync(jobFile, JSON.stringify({ id: jobId, status: "completed" }, null, 2), "utf8");
    return {
      id: jobId,
      status: "completed",
      logFile,
      updatedAt,
      createdAt: updatedAt
    };
  });

  fs.writeFileSync(
    stateFile,
    `${JSON.stringify(
      {
        version: 1,
        config: { stopReviewGate: false },
        jobs
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  saveState(workspace, {
    version: 1,
    config: { stopReviewGate: false },
    jobs
  });

  const prunedJobFile = resolveJobFile(workspace, "job-0");
  const prunedLogFile = resolveJobLogFile(workspace, "job-0");
  const retainedJobFile = resolveJobFile(workspace, "job-50");
  const retainedLogFile = resolveJobLogFile(workspace, "job-50");
  const jobsDir = path.dirname(prunedJobFile);

  assert.equal(fs.existsSync(retainedJobFile), true);
  assert.equal(fs.existsSync(retainedLogFile), true);

  const savedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(savedState.jobs.length, 50);
  assert.deepEqual(
    savedState.jobs.map((job) => job.id),
    Array.from({ length: 50 }, (_, index) => `job-${50 - index}`)
  );
  assert.deepEqual(
    fs.readdirSync(jobsDir).sort(),
    Array.from({ length: 50 }, (_, index) => `job-${index + 1}`)
      .flatMap((jobId) => [`${jobId}.json`, `${jobId}.log`])
      .sort()
  );
});

test("concurrent state writers preserve every job and valid JSON", async () => {
  const workspace = makeTempDir();
  const writerCount = 6;
  const jobsPerWriter = 5;

  await Promise.all(
    Array.from({ length: writerCount }, (_, index) => runStateWriter(workspace, `writer-${index}`, jobsPerWriter))
  );

  const stateFile = resolveStateFile(workspace);
  const savedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const actualIds = savedState.jobs.map((job) => job.id).sort();
  const expectedIds = Array.from({ length: writerCount }, (_, writerIndex) =>
    Array.from({ length: jobsPerWriter }, (_, jobIndex) => `writer-${writerIndex}-${jobIndex}`)
  )
    .flat()
    .sort();

  assert.deepEqual(actualIds, expectedIds);
  assert.equal(fs.existsSync(path.join(resolveStateDir(workspace), "state.lock")), false);
});
