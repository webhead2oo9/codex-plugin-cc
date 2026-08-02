# Codex Prompt Recipes

Use these as starting points for Codex or GPT-5.6 task prompts. Copy the smallest recipe that fits, replace the brackets, and delete any line that does not change behavior.

## Diagnosis

```xml
<task>
Diagnose [failure] in this repository and identify the root cause supported by repository or runtime evidence.
</task>

<success_criteria>
- Reproduce or otherwise observe the failure.
- Identify the smallest root cause that explains the evidence.
- Distinguish confirmed facts from remaining hypotheses.
</success_criteria>

<output>
Return the root cause, supporting evidence, smallest safe next step, and any material uncertainty.
</output>

<stop_rules>
Keep investigating while another targeted check could distinguish plausible causes.
Stop when one cause explains the observed behavior or return the exact missing evidence.
</stop_rules>
```

## Narrow fix

```xml
<task>
Implement the smallest safe fix for [issue]. Preserve behavior outside the failing path.
</task>

<success_criteria>
- The original failure no longer reproduces.
- Existing affected contracts still pass.
- The final response lists touched files and verification.
</success_criteria>

<constraints>
Make in-scope local edits and run non-destructive validation without asking first.
Do not perform unrelated refactors or external writes.
</constraints>

<verification>
Run the most targeted reproduction first, then the affected existing tests.
If a check fails, revise and rerun it before finalizing.
</verification>
```

## Root-cause review

```xml
<task>
Review [change or path] for material correctness and regression risks.
</task>

<success_criteria>
- Each finding identifies a real user-visible or operational failure.
- Each finding cites the relevant file and evidence.
- If no material issue exists, say so explicitly.
</success_criteria>

<grounding>
Ground findings in inspected repository evidence.
Label inference separately and omit speculative or stylistic findings.
</grounding>

<output>
Return findings first, ordered by severity, with evidence and a specific remediation.
Then give a brief no-findings or residual-risk note.
</output>
```

## Research or recommendation

```xml
<task>
Research [decision] and recommend the best path for [constraints and audience].
</task>

<success_criteria>
- Compare the options that materially affect the decision.
- Support important current claims with retrieved primary sources.
- State tradeoffs, uncertainty, and any decision-blocking question.
</success_criteria>

<research>
Prefer primary sources. Cite only sources actually retrieved.
Separate observed facts, reasoned inferences, and open questions.
</research>

<stop_rules>
Start broad, then retrieve again only for a missing required fact, conflict, or unsupported material claim.
Do not search again only to improve wording or add optional examples.
</stop_rules>
```

## Prompt patching

```xml
<task>
Diagnose why this prompt underperforms on [representative failures] and make the smallest high-leverage revision for GPT-5.6.
</task>

<success_criteria>
- Tie each proposed change to an observed failure.
- Remove contradictions, repetition, and obsolete process scaffolding.
- Preserve requirements that still affect correctness or product behavior.
- Produce a revised prompt that is no longer than necessary.
</success_criteria>

<verification>
Compare the old and revised prompts on the same representative cases.
Change one instruction group at a time so regressions remain attributable.
</verification>

<output>
Return observed failure modes, prompt-level causes, the revised prompt, and measured or expected effects labeled appropriately.
</output>
```
