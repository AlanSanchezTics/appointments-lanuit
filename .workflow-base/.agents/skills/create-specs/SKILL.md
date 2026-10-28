---
name: create-specs
description: Interview the user about a new feature, then drive Spec Kit to generate the feature spec, plan, tasks, and a documentation review. Use when the user wants to create a new feature spec, clarify requirements, or start a Spec Kit workflow for a new change.
---

# Create Specs

Turn a feature idea into a reviewed Spec Kit package under `specs/NNN-feature/`. Follow `docs/standards/spec-authoring-workflow.md`; this skill is the interview and command sequence, that document is the source of truth for roles, gates, and reports.

Values written as `{{key}}` come from `docs/standards/subagent-workflow.profile.md`: look each one up before using it, and if a key is missing, stop and ask the owner.

## Invocation conventions

Skill names in this workflow are platform-neutral. Use the invocation syntax supported by the current platform:

| Skill | Claude Code | Codex |
|---|---|---|
| create-specs | `/create-specs Add an image action` | `$create-specs Add an image action` |
| speckit-specify | `/speckit-specify <approved feature description>` | `$speckit-specify <approved feature description>` |

Apply the same convention to the other `speckit-*` skills. These are skill invocations, not shell commands. Within a subagent round, load and follow the matching SKILL.md using the platform's available skill mechanism; the brief must name the skill, approved input, stage, and stopping gate. Do not assume that a slash command in a brief executes itself.

Use Claude's expanded argument text when provided, or the current explicit invocation message in Codex, as the initial feature description. An unexpanded argument placeholder is template text, not a requirement. Ask the owner when input is missing or conflicting. Neither platform's invocation syntax bypasses the interview, scope approval, or later owner checkpoints.

## Workflow

### 1) Read context, then interview (Plan mode)

Read `AGENTS.md`, `CLAUDE.md`, `.specify/memory/constitution.md`, `{{product_spec}}`, and the relevant earlier specs and `{{domain_docs}}`. Use `{{specs_index}}` (the specs index) and `{{domain_docs}}` to find the real names; do not assume them. If a prerequisite (constitution, index, domain docs) is missing, follow "Prerequisites and fallbacks" in `docs/standards/spec-authoring-workflow.md`.
Ask 1-3 questions at a time, following `references/spec-questionnaire.md`: goal and value, entry point and flow, data/API/validation/state, migration and compatibility, acceptance criteria. For decisions that change scope, prefer closed options. Draft the decision log (goal, scope, decisions with IDs D1, D2..., contracts to preserve, documents to read, open questions) as you go.

**Amendment mode:** if the request changes the scope of an existing spec, follow "Amending an existing spec" in `docs/standards/spec-authoring-workflow.md` (amend in place if Draft or partial; new referencing spec if already Implemented) instead of creating an unrelated spec.

### 2) Lock the scope

Confirm in-scope and out-of-scope behavior, affected users and surfaces, constraints, and whether the change touches behavior, contracts, validations, UI, or persistence. Present the scope and the decision log and **wait for explicit approval**. Do not leave Plan mode on your own.

### 3) Run the Spec Kit flow (only after approval and in Default mode)

The Orchestrator launches the `assistant` agent (never the main chat or `developer`) with a brief per stage: approved scope, decision log, contracts to preserve, files to read, stage, and gate to stop at. After `speckit-specify` creates the feature directory, save the decision log as `agent-reports/00-decisions.md` and create `agent-reports/STATE.md`; update `STATE.md` before presenting each gate.

1. `speckit-constitution` only if a principle change was agreed.
2. `speckit-specify`, then **stop** and present `spec.md` with the Assistant's coverage table for scope confirmation.
3. `speckit-clarify` only for remaining ambiguities. Every product decision goes back to the owner and gets a new ID in the log.
4. After the owner confirms: `speckit-plan` (contracts, data model, research, quickstart as applicable), then `speckit-tasks`. With `tasks.md`, add or update the spec's row in `{{specs_index}}` (status Draft) so the Docs Reviewer can verify it.
5. Launch the `reviewer-docs` agent, which runs `speckit-analyze` read-only plus the decision-coverage checks and issues `Approved` or `Rejected`. On rejection the Assistant fixes and the review repeats (max 3 cycles, then escalate).

Agents write round reports and return only a verdict or summary and the path. Keep them through their gate; the Orchestrator consolidates closed cycles and removes eligible workflow-owned reports under the lifecycle in `docs/standards/subagent-workflow.md`.

Do not run `speckit-converge` or start implementation. Wait for the owner's approval of the package and authorization to start phase 1.

### 4) Keep the repo contract intact

- `{{product_spec}}` and `{{domain_docs}}` are the permanent contract; `specs/*` are working artifacts. If they conflict, the docs win unless the owner decides otherwise.
- Include a documentation impact note in the spec or plan when flow, validation, state, integrations, or UI change.
- Model or migration changes must update `{{data_model_doc}}`.
- Write new documentation in English.

### 5) Record and hand off

Log each documentation cycle in `{{spec_reports_dir}}`. The handoff states exactly what was produced, what the owner still has to approve, and what remains to implement.

## Resources

- `references/spec-questionnaire.md`: ordered intake questions.
