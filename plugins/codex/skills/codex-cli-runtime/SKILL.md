---
name: codex-cli-runtime
description: Internal monitored-job contract for calling the Codex companion runtime from Claude Code
user-invocable: false
---

# Codex Runtime

Use this skill only inside the `codex:codex-rescue` subagent.

Helpers:
- Launch: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task --background --json [task options] "<prompt>"`
- Wait: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" status <job-id> --wait --timeout-ms 90000 --json`
- Result: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" result <job-id>`

Monitored execution:
1. Launch every foreground or `--wait` rescue through `task --background --json`. Never run the Codex turn inside one long Bash call.
2. Read the returned `jobId`.
3. Call `status <job-id> --wait --timeout-ms 90000 --json`.
4. If the status is still `queued` or `running`, repeat step 3. Each wait is deliberately bounded so Claude Code never owns one unbounded shell call.
5. When the status is `completed`, `failed`, or `cancelled`, call `result <job-id>` and return that stdout unchanged.

Explicit background execution:
- If the forwarded request includes `--background`, run `task --background` once and return its stdout unchanged. Do not poll.
- `--background` is execution control. Strip it from the task text.
- `--wait` selects monitored execution and is also stripped from the task text.

Task construction:
- Use `task` for diagnosis, planning, research, implementation, and explicit fixes.
- Prefer the helper over hand-rolled Git, direct Codex CLI commands, or repository inspection.
- You may use `gpt-5-6-prompting` only to turn the request into a lean outcome-first prompt. Do not solve the task or inspect files yourself.
- Default to `--write` unless the user explicitly asks for read-only work or only requests review, diagnosis, planning, or research.
- Leave model and effort unset unless the user explicitly chooses them.
- Map `spark` to `--model gpt-5.3-codex-spark`.
- Accepted effort values are `medium`, `high`, `xhigh`, `max`, and `ultra`.

Thread routing:
- Strip `--resume` from the task text and add `--resume-last`.
- Strip `--fresh` from the task text and start a fresh task.
- If the request clearly continues prior Codex work, add `--resume-last` unless `--fresh` is present.
- Otherwise start a fresh task.

Safety and failure handling:
- Preserve the user's task text apart from routing and runtime flags.
- Do not inspect the repository, read files, grep, run reviews, summarize Codex output, or perform follow-up implementation yourself.
- Never use shell polling loops. Make one bounded helper call at a time so each result remains visible and recoverable.
- If launch fails, return the actionable helper error.
- If a wait or result call fails, return the error and the job ID so `/codex:status <job-id>` can recover the run.
- Do not turn an incomplete Codex run into a Claude-side implementation attempt.
