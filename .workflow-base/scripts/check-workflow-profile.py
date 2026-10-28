"""Check that every {{key}} used by the portable workflow files exists in the profile,
that every profile key is used, and that path-like profile values exist in the repo."""
import glob
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE = ROOT / "docs/standards/subagent-workflow.profile.md"
PORTABLE = ["docs/standards/subagent-workflow.md", "docs/standards/spec-authoring-workflow.md",
            ".claude/agents/*.md", ".codex/agents/*.toml", ".agents/skills/create-specs/SKILL.md", ".agents/skills/create-specs/references/*.md", ".agents/skills/resume-spec/SKILL.md"]

rows = re.findall(r"^\| `\{\{(\w+)\}\}` \|.*\| ([^|]+) \|$", PROFILE.read_text(), re.M)
profile = {key: value.strip() for key, value in rows}

used = set()
errors = []
for pattern in PORTABLE:
    for path in glob.glob(str(ROOT / pattern)):
        for key in re.findall(r"\{\{(\w+)\}\}", Path(path).read_text()):
            if key == "key":  # generic placeholder used in the lookup rule itself
                continue
            used.add(key)
            if key not in profile:
                errors.append(f"undefined key {{{{{key}}}}} in {Path(path).relative_to(ROOT)}")

errors += [f"unused profile key {{{{{key}}}}}" for key in sorted(set(profile) - used)]

for key, value in profile.items():
    match = re.match(r"`([^`]+)`", value)
    target = match.group(1) if match else ""
    if "/" in target and "NNN" not in target and not glob.glob(str(ROOT / target)):
        errors.append(f"path of {{{{{key}}}}} does not exist: {target}")

spec = re.search(r"^- Spec Kit: ([\d.]+)", PROFILE.read_text(), re.M)
options = ROOT / ".specify/init-options.json"
if spec and options.exists():
    installed = re.search(r'"speckit_version":\s*"([^"]+)"', options.read_text())
    if installed and installed.group(1) != spec.group(1):
        print(f"WARNING: installed Spec Kit {installed.group(1)} differs from tested {spec.group(1)}")

print("\n".join(errors) if errors else f"OK: {len(profile)} keys, all defined, used, and resolvable")
sys.exit(1 if errors else 0)
