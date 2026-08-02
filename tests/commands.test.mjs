import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "codex");

function read(relativePath) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("review command uses AskUserQuestion and background Bash while staying review-only", () => {
  const source = read("commands/review.md");
  assert.match(source, /AskUserQuestion/);
  assert.match(source, /\bBash\(/);
  assert.match(source, /Do not fix issues/i);
  assert.match(source, /review-only/i);
  assert.match(source, /return Codex's output verbatim to the user/i);
  assert.match(source, /```bash/);
  assert.match(source, /```typescript/);
  assert.match(source, /review "\$ARGUMENTS"/);
  assert.match(source, /\[--scope auto\|working-tree\|branch\]/);
  assert.match(source, /run_in_background:\s*true/);
  assert.match(source, /command:\s*`node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/codex-companion\.mjs" review "\$ARGUMENTS"`/);
  assert.match(source, /description:\s*"Codex review"/);
  assert.match(source, /Do not call `BashOutput`/);
  assert.match(source, /Return the command stdout verbatim, exactly as-is/i);
  assert.match(source, /git status --short --untracked-files=all/);
  assert.match(source, /git diff --shortstat/);
  assert.match(source, /Treat untracked files or directories as reviewable work/i);
  assert.match(source, /Recommend waiting only when the review is clearly tiny, roughly 1-2 files total/i);
  assert.match(source, /In every other case, including unclear size, recommend background/i);
  assert.match(source, /The companion script parses `--wait` and `--background`/i);
  assert.match(source, /Claude Code's `Bash\(..., run_in_background: true\)` is what actually detaches the run/i);
  assert.match(source, /When in doubt, run the review/i);
  assert.match(source, /\(Recommended\)/);
  assert.match(source, /does not support staged-only review, unstaged-only review, or extra focus text/i);
});

test("adversarial review command uses AskUserQuestion and background Bash while staying review-only", () => {
  const source = read("commands/adversarial-review.md");
  assert.match(source, /AskUserQuestion/);
  assert.match(source, /\bBash\(/);
  assert.match(source, /Do not fix issues/i);
  assert.match(source, /review-only/i);
  assert.match(source, /return Codex's output verbatim to the user/i);
  assert.match(source, /```bash/);
  assert.match(source, /```typescript/);
  assert.match(source, /adversarial-review "\$ARGUMENTS"/);
  assert.match(source, /\[--scope auto\|working-tree\|branch\] \[focus \.\.\.\]/);
  assert.match(source, /run_in_background:\s*true/);
  assert.match(source, /command:\s*`node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/codex-companion\.mjs" adversarial-review "\$ARGUMENTS"`/);
  assert.match(source, /description:\s*"Codex adversarial review"/);
  assert.match(source, /Do not call `BashOutput`/);
  assert.match(source, /Return the command stdout verbatim, exactly as-is/i);
  assert.match(source, /git status --short --untracked-files=all/);
  assert.match(source, /git diff --shortstat/);
  assert.match(source, /Treat untracked files or directories as reviewable work/i);
  assert.match(source, /Recommend waiting only when the scoped review is clearly tiny, roughly 1-2 files total/i);
  assert.match(source, /In every other case, including unclear size, recommend background/i);
  assert.match(source, /The companion script parses `--wait` and `--background`/i);
  assert.match(source, /Claude Code's `Bash\(..., run_in_background: true\)` is what actually detaches the run/i);
  assert.match(source, /When in doubt, run the review/i);
  assert.match(source, /\(Recommended\)/);
  assert.match(source, /uses the same review target selection as `\/codex:review`/i);
  assert.match(source, /supports working-tree review, branch review, and `--base <ref>`/i);
  assert.match(source, /does not support `--scope staged` or `--scope unstaged`/i);
  assert.match(source, /can still take extra focus text after the flags/i);
});

test("continue is not exposed as a user-facing command", () => {
  const commandFiles = fs.readdirSync(path.join(PLUGIN_ROOT, "commands")).sort();
  assert.deepEqual(commandFiles, [
    "adversarial-review.md",
    "cancel.md",
    "rescue.md",
    "result.md",
    "review.md",
    "setup.md",
    "status.md",
    "transfer.md"
  ]);
});

test("rescue command uses recoverable monitored jobs", () => {
  const rescue = read("commands/rescue.md");
  const agent = read("agents/codex-rescue.md");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const runtimeSkill = read("skills/codex-cli-runtime/SKILL.md");

  assert.match(rescue, /allowed-tools:\s*Bash\(node:\*\),\s*AskUserQuestion,\s*Agent/);
  assert.match(rescue, /subagent_type: "codex:codex-rescue"/);
  assert.match(rescue, /Do not call `Skill\(codex:codex-rescue\)`/i);
  assert.doesNotMatch(rescue, /^context:\s*fork\b/m);
  assert.match(rescue, /--background\|--wait/);
  assert.match(rescue, /--resume\|--fresh/);
  assert.match(rescue, /--model <model\|spark>/);
  assert.match(rescue, /--effort <medium\|high\|xhigh\|max\|ultra>/);
  assert.match(rescue, /task-resume-candidate --json/);
  assert.match(rescue, /Continue current Codex thread/);
  assert.match(rescue, /Start a new Codex thread/);
  assert.match(rescue, /Always run the rescue subagent in the foreground/i);
  assert.match(rescue, /`--background` means the companion job is launched and returned immediately/i);
  assert.match(rescue, /same monitored mode as `--wait`/i);
  assert.match(rescue, /launch tasks through `task --background`/i);
  assert.match(rescue, /bounded `status --wait` calls/i);
  assert.match(rescue, /retrieves `result`/i);
  assert.match(rescue, /Return the subagent output unchanged/i);

  assert.match(agent, /monitored bridge/i);
  assert.match(agent, /gpt-5-6-prompting/);
  assert.match(agent, /task --background --json/i);
  assert.match(agent, /status <job-id> --wait --timeout-ms 90000 --json/i);
  assert.match(agent, /result <job-id>/i);
  assert.match(agent, /Never run the Codex task in one foreground Bash call/i);
  assert.match(agent, /never use a shell polling loop/i);
  assert.match(agent, /gpt-5\.6-sol/);
  assert.match(agent, /`medium`, `high`, `xhigh`, `max`, and `ultra`/i);
  assert.match(agent, /Do not inspect the repository/i);
  assert.match(agent, /return its stdout unchanged/i);

  assert.match(runtimeSkill, /task --background --json/);
  assert.match(runtimeSkill, /status <job-id> --wait --timeout-ms 90000 --json/);
  assert.match(runtimeSkill, /result <job-id>/);
  assert.match(runtimeSkill, /Each wait is deliberately bounded/i);
  assert.match(runtimeSkill, /Never run the Codex turn inside one long Bash call/i);
  assert.match(runtimeSkill, /Never use shell polling loops/i);
  assert.match(runtimeSkill, /gpt-5-6-prompting/);
  assert.match(runtimeSkill, /Accepted effort values are `medium`, `high`, `xhigh`, `max`, and `ultra`/i);
  assert.match(runtimeSkill, /return the error and the job ID/i);

  assert.match(readme, /`codex:codex-rescue` subagent/i);
  assert.match(readme, /recoverable background job/i);
  assert.match(readme, /if you do not pass `--model` or `--effort`, Codex chooses its own defaults/i);
  assert.match(readme, /--model gpt-5\.6-sol --effort medium/i);
  assert.match(readme, /`spark`, the plugin maps that to `gpt-5\.3-codex-spark`/i);
  assert.match(readme, /continue a previous Codex task/i);
  assert.match(readme, /### `\/codex:setup`/);
  assert.match(readme, /### `\/codex:review`/);
  assert.match(readme, /### `\/codex:adversarial-review`/);
  assert.match(readme, /### `\/codex:rescue`/);
  assert.match(readme, /### `\/codex:transfer`/);
  assert.match(readme, /### `\/codex:status`/);
  assert.match(readme, /### `\/codex:result`/);
  assert.match(readme, /### `\/codex:cancel`/);
});

test("transfer, result, and cancel commands are exposed as deterministic runtime entrypoints", () => {
  const transfer = read("commands/transfer.md");
  const result = read("commands/result.md");
  const cancel = read("commands/cancel.md");
  const resultHandling = read("skills/codex-result-handling/SKILL.md");

  assert.match(transfer, /disable-model-invocation:\s*true/);
  assert.match(transfer, /codex-companion\.mjs" transfer "\$ARGUMENTS"/);
  assert.match(transfer, /codex resume <session-id>/);
  assert.match(result, /disable-model-invocation:\s*true/);
  assert.match(result, /codex-companion\.mjs" result "\$ARGUMENTS"/);
  assert.match(cancel, /disable-model-invocation:\s*true/);
  assert.match(cancel, /codex-companion\.mjs" cancel "\$ARGUMENTS"/);
  assert.match(resultHandling, /do not turn a failed or incomplete Codex run into a Claude-side implementation attempt/i);
  assert.match(resultHandling, /if Codex was never successfully invoked, do not generate a substitute answer at all/i);
});

test("internal docs use GPT-5.6 outcome-first prompting for rescue jobs", () => {
  const runtimeSkill = read("skills/codex-cli-runtime/SKILL.md");
  const promptingSkill = read("skills/gpt-5-6-prompting/SKILL.md");
  const promptRecipes = read("skills/gpt-5-6-prompting/references/codex-prompt-recipes.md");

  assert.match(runtimeSkill, /Use `task` for diagnosis, planning, research, implementation, and explicit fixes/i);
  assert.match(runtimeSkill, /--resume-last/);
  assert.match(promptingSkill, /GPT-5\.6 works best when a prompt defines the outcome/i);
  assert.match(promptingSkill, /Keep the prompt lean/i);
  assert.match(promptingSkill, /<success_criteria>/);
  assert.match(promptingSkill, /Reserve `high`, `xhigh`, `max`, or `ultra`/i);
  assert.match(promptRecipes, /Codex or GPT-5\.6 task prompts/i);
  assert.match(promptRecipes, /## Diagnosis/);
  assert.match(promptRecipes, /## Narrow fix/);
  assert.match(promptRecipes, /## Prompt patching/);
});

test("hooks keep session-end cleanup and stop gating enabled", () => {
  const source = read("hooks/hooks.json");
  assert.match(source, /SessionStart/);
  assert.match(source, /SessionEnd/);
  assert.match(source, /stop-review-gate-hook\.mjs/);
  assert.match(source, /session-lifecycle-hook\.mjs/);
});

test("setup command can offer Codex install and still points users to codex login", () => {
  const setup = read("commands/setup.md");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  assert.match(setup, /argument-hint:\s*'\[--enable-review-gate\|--disable-review-gate\]'/);
  assert.match(setup, /AskUserQuestion/);
  assert.match(setup, /npm install -g @openai\/codex/);
  assert.match(setup, /codex-companion\.mjs" setup --json \$ARGUMENTS/);
  assert.match(readme, /!codex login/);
  assert.match(readme, /offer to install Codex for you/i);
  assert.match(readme, /\/codex:setup --enable-review-gate/);
  assert.match(readme, /\/codex:setup --disable-review-gate/);
});
