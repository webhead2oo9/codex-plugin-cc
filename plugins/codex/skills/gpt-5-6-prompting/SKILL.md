---
name: gpt-5-6-prompting
description: Internal guidance for composing lean, outcome-first Codex and GPT-5.6 prompts for coding, review, diagnosis, and research
user-invocable: false
---

# GPT-5.6 Prompting

Use this skill when `codex:codex-rescue` needs to shape a task for Codex or another GPT-5.6 workflow.

GPT-5.6 works best when a prompt defines the outcome, material context and constraints, available evidence, completion bar, and stopping conditions, then leaves the model room to choose an efficient path.

Core rules:
- Start with the user-visible outcome and what must be true before the run is done.
- Keep the prompt lean. State each instruction once; remove repeated rules, examples that do not change behavior, and irrelevant process detail.
- Describe the destination instead of prescribing every step. Reserve `must`, `never`, and `only` for real invariants.
- Preserve the user's values and intent. Use decision rules for judgment calls instead of keyword maps or broad defaults.
- Define evidence, verification, output shape, and retry or abstention rules only when they matter to the task.
- Prefer a better success criterion or tool-routing rule over more reasoning effort.

Default prompt shape:
- `<task>`: the concrete outcome and relevant repository or failure context.
- `<success_criteria>`: observable conditions that make the task complete.
- `<constraints>`: only the safety, scope, evidence, and side-effect boundaries that can change behavior.
- `<output>`: required structure, ordering, and material content.
- `<stop_rules>`: when to retry, use a fallback, ask for missing context, or stop.

Add only when needed:
- Coding or debugging: targeted verification and missing-context rules.
- Review: materiality, grounding, severity ordering, and a no-findings outcome.
- Research: primary-source preference, citation requirements, and explicit inference labels.
- Write-capable work: a compact autonomy boundary that permits in-scope local edits and validation while forbidding unrelated or destructive work.
- Long-running work: sparse outcome-based updates at major phase changes, not narration of routine tool calls.

Reasoning and model controls:
- Leave the model and effort unset unless the user chooses them.
- Preserve the current supported effort as the migration baseline before escalating.
- Use `medium` as the balanced starting point when an explicit choice is required.
- Reserve `high`, `xhigh`, `max`, or `ultra` for measured gains on difficult work; `ultra` also enables automatic task delegation.
- If the prompt is underperforming, first check for contradictions, missing success criteria, weak tool routing, or a missing verification loop.

Prompt assembly checklist:
1. State one task and its expected end state.
2. Add the smallest success criteria and output contract that make completion testable.
3. Add only constraints that prevent a concrete failure.
4. Define the smallest useful fallback for missing evidence or transient failure.
5. Remove redundant instructions before sending the prompt.

Reusable blocks live in [references/prompt-blocks.md](references/prompt-blocks.md).
Concrete templates live in [references/codex-prompt-recipes.md](references/codex-prompt-recipes.md).
Common failure modes live in [references/codex-prompt-antipatterns.md](references/codex-prompt-antipatterns.md).

Primary guidance:
- [Prompting guidance for GPT-5.6 Sol](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)
- [Using GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
