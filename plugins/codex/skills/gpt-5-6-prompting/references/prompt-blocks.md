# Prompt Blocks

Use these blocks selectively when composing Codex or GPT-5.6 prompts. Copy only the blocks that prevent a concrete failure; do not assemble every block by default.

## Outcome

### `task`

```xml
<task>
Produce [user-visible outcome] from [relevant context].
Preserve [behavior or artifact that must not change].
</task>
```

### `success_criteria`

```xml
<success_criteria>
The task is complete when:
- [observable condition]
- [required validation or evidence]
- [required deliverable]
</success_criteria>
```

## Constraints and autonomy

### `constraints`

```xml
<constraints>
Make requested in-scope local changes and run relevant non-destructive validation without asking first.
Do not perform external writes, destructive actions, or unrelated refactors.
Ask only when missing information changes correctness, safety, or an irreversible action.
</constraints>
```

### `missing_context`

```xml
<missing_context>
Retrieve missing repository facts with the available tools.
If a required fact remains unavailable, name that fact and narrow the result instead of guessing.
</missing_context>
```

## Tools and evidence

### `tool_routing`

```xml
<tool_routing>
Resolve required discovery and validation before acting.
Parallelize independent reads; keep dependent work sequential.
If a result is empty, partial, or suspiciously narrow, try the smallest meaningful fallback.
</tool_routing>
```

### `grounding`

```xml
<grounding>
Ground material claims in inspected repository evidence or retrieved sources.
Label inference separately, state source conflicts, and do not turn missing evidence into a factual “no.”
</grounding>
```

### `research`

```xml
<research>
Prefer primary sources.
Cite only sources actually retrieved, attaching each citation to the claim it supports.
Separate observed facts, reasoned inferences, and open questions.
</research>
```

## Completion

### `verification`

```xml
<verification>
Before finalizing, run the most relevant targeted check for the changed behavior.
If it fails, revise and rerun it. If it cannot run, state why and perform the next-best check.
</verification>
```

### `stop_rules`

```xml
<stop_rules>
Stop when the success criteria are satisfied with the required evidence.
Retry transient failures at most [N] times.
Do not repeat completed work. If a required result is still missing, return a specific blocker.
</stop_rules>
```

## Output and collaboration

### `output`

```xml
<output>
Lead with [conclusion, fix, or findings].
Include [required evidence], [material caveat], and [next action].
Omit introductions, repeated recap, and optional background.
</output>
```

### `progress_updates`

```xml
<progress_updates>
Before a long tool-heavy run, state the first step briefly.
Update only at major phase changes or when a finding changes the plan.
Do not narrate routine tool calls.
</progress_updates>
```
