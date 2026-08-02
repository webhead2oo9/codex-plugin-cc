# Changelog

## 1.1.0 - 2026-08-01

- Run rescue turns as recoverable background jobs with bounded status waits.
- Use isolated app-server processes by default and bound request, idle, and total-runtime stalls.
- Reconcile dead workers, recover abandoned locks, and serialize state writes with locked atomic replacement.
- Make Windows process-tree cancellation argument-safe and tolerate partial `taskkill` exits.
- Update rescue prompt guidance for GPT-5.6 and expose `medium`, `high`, `xhigh`, `max`, and `ultra` effort controls.

## 1.0.0

- Initial version of the Codex plugin for Claude Code
