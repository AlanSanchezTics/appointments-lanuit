---
description: Orchestrator / Developer / Reviewer subagent workflow for implementation rounds, including role contracts, risk-based reviewer selection, report locations, and the correction loop.
globs: ["docs/**/*.md", "specs/**/agent-reports/**/*.md", "AGENTS.md", "CLAUDE.md", ".claude/agents/*.md", ".codex/agents/*.toml"]
alwaysApply: true
---
# Subagent Workflow Standard

Every implementation round that uses subagents follows this standard. Authoring a new spec package before implementation is covered by the spec authoring standard (`spec-authoring-workflow.md`, same folder). Project-specific values (paths, high-risk areas) live in the profile, `subagent-workflow.profile.md` in the same folder. Any value written as `{{key}}` (for example `{{specs_index}}`) must be looked up in the profile before you use it; never guess it, and if the key is missing, stop and ask the Orchestrator or the owner. Models are configured independently per platform, not in the profile: Claude Code uses `model:` and `effort:` in `.claude/agents/*.md`; Codex uses `model` and `model_reasoning_effort` in `.codex/agents/*.toml`. Markdown role bodies in `.claude/agents/` are the shared role contracts; Codex adapters load those bodies while using their own model settings. This document is the workflow source of truth.

## Rules in force

Read this whole standard before launching any subagent. The rules that matter most, in one screen:

1. Pick a flow first (direct, micro-change lane, Developer → Reviewer, spec package, or spec amendment), state it in one line with the reason, and let the owner change it.
2. One round per turn. Developer, then Reviewer, never concurrently. The owner authorizes each next round at its checkpoint.
3. The Reviewer is chosen by risk (the high-risk Reviewer for the `{{high_risk_areas}}`), runs targeted tests, and reports every finding once as `blocking` or `non-blocking`. Only blocking findings open a correction cycle; maximum 3.
4. The Developer has an 80-turn budget (enforced by `maxTurns` in Claude Code; an instruction monitored by the Orchestrator in Codex). Never compact a subagent. Start a new one with a handoff on a new round, at the cap, or after more than 1 hour idle.
5. A high-risk phase with more than about 10 tasks is split into two rounds.
6. The brief carries a decision excerpt and the `STATE.md` path. Subagents do not read the full decision log or earlier reports.
7. Small visual or copy adjustments use the micro-change lane: one Developer per change, one Reviewer pass when the series closes.
8. Do not resume a main session idle for more than 1 hour with more than about 200k tokens. Start a new one using "Resuming work".
9. A round is not closed until the affected `{{domain_docs}}` and the `{{data_model_doc}}` are updated.

## Choosing a flow

At the start of any request that changes code or docs, the Orchestrator picks one flow, states it in one line with the reason, and lets the owner change it.

| Request | Flow | How it starts |
|---|---|---|
| Trivial edit (a single line, a copy fix) | Direct, no subagents | The Orchestrator edits and reports |
| Series of small visual or copy adjustments to a flow already under review (no logic, schema, or permission change) | Micro-change lane (see "Cost controls") | The Developer applies each change alone; one Reviewer pass closes the series |
| Bounded change to an existing flow: several files, a domain rule, or a high-risk area | This standard (Developer → Reviewer) | The Orchestrator writes the round brief and launches the `developer` agent, then `reviewer` or `reviewer-high-risk` |
| Request that implies a **new flow** | Spec package first (the spec authoring standard), then this standard per phase | The Orchestrator invokes the `create-specs` skill |
| Request that **changes the scope of an existing spec** | Spec amendment (see "Amending an existing spec" in the authoring standard), then this standard per phase | The Orchestrator invokes the `create-specs` skill in amendment mode |

A **new flow** is a user journey or operational process that does not exist yet, such as a new screen sequence, a new role interaction, or a new process with its own states. Extending or fixing an existing flow within its documented scope is a bounded change, not a new flow.

### Triage

Before choosing, the Orchestrator checks the request against `{{specs_index}}` and the matching `{{domain_docs}}` (and the relevant `spec.md` scope and exclusions). It then presents to the owner: the recommended flow, the evidence (for example, "spec NNN excludes X from its scope"), and the alternative. The owner decides. If the evidence is inconclusive, ask the owner before starting.

## When to use

- **Spec development:** each phase or task group of `tasks.md` is one round, except a high-risk phase of more than about 10 tasks, which is split into two rounds (see "Round sizing" under "Cost controls"). The Orchestrator builds the brief from `spec.md`, `plan.md`, and that phase's tasks. The Developer uses `speckit-implement` (prechecks, checklists, hooks, context loading) but only for the phase named in the brief, and the brief says so explicitly. Never run it unscoped over the whole feature; it would execute every phase and bypass the Reviewer gate between phases.
- **Change requests in an ordinary session:** use the workflow when the change touches several files, a domain rule, or any of the `{{high_risk_areas}}`. Skip it for trivial edits (a single line, a copy fix); the Orchestrator may apply those directly.
- When in doubt, use the workflow.

## Roles

| Role | Actor | Model | Writes code |
|---|---|---|---|
| Orchestrator | Main chat | Session model | No (coordinates) |
| Developer | `developer` agent | Set in the platform-specific agent configuration | Yes, authorized scope only |
| Reviewer (low risk) | `reviewer` agent | Set in the platform-specific agent configuration | No, report only |
| Reviewer (high risk) | `reviewer-high-risk` agent | Set in the platform-specific agent configuration | No, report only |

### Orchestrator
- Defines a bounded scope for the round and hands the Developer the round brief (see below).
- Keeps state, coordinates decisions, and chooses the Reviewer by risk.
- Returns any new product decision or scope change to the owner. It never decides these alone.
- Runs one round (one spec phase) per turn and never runs rounds concurrently. After an approved round it presents the checkpoint and waits for the owner's authorization before starting the next one.
- After every subagent: verifies the report and results, requests remediation when evidence is missing, and tells the user briefly and concretely what happened.

### Developer
- Works only inside the authorized scope and files.
- Runs the round's tests and verifies its objective and the phase checkpoint from `tasks.md`.
- Marks `[X]` in `tasks.md` only for tasks it verified. After a rejection it unmarks any task the Reviewer found unverified.
- Records modified files, results, evidence, failures, and limitations in its report.
- Separates static design, executed tests, and the owner's manual acceptance.
- Never states something is verified unless it was actually verified.

### Reviewer
- Runs only after the Developer finishes, never concurrently on the same round.
- Works in audit mode: does not modify the Developer's delivery and writes only its own report.
- Reviews the diff, tests, contracts, risks, and the round's exit criteria (for a spec phase, its checkpoint in `tasks.md`), and **executes** the relevant tests and commands. Reading alone is not a review.
- Runs targeted tests (the files and suites the round touched), with the commands found in `{{test_commands}}`. The full suite runs once when the phase closes, not on every cycle.
- Reports every finding in one pass, each tagged `blocking` or `non-blocking`. Only blocking findings open a correction cycle.
- Issues `Approved` or `Rejected` with concrete findings and required corrections.

## Reviewer selection by risk

Use the high-risk Reviewer (`reviewer-high-risk`) when the round touches any of the `{{high_risk_areas}}`. Otherwise use the low-risk Reviewer (`reviewer`): copy, i18n, tests, UI adjustments. When unsure, choose high risk.

## Round brief (Orchestrator to Developer)

1. Goal and requirements for the round.
2. Contracts that must hold (specs, domain docs, API/route shapes).
3. Authorized files; anything else is out of scope.
4. Restrictions (standards from `AGENTS.md`, no scope growth, no destructive DB commands).
5. Exit criteria, including commands that must pass. For a spec phase, include its objective and checkpoint from `tasks.md`.
6. Context: the relevant excerpt of the decision log (decision IDs and their text) and the path to `STATE.md`. Do not tell the subagent to read the full decision log or earlier reports.

## Report contents

Developer report: modified files, what changed, commands run with results, evidence, failures, limitations, and which statements are static design versus executed versus pending owner acceptance.

Reviewer report: verdict (`Approved` / `Rejected`), commands executed with results, findings (file, line, failure scenario), required corrections, and residual risks.

## Report locations

| Round relates to | Location |
|---|---|
| A spec in `specs/NNN-feature/` | `{{spec_reports_dir}}` |
| No spec | `{{adhoc_reports_dir}}` |

Write reports in `{{language}}`. Name files `round-NN-<topic>-developer.md` and `round-NN-<topic>-reviewer.md`; append `-rK` for correction round K. Reports are temporary working records; their lifecycle and the durable `STATE.md` checkpoint are defined below.

### Report lifecycle and durable state

Keep round reports, briefs, and correction logs while a round or correction cycle is unresolved, rejected, handed off, or waiting for a gate or owner acceptance whose evidence they contain. The Reviewer writes only its own report. After the Reviewer has issued a verdict and the required owner acceptance for that scope is recorded (including explicit acceptance of open findings), the Orchestrator consolidates the result and adequate evidence into `STATE.md`, then removes the enumerated workflow-owned reports and briefs for that closed work by default. Preserve every finding's open or accepted status; consolidation never implies approval, passing tests, or manual acceptance that did not occur. Unresolved or deferred evidence stays until its durable summary is adequate. Established workflow policy authorizes routine cleanup; explicit audit, legal, or owner preservation requirements take precedence.

`STATE.md` is the durable resume checkpoint for both spec work (in `{{spec_reports_dir}}`) and work without a spec (in `{{adhoc_reports_dir}}`). Keep its **Resume here** block sufficient to continue independently: current stage and last closed round; the next action and owner gate; exact decision/task IDs and progress; pending owner decisions, blockers, and carry-forward items; and key paths to the decision log and approved artifacts. Do not use it as a full spec, decision log, or completed-task backlog.

Append one compact **History** entry per closed round or documentation cycle. Preserve its scope, files and revision when known; Reviewer verdict and open or explicitly accepted findings; commands and results, including test scope and counts, and whether evidence is synthetic, runtime, or owner acceptance; per-run turn counts when available (omit them when not exposed; never invent or estimate them); residual risks and checks not run; relevant owner authorizations and decision IDs, including policy changes; and the next action. Summarize evidence instead of copying raw logs or completed task lists. Move durable tests, fixtures, and evidence to their owning tests or documentation and update references before removing a report that contains them. Do not rely on Git history to recover uncommitted evidence. Delete only enumerated workflow-owned report or brief files known to be consolidated; do not use broad globs or remove user documents or assets. There is no fixed report count or requirement to retain five files. Consolidation is manual; do not add cleanup scripts or archives by default.

## Correction loop

1. The Reviewer rejects with blocking findings. Non-blocking findings are recorded in the report and do not open a cycle.
2. The Orchestrator returns the findings to the Developer, who fixes only that round (see "Subagent lifecycle" for continuing versus starting a new Developer).
3. The same Reviewer reviews again.
4. Maximum 3 correction rounds. If findings are still open after the third, or a finding needs a product decision, the Orchestrator escalates to the owner with the open findings.

## Cost controls

Usage measured on one project (the numbers in this section are defaults; the profile may override them): subagents account for most consumption, concentrated in a few long Developer runs whose context grew to several hundred thousand tokens (every turn re-reads the whole context), and resuming a large session after more than 1 hour of inactivity rewrites its entire context uncached. These rules keep runs and sessions small.

### Subagent lifecycle

Never compact a subagent's context. Choose between continuing it and starting a new one:

- **Continue** the same subagent (the platform's follow-up messaging tool) for the correction cycles of the same round while its context is still small (about 80 turns or fewer) and it worked within the last hour.
- **Start a new subagent** with a short handoff brief when any of these holds: the next step is a new round or phase, the subagent reached the 80-turn cap, or it has been idle for more than 1 hour. Split a round that cannot finish under that size into smaller rounds.
- **Round sizing:** a high-risk phase (see "Reviewer selection by risk") with more than about 10 tasks is split into two rounds, each with its own Developer and Reviewer pass, cutting at a natural boundary in `tasks.md` (for example backend versus frontend, or storage versus read model). Measured on one project, an 11-task high-risk phase ran 86 turns and 289k tokens, while smaller rounds stayed under about 65 turns.
- A subagent that approaches the limit stops, writes a handoff (done, pending, files touched, next step) into its report, and returns; it does not keep going.
- **Platform enforcement:** in Claude Code, the `developer` agent sets `maxTurns: 80` (partial-output marking supported from 2.1.246). At the cap, the run stops and returns partial output; the Orchestrator starts a new Developer from that handoff and the current `git diff`. Codex has no documented equivalent in its custom-agent schema: the 80-turn budget is an instruction, so the Developer must stop with a handoff and the Orchestrator must monitor and split rounds. Never claim automatic termination or partial-output marking in Codex. The shared budget remains 80. Measured Claude need: Developers on the economic model did not stop on their own in 6 of 16 runs (63 to 87 turns).
- The turn limit is an estimate (about 3k tokens per turn on top of a ~21k start, so 80 turns is roughly 260k of context); the Orchestrator records turns for each run in `STATE.md` and adjusts it.

### Micro-change lane

Small visual or copy adjustments to a flow already under review (no logic, schema, or permission change) go to the Developer one at a time without a Reviewer per change. When the series closes, one Reviewer pass covers all the changes together. Anything beyond that scope returns to the normal flow.

### Session hygiene

- Do not resume a main session that has been idle for more than 1 hour and holds more than about 200k tokens of context. Start a new session from `STATE.md` instead, or compact deliberately before leaving it.
- Keep subagent tool lists minimal (see `.claude/agents/`) and disable user-level MCP servers or plugins this project does not use, since their tool definitions are paid on every spawn.

## Resuming work

Use this when starting a new session for a spec that is in progress (after a long or idle session, or a new day). The state lives in the repo, not in the old conversation.

For spec work, `STATE.md` lives at `specs/NNN-feature/agent-reports/STATE.md`; for work without a spec, use `STATE.md` under `{{adhoc_reports_dir}}`. The Orchestrator rewrites **Resume here** at each checkpoint and appends closed work to **History**. Follow the schema and retention rules above. A latest report is not a substitute for this checkpoint.

**Shortcut:** explicitly invoke `resume-spec`: `/resume-spec <NNN>` in Claude Code, or `$resume-spec Resume spec <NNN>.` in Codex (skill `.agents/skills/resume-spec/`), which applies the procedure below. The prompt is the manual equivalent.

**Standard prompt** for a new session (replace `<NNN-feature>`):

```
Resume spec <NNN-feature>, which is in progress. First read docs/standards/subagent-workflow.md and its profile in full, and specs/<NNN-feature>/agent-reports/STATE.md (the "Resume here" block). Act as Orchestrator. Do not re-read the full decision log or earlier reports. Before launching any subagent, summarize in 5 lines where we are, which owner decisions are pending, and the next proposed round, then wait for my authorization.
```

## Exit criteria for every round

- Reviewer verdict is `Approved`, or the owner explicitly accepted the open findings.
- If a domain rule or the data model changed, the corresponding doc is updated (`{{domain_docs}}`, `{{data_model_doc}}`). The report links to that change.
- Owner manual acceptance is reported as pending until the owner confirms it.
- The Orchestrator presents the checkpoint and does not start the next round until the owner authorizes it.

## Change log

- 2026-10-16: initial standard (roles, owner gates, risk-based Reviewer, correction loop, report locations).
- 2026-10-18: cost controls (subagent lifecycle, micro-change lane, session hygiene) and round sizing.
- 2026-10-19: 80-turn limit enforced with `maxTurns: 80` on the `developer` agent; "Rules in force", "Resuming work", and this change log.
- 2026-10-19: split into a portable core and `subagent-workflow.profile.md`; project paths, models, and risk areas became profile keys.
- 2026-10-19: profile keys use `{{key}}` syntax with an explicit lookup rule; model keys removed (models live in agent frontmatter); added `scripts/check-workflow-profile.py`.
- 2026-10-19: prerequisites and fallbacks for missing project documents (spec authoring standard), `none` profile values, and tested tool versions with a version warning in the checker.
- 2026-10-19: ported "Round sizing" (split high-risk phases of more than about 10 tasks into two rounds) from the project where it was first applied.
- 2026-10-21: add Codex agent adapters, shared invocation conventions, and explicit platform limits for turn budgets and tool restrictions.
- 2026-10-26: define temporary report retention and a durable `STATE.md` checkpoint for spec and ad hoc work.
