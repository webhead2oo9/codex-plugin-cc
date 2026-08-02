---
description: Delegate substantial investigation, implementation, or follow-up work to a monitored Codex rescue job
argument-hint: "[--background|--wait] [--resume|--fresh] [--model <model|spark>] [--effort <medium|high|xhigh|max|ultra>] [what Codex should investigate, solve, or continue]"
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `codex:codex-rescue` subagent with the `Agent` tool (`subagent_type: "codex:codex-rescue"`), forwarding the resolved raw request as its prompt.
`codex:codex-rescue` is a subagent, not a skill. Do not call `Skill(codex:codex-rescue)` or re-enter this command.

Raw user request:
$ARGUMENTS

Execution mode:
- Always run the rescue subagent in the foreground so it can return either the final Codex result or a recoverable background job ID.
- `--background` means the companion job is launched and returned immediately; it does not background the Claude subagent.
- `--wait` means launch a recoverable companion background job and monitor it through bounded status calls.
- If neither flag is present, use the same monitored mode as `--wait`.
- Preserve execution, model, effort, and thread-routing flags for the subagent. It strips them from the natural-language task.

Thread routing:
- If the request includes `--resume` or `--fresh`, honor it without asking.
- Otherwise check for a resumable rescue thread from this Claude session:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task-resume-candidate --json
```

- If `available` is false, route normally.
- If `available` is true, ask once:
  - `Continue current Codex thread`
  - `Start a new Codex thread`
- Put `Continue current Codex thread (Recommended)` first for a clear follow-up such as “continue,” “keep going,” “resume,” “apply the top fix,” or “dig deeper.”
- Otherwise put `Start a new Codex thread (Recommended)` first.
- Add `--resume` or `--fresh` to the forwarded request according to the choice.

Operating rules:
- The subagent must launch tasks through `task --background`; it must never hold one long foreground Bash call open for the Codex turn.
- In monitored mode it polls with bounded `status --wait` calls, then retrieves `result`.
- Return the subagent output unchanged. Do not paraphrase, summarize, or add commentary.
- Leave model and effort unset unless the user selected them. Map `spark` to `gpt-5.3-codex-spark`.
- If launch, monitoring, or retrieval fails, preserve the actionable error and job ID.
- If the helper reports missing Codex support or authentication, tell the user to run `/codex:setup`.
- If the user supplied no task, ask what Codex should investigate or fix.
