---
name: resume-spec
description: Resume an in-progress Spec Kit spec in a new session. Invoke explicitly with a spec number or name in Claude Code or Codex. Reads the subagent workflow standard and the spec's STATE.md, then summarizes where the work stands and waits for the owner's authorization before launching any subagent.
disable-model-invocation: true
---

# Resume Spec

Restart work on a spec that is already in progress, from a fresh session. The state lives in the repo, so the old conversation is not needed. Following the "Resuming work" section of `docs/standards/subagent-workflow.md` keeps this session small: the durable `STATE.md` checkpoint carries forward closed work, so old reports need only remain while their evidence is still needed.

Values written as `{{key}}` come from `docs/standards/subagent-workflow.profile.md`: look each one up before using it, and if a key is missing, stop and ask the owner.

## User Input

Invoke this skill explicitly with the spec number or name:

| Platform | Example |
|---|---|
| Claude Code | `/resume-spec 015` |
| Codex | `$resume-spec Resume spec 015.` |

In Claude Code, use the expanded argument text in the block below. In Codex, obtain the spec number or name from the current message that explicitly invokes this skill; do not depend on placeholder substitution.

```text
$ARGUMENTS
```

Normalize that input to one spec number or name before step 1. Ignore an unexpanded placeholder as literal template text, not a spec name. If neither source supplies a spec, use the empty-input fallback in step 1. If the input names multiple specs or the two sources identify different specs, ask the owner which one to resume; do not choose from unrelated numbers in earlier messages. Invocation only authorizes this skill's read-only resume summary; it does not authorize implementation or a new round.

## Steps

1. **Resolve the spec.** Match the normalized argument from User Input (number such as `012`, or a name) to a single `specs/NNN-*/` directory. If the argument is empty, read the active feature from `.specify/feature.json`. If nothing matches, several directories match, or `.specify/feature.json` looks stale, ask the owner; do not guess.
2. **Read the standard.** Read `docs/standards/subagent-workflow.md` in full. It defines the roles, the owner gates, and the limits you will apply.
3. **Read the state.** Read `specs/NNN-*/agent-reports/STATE.md` and start with its "Resume here" block. If `STATE.md` is missing, use remaining latest reports if any; when none remain, use approved artifacts and current code or test evidence, or ask the owner for missing checkpoint details. Never invent history or rerun a provider to reconstruct it. If the block is missing, use the remaining state entries and propose adding the block from verified evidence rather than silently relying on full history. For work without a spec, use `STATE.md` under `{{adhoc_reports_dir}}` as defined by the standard.
4. **Act as Orchestrator.** With a valid `STATE.md`, do not re-read the full decision log (`00-decisions.md`) or earlier reports. When the state is missing, read only remaining latest reports needed for the fallback in step 3. When a later round needs a decision, pass the subagent only the relevant excerpt, as the Round brief section requires.
5. **Summarize and stop.** Reply with exactly 5 lines: where the spec stands (include the current git branch and the last closed round), the pending owner decisions, the carry-forward items that matter next, the next proposed round and its reviewer risk level, and what you need from the owner. Then wait for the owner's authorization. Do not launch subagents, edit code, or change files before that.
