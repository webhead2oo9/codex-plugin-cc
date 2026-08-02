# Codex Prompt Anti-Patterns

Avoid these when prompting Codex or GPT-5.6.

## Prescribing the path instead of the outcome

Bad:

```text
First list every file, then make a plan, then inspect one file at a time, then ask before editing.
```

Better:

```xml
<task>
Fix the failing behavior while preserving the surrounding contract.
</task>
<success_criteria>
Reproduce the failure, apply the narrow fix, and verify the changed path.
</success_criteria>
```

## Repeating or contradicting rules

Bad:

```text
Keep going without asking. Ask before every action. Be autonomous. Always wait for approval.
```

Better: define one autonomy boundary once, distinguishing safe local work from external, destructive, or irreversible actions.

## Vague completion

Bad:

```text
Investigate this and report back.
```

Better:

```xml
<success_criteria>
Identify one evidence-backed root cause or return the exact missing evidence needed to distinguish the remaining causes.
</success_criteria>
```

## Universal tool rules

Bad:

```text
Always search three times. Always use every available tool. Never use parallel calls.
```

Better: route by task shape. Parallelize independent reads, keep dependent work sequential, and use a fallback only when required evidence is missing or suspiciously narrow.

## More reasoning instead of a better contract

Bad:

```text
Think harder and use maximum effort.
```

Better: add the missing success criterion, evidence requirement, tool-routing rule, or verification check. Raise reasoning effort only when representative evaluations show a material gain.

## Unsupported certainty

Bad:

```text
Tell me exactly why production failed, even if the logs are incomplete.
```

Better:

```xml
<grounding>
Separate observed facts from inference. Narrow the conclusion or name missing evidence instead of guessing.
</grounding>
```

## Routine narration

Bad:

```text
Explain every tool call and keep sending status updates.
```

Better: request one brief preamble for long work and updates only at major phase changes or when evidence changes the plan.

## Unmeasured prompt rewrites

Bad: replace the model, prompt, tool set, and reasoning effort in one release.

Better: preserve the current baseline, make one surgical change, and rerun the same representative cases so behavior changes remain attributable.
