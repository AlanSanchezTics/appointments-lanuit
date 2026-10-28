---
description: Workflow for authoring a new Spec Kit package (interview, spec, plan, tasks, documentation review) with owner approval gates, before any implementation starts.
globs: ["specs/**/*.md", "docs/**/*.md", "AGENTS.md", "CLAUDE.md", ".agents/skills/create-specs/**"]
alwaysApply: true
---
# Spec Authoring Workflow Standard

This standard covers creating a spec package. Implementation rounds that follow are governed by the subagent workflow standard (`subagent-workflow.md`, same folder, with its profile); the Orchestrator rules, the 3-cycle correction cap, and report conventions defined there apply here too. The `create-specs` skill (`.agents/skills/create-specs/`) drives the interview and command sequence. Invoke it as `/create-specs <description>` in Claude Code or `$create-specs <description>` in Codex. Apply the same platform convention to the `speckit-*` skills; these references are skill names, not shell commands. Subagent briefs carry the approved input and stage explicitly.

## Roles

| Role | Actor | Responsibility |
|---|---|---|
| Orchestrator | Main chat | Interviews the owner, writes the decision log and `STATE.md`, relays every product decision to the owner |
| Assistant | `assistant` agent, independent of the main chat and of `developer` | Runs the Spec Kit commands and edits spec artifacts from a written brief |
| Docs Reviewer | `reviewer-docs` agent | Read-only audit of the package against the decision log, constitution, and earlier specs; writes only its own report |

The Orchestrator hands the Assistant a brief with the approved scope, the path of the decision log, the contracts to preserve, the files to read, the stage to run, and the gate to stop at. The Assistant never decides product questions; it returns them to the Orchestrator, who relays them to the owner.

If `reviewer-docs` rejects the same package twice in a row, the Orchestrator may rerun the review with a stronger model after telling the owner.

## Decision log, coverage table, and state

- **Decision log** (`agent-reports/00-decisions.md`): goal, in and out of scope, decisions with IDs (D1, D2, ...), contracts to preserve, documents to read, open questions. The owner approves it at Gate 1. Before the feature directory exists, it travels inline in the brief of the first stage; the Orchestrator saves it verbatim as soon as `speckit-specify` creates the directory. For amendments the directory already exists.
- **Coverage table:** at the end of each stage the Assistant lists every decision ID and where it landed (spec, plan, or tasks). Anything assumed that is not in the log is marked `[ASSUMPTION]` and returned to the owner as an open question. The table is presented at Gate 2.
- **`STATE.md`** (`agent-reports/STATE.md`): durable resume checkpoint. The Orchestrator updates its **Resume here** block before each gate and records closed cycles in **History**. Follow the report lifecycle and state schema in `subagent-workflow.md`; reports remain available while a gate or acceptance still depends on their evidence.
- **Context economy:** agents write round reports and return only the verdict, a short summary, and the path. The Orchestrator reads the coverage table and verdicts, not entire artifacts, unless the owner asks. Every gate is a safe point to end a session.

## Sequence and owner gates

1. **Context and interview (Plan mode).** Read `AGENTS.md`, `CLAUDE.md`, the constitution, `{{product_spec}}`, `{{specs_index}}`, and the relevant earlier specs and `{{domain_docs}}`. Interview the owner about goal, flow, contracts, risk, and success criteria, and draft the decision log.
2. **Gate 1: scope and decision log approval.** Present the scope and the decision log. The switch out of Plan mode is explicit and never presumed.
3. **Specify.** Review the constitution; use `speckit-constitution` only if a principle change was agreed. The Assistant runs `speckit-specify`; the Orchestrator then saves the decision log and `STATE.md`.
4. **Gate 2: `spec.md` confirmation.** Present `spec.md` with the coverage table. Use `speckit-clarify` only for remaining ambiguities; each product decision returns to the owner through the Orchestrator and is added to the log with a new ID.
5. **Plan and tasks.** After confirmation, the Assistant runs `speckit-plan` (contracts, data model, research, quickstart as applicable), then `speckit-tasks`, and refreshes the coverage table.
6. **Documentation review.** After `tasks.md`, the Docs Reviewer runs `speckit-analyze` read-only and the checks in its agent definition (decision coverage, unrecorded decisions, conflicts with the constitution and earlier specs' exclusions, documentation impact, index row). Verdict `Approved` or `Rejected` with concrete findings. On rejection the Assistant corrects and the review repeats, max 3 cycles; decisions that change scope go to the owner.
7. **Gate 3: package approval.** The owner approves the documentation package.
8. **Gate 4: phase 1 authorization.** Implementation starts only on the owner's explicit authorization, then follows the subagent workflow standard phase by phase.

Never run `speckit-converge` or start implementation automatically.

## Amending an existing spec

Use this when a request changes the scope of a spec that already exists (for example, adding behavior that the spec explicitly excludes).

- **Spec is Draft or only partially implemented:** amend it in place. The owner approves the scope change (Gate 1), the decisions are encoded in the existing `spec.md` (`speckit-clarify` for open points), `plan.md` and `tasks.md` are updated (`speckit-plan`, `speckit-tasks`), and the Docs Reviewer runs `speckit-analyze` on the whole package. Gates 2 to 4 apply as usual. Mark new or changed tasks clearly so completed work is not re-done.
- **Spec is already Implemented:** do not rewrite history. Create a new spec that references the original and states what it adds or corrects (for example, a `...-corrections` spec that references the spec it corrects).
- In both cases update `{{specs_index}}` and any affected `{{domain_docs}}` (for example, remove or revise an exclusion that no longer holds).

## Prerequisites and fallbacks

Before the interview, the Orchestrator checks what the project has. A missing item does not stop the work silently and is never invented; follow this table.

| Missing | Needed? | What the Orchestrator does |
|---|---|---|
| Constitution (`.specify/memory/constitution.md`) | Yes | Do not run `speckit-specify`. Propose `speckit-constitution` as stage 0, with the owner defining the principles, and wait |
| `{{specs_index}}` | Recommended | Offer to build it: list `specs/` and read each `spec.md` title and Status; the owner confirms before it is saved. Until then, triage uses the directory listing |
| `{{domain_docs}}` | Optional | Tell the owner that triage has no domain evidence and relies on the `spec.md` scopes. The Docs Reviewer reports that it skipped the domain-docs check |
| `{{product_spec}}` | Optional | Treat the existing `spec.md` files as the contract and note it in the decision log |
| `{{data_model_doc}}` | Only if the feature changes data | Ask the owner where to record the data model change; do not create a file on your own |
| `STATE.md` | To resume a spec | Use remaining latest reports if any; otherwise use approved artifacts and current code or test evidence, or ask the owner for missing checkpoint details. Never invent history or rerun a provider to reconstruct it |

A project that has no such document sets its profile value to `none`; the checker then skips it, and the table above applies.

## Specs index

`{{specs_index}}` is the registry of all specs (number, link, title, declared status). Use it to find earlier specs instead of guessing names. Update it in the same change whenever a spec is created, renamed, or its `Status` changes: the Assistant adds the row with status Draft together with `tasks.md` (before the documentation review), and the status is refreshed when implementation finishes. The Docs Reviewer verifies the row exists.

## Evidence and records

- Distinguish evidence verified by agents from manual acceptance by the owner; the latter stays pending until the owner confirms it.
- Keep reports for each documentation cycle in `{{spec_reports_dir}}` while its review or owner gate is unresolved; after closure, consolidate its evidence and status into `STATE.md` under the report lifecycle in `subagent-workflow.md`.
- If the feature changes a domain rule or the data model, update the corresponding doc (`{{domain_docs}}`, `{{data_model_doc}}`) and link it from the report.
- Preserve existing decisions and contracts from earlier specs; call out any conflict instead of silently overriding it.
