import test from "node:test";
import assert from "node:assert/strict";

import { terminateProcessTree } from "../plugins/codex/scripts/lib/process.mjs";

test("terminateProcessTree uses taskkill on Windows", () => {
  let captured = null;
  const outcome = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl(command, args, options) {
      captured = { command, args, options };
      return {
        command,
        args,
        status: 0,
        signal: null,
        stdout: "",
        stderr: "",
        error: null
      };
    },
    killImpl() {
      throw new Error("kill fallback should not run");
    }
  });

  assert.deepEqual(captured, {
    command: "taskkill",
    args: ["/PID", "1234", "/T", "/F"],
    options: {
      cwd: undefined,
      env: undefined,
      shell: false
    }
  });
  assert.equal(outcome.delivered, true);
  assert.equal(outcome.method, "taskkill");
});

test("terminateProcessTree treats missing Windows processes as already stopped", () => {
  const outcome = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl(command, args) {
      return {
        command,
        args,
        status: 128,
        signal: null,
        stdout: "ERROR: The process \"1234\" not found.",
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(outcome.attempted, true);
  assert.equal(outcome.method, "taskkill");
  assert.equal(outcome.result.status, 128);
  assert.match(outcome.result.stdout, /not found/i);
});

test("terminateProcessTree accepts a partial taskkill failure after the root exits", () => {
  const outcome = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl(command, args) {
      return {
        command,
        args,
        status: 128,
        signal: null,
        stdout: "",
        stderr: "A child process could not be terminated.",
        error: null
      };
    },
    killImpl(pid, signal) {
      assert.equal(pid, 1234);
      assert.equal(signal, 0);
      const error = new Error("Process already exited");
      error.code = "ESRCH";
      throw error;
    }
  });

  assert.equal(outcome.attempted, true);
  assert.equal(outcome.delivered, true);
  assert.equal(outcome.method, "taskkill");
  assert.equal(outcome.result.status, 128);
});
