---
description: Project profile for the subagent workflow and spec authoring standards. Holds every project-specific value (paths, risk areas, language); the standards themselves stay portable.
globs: ["docs/standards/subagent-workflow.md", "docs/standards/spec-authoring-workflow.md", ".claude/agents/*.md", ".codex/agents/*.toml", ".agents/skills/create-specs/**", ".agents/skills/resume-spec/**"]
alwaysApply: true
---
# Subagent Workflow Profile

`docs/standards/subagent-workflow.md` and `docs/standards/spec-authoring-workflow.md` are portable: they are copied unchanged between projects. Values written as `{{key}}` inside them (and inside the agents and skills) are looked up here. A new project copies this file and changes only the values.

**Resolution rule:** look up every `{{key}}` in the table below before using it. Never guess a value. If a key is missing or its value does not exist in the repo, stop and ask the Orchestrator or the owner.

## Keys

| Key | What it is | What it is not | Value in this project |
|---|---|---|---|
| `{{product_spec}}` | The single document describing the product as a whole | Not a per-feature spec | `docs/specification.md` |
| `{{domain_docs}}` | Business-rule documents, one per functional area | Not the database schema | `docs/architecture/business-rules.md` |
| `{{data_model_doc}}` | The one document inventorying models, relationships, and the schema change log | Not the business rules | none |
| `{{specs_index}}` | Registry of all feature specs (number, link, title, status) | Not a spec's own `spec.md` | `specs/README.md` |
| `{{spec_reports_dir}}` | Folder where the agents' reports and `STATE.md` of one spec live (`NNN-feature` is that spec's folder name) | Not the folder for work without a spec | `specs/NNN-feature/agent-reports/` |
| `{{adhoc_reports_dir}}` | Folder for agent reports of work that has no spec | Not a spec's report folder | `docs/implementation-reports/` |
| `{{high_risk_areas}}` | The list of areas that require the high-risk Reviewer | Not a list of files | Prisma schema or migrations; admin auth and permissions; `AppointmentLog` audit events; booking rules, slot locks and Google Calendar sync; bulk or historic imports |
| `{{test_commands}}` | Where the commands to run targeted and full tests are written | Not the commands themselves | `CLAUDE.md`, "Commands" section |
| `{{language}}` | Language for new documentation | Not the language of chat replies | Español |

Models are not profile keys. Configure them independently: Claude Code uses `model:` and `effort:` in `.claude/agents/*.md`; Codex uses `model` and `model_reasoning_effort` in `.codex/agents/*.toml`. Never copy a GPT model ID into a Claude agent or replace a Codex model with a Claude alias. Markdown role bodies are shared; model choices are platform-owned.

If the project has no such document, write `none` as the value of a key. The standards then apply the fallbacks in "Prerequisites and fallbacks" of the spec authoring standard, and the checker does not look for the path.

## Limit overrides

The standard defines default limits: 80 turns per Developer run, 1 hour of idleness, about 200k tokens of context before a main session is replaced. A new project keeps the defaults until it measures its own. A project that measures differently records its values here and the standard follows them.

## Files that carry project values

When installing the workflow in another project, adapt these along with this profile:

- `.claude/agents/*.md`: the `model:` and `effort:` fields, and the `tools:` allow-list of `developer` (keep it minimal, adding only the MCP tools the project needs, for example a component registry).
- `.codex/agents/*.toml`: the independent Codex model and effort, and the pointer to the matching shared Markdown role body.
- `.claude/settings.json` and `.codex/hooks.json`: the same SessionStart reminder to read `AGENTS.md`. Merge existing hooks without replacing unrelated settings; changes to the reminder must update both registrations.
- `AGENTS.md`: shared repository rules and workflow selection. `CLAUDE.md` imports it with `@AGENTS.md`. Preserve existing project instructions in both files.
- The standards expect to live in `docs/standards/`; if they live elsewhere, update the references in the agents, skills, and hook.

## Tested with

- Spec Kit: 1.0.5 (the `speckit_version` in `.specify/init-options.json`). The standards use the hyphenated skill names (`speckit-specify`, `speckit-implement`, ...); other versions may name them differently.
- Claude Code: 2.1.302. At least 2.1.246 is required, for the enforced Developer turn cap and partial output.
- Codex CLI: configuration/templates checked with 0.163.0-alpha.10.2; real model rounds on both platforms remain an owner smoke test.

When you upgrade either, rerun a small round and update these lines.

## Checking the profile

Run this after changing the profile or the portable files. It fails on an undefined key, an unused key, or a path that does not exist:

```bash
python3 scripts/check-workflow-profile.py
```


## Platform compatibility

| Capability | Claude Code | Codex |
|---|---|---|
| Native agents | `.claude/agents/*.md` | `.codex/agents/*.toml` |
| Example model allocation | Haiku for Developer/Reviewer; Sonnet for the other roles | GPT-6 Luna for Developer/Reviewer; GPT-6.1 Sol for the other roles |
| Shared repository rules | `CLAUDE.md` imports `@AGENTS.md` | Reads `AGENTS.md` |
| Shared skills | `.claude/skills` links to `.agents/skills` | Discovers `.agents/skills` |
| Resume invocation | `/resume-spec 012` | `$resume-spec Resume spec 012.` |
| Explicit-only resume policy | `disable-model-invocation: true` in SKILL.md | `policy.allow_implicit_invocation: false` in `agents/openai.yaml` |
| Arguments | Host expands the argument placeholder | Read the current invocation message or stage brief |
| Startup reminder | SessionStart in `.claude/settings.json` | SessionStart in `.codex/hooks.json`; owner must review and trust it |
| Developer turn budget | `maxTurns: 80` is enforced | Instruction; Orchestrator monitors and splits rounds |
| Per-agent tools | Native `tools:` list | Capability restriction by instruction; parent permissions still apply |

The model names are template defaults, not a guarantee of account availability. Confirm model and effort choices separately for each platform and use supported values from the owner's account.

Run `python3 scripts/link-workflow-skills.py` after installation. It creates a relative directory link if `.claude/skills` is absent; if a directory already exists, it links missing shared skills and preserves Claude-only skills. Conflicts are reported without replacement. Rerun it after adding shared skills when using individual links. Commit the links and preserve symlinks in checkouts; moving the project must not break them. On Windows, creating symlinks may require Developer Mode or appropriate permissions; do not silently replace links with independently maintained copies.

Codex agents inherit permissions, provider, and MCP servers from the parent session. The adapters do not create a separate read-only sandbox, enforce a hard turn cap, or bypass approvals. Reviewer write restrictions remain the role contract. Read the entire matching Markdown role body before executing a round.

Both startup hooks point to the shared rules instead of duplicating them. Codex skips new or modified non-managed hooks until the owner reviews and trusts the current definition in `/hooks`; trust the project layer too. Do not bypass hook trust programmatically. Hooks are enabled by default unless user/admin configuration disables them.

Portable standards and skills work on both platforms. Skill names are not shell commands; use the platform's skill mechanism, or read and follow the matching SKILL.md in an authorized subagent brief. An unexpanded argument placeholder is template text. Missing or conflicting spec arguments follow the resume skill's fallback/question rules; invocation never authorizes implementation.

References: [Codex agents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude skills](https://code.claude.com/docs/en/skills), [Claude agents](https://code.claude.com/docs/en/sub-agents).
