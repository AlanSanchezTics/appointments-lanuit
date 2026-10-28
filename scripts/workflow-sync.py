"""Install, update, and improve the subagent workflow kit in a project.

From the kit:      python3 core/scripts/workflow-sync.py install --target /path/to/project
From a project:    python3 scripts/workflow-sync.py status | pull | push [-m MESSAGE] [--yes]

install  copies the kit's core files and project templates into the project.
status   shows which core files changed locally or upstream.
pull     brings upstream improvements into the core files (3-way merge when both sides changed).
push     proposes local edits of core files as a branch (and a PR when `gh` is available) in the kit repo.

Project-owned files (profile, agents, hook, pointers) are copied once and never touched again.
"""
import argparse
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

LOCK, BASE, IGNORE = ".workflow-lock.json", ".workflow-base", {".DS_Store"}
HERE = Path(__file__).resolve()


def sh(*args, cwd=None, check=True):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and result.returncode:
        sys.exit(f"command failed: {' '.join(args)}\n{result.stderr.strip()}")
    return result


def digest(path):
    path = Path(path)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def copy(src, dst):
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def files_under(folder):
    folder = Path(folder)
    return sorted(str(p.relative_to(folder)) for p in folder.rglob("*")
                  if p.is_file() and p.name not in IGNORE and "__pycache__" not in p.parts)


def kit_root_from_script():
    """The kit root when this script runs from inside the kit, else None."""
    root = HERE.parents[2]
    return root if (root / "core").is_dir() and (root / "project").is_dir() else None


def kit_checkout(source):
    path = Path(source).expanduser()
    if path.is_dir():
        return path
    cache = Path.home() / ".cache" / "subagent-workflow-kit" / hashlib.sha1(source.encode()).hexdigest()[:12]
    if cache.is_dir():
        sh("git", "pull", "-q", "--ff-only", cwd=cache)
    else:
        cache.parent.mkdir(parents=True, exist_ok=True)
        sh("git", "clone", "-q", source, str(cache))
    return cache


def kit_info(kit):
    commit = sh("git", "rev-parse", "HEAD", cwd=kit, check=False).stdout.strip()
    version = (kit / "VERSION").read_text().strip() if (kit / "VERSION").exists() else "unknown"
    origin = sh("git", "remote", "get-url", "origin", cwd=kit, check=False).stdout.strip()
    return commit, version, origin or str(kit.resolve())


def write_lock(root, source, commit, version):
    (root / LOCK).write_text(json.dumps({"source": source, "commit": commit, "version": version}, indent=2) + "\n")


def state(root, kit, rel):
    base, local, upstream = digest(root / BASE / rel), digest(root / rel), digest(kit / "core" / rel)
    if upstream is None:
        return "removed-upstream"
    if base is None:
        return "new-upstream" if local is None else ("clean" if local == upstream else "unmanaged")
    return {(False, False): "clean", (True, False): "local-modified",
            (False, True): "upstream-changed", (True, True): "both-changed"}[(local != base, upstream != base)]


def project_context():
    root = HERE.parents[1]
    if not (root / LOCK).exists():
        sys.exit(f"{LOCK} not found in {root}; install the kit first.")
    lock = json.loads((root / LOCK).read_text())
    return root, lock, kit_checkout(lock["source"])


def cmd_install(args):
    kit = kit_root_from_script()
    if not kit:
        sys.exit("install must run from inside the kit (core/scripts/workflow-sync.py).")
    target = Path(args.target).expanduser().resolve()
    if not target.is_dir():
        sys.exit(f"target folder does not exist: {target}")
    for rel in files_under(kit / "core"):
        src, dst = kit / "core" / rel, target / rel
        if dst.exists() and digest(dst) != digest(src) and not args.force:
            print(f"skip (exists and differs): {rel}  (use --force to overwrite)")
            continue
        copy(src, dst)
        copy(src, target / BASE / rel)
    for rel in files_under(kit / "project"):
        src, dst = kit / "project" / rel, target / rel
        if rel.endswith(".snippet.md"):
            continue  # printed as next steps, merged by hand
        if dst.exists():
            print(f"kept (project-owned, already exists): {rel}")
        else:
            copy(src, dst)
    commit, version, source = kit_info(kit)
    write_lock(target, source, commit, version)
    print(f"Installed kit {version} into {target}.\nNext steps:\n"
          "  1. Edit docs/standards/subagent-workflow.profile.md: set each value (or `none`).\n"
          "  2. Configure models separately in .claude/agents/*.md and .codex/agents/*.toml.\n"
          "  3. Run python3 scripts/link-workflow-skills.py to expose shared skills to Claude.\n"
          "  4. Merge project/CLAUDE.snippet.md and project/AGENTS.snippet.md (in the kit) into your CLAUDE.md and AGENTS.md,\n"
          "     and merge existing SessionStart hooks for both platforms; review Codex hooks with /hooks.\n"
          "  5. Run: python3 scripts/check-workflow-profile.py")


def cmd_status(_):
    root, lock, kit = project_context()
    _, version, _ = kit_info(kit)
    print(f"installed from commit {lock['commit'][:8]} (kit {lock['version']}); upstream is kit {version}")
    counts = {}
    for rel in sorted(set(files_under(kit / "core")) | set(files_under(root / BASE))):
        s = state(root, kit, rel)
        counts[s] = counts.get(s, 0) + 1
        if s != "clean":
            print(f"  {s:18} {rel}")
    print("all core files clean" if set(counts) <= {"clean"} else f"summary: {counts}")


def cmd_pull(_):
    root, lock, kit = project_context()
    conflicts = []
    for rel in files_under(kit / "core"):
        s, up = state(root, kit, rel), kit / "core" / rel
        if s in ("new-upstream", "upstream-changed"):
            copy(up, root / rel)
            copy(up, root / BASE / rel)
            print(f"updated   {rel}")
        elif s == "both-changed":
            merged = sh("git", "merge-file", "-p", "-L", "yours", "-L", "base", "-L", "upstream",
                        str(root / rel), str(root / BASE / rel), str(up), check=False)
            if merged.returncode < 0:
                sys.exit(f"merge failed for {rel}: {merged.stderr.strip()}")
            (root / rel).write_text(merged.stdout)
            copy(up, root / BASE / rel)
            if merged.returncode > 0:
                conflicts.append(rel)
            print(f"merged    {rel}" + (f"  ({merged.returncode} conflict(s))" if merged.returncode else ""))
        elif s == "unmanaged":
            print(f"skipped   {rel}  (exists locally and differs; resolve by hand or reinstall with --force)")
    commit, version, _ = kit_info(kit)
    write_lock(root, lock["source"], commit, version)
    print(f"now at kit {version}." + (f"\nResolve conflict markers in: {', '.join(conflicts)}" if conflicts else ""))


def profile_paths(root):
    profile = root / "docs/standards/subagent-workflow.profile.md"
    text = profile.read_text() if profile.exists() else ""
    return sorted({m for m in re.findall(r"\| `([^`|]*/[^`|]*)` \|\s*$", text, re.M) if "NNN" not in m})


def cmd_push(args):
    root, lock, kit = project_context()
    modified = [rel for rel in files_under(root / BASE)
                if (root / rel).is_file() and digest(root / rel) != digest(root / BASE / rel)]
    if not modified:
        sys.exit("No local changes to core files; nothing to push.")
    stale = [rel for rel in modified if state(root, kit, rel) == "both-changed"]
    if stale:
        sys.exit("Upstream changed these files too; run pull first and resolve conflicts:\n  " + "\n  ".join(stale))
    leaks = [(rel, p) for rel in modified for p in profile_paths(root) if p in (root / rel).read_text()]
    for rel in modified:
        print(sh("diff", "-u", str(root / BASE / rel), str(root / rel), check=False).stdout)
    if leaks:
        print("WARNING: project-specific values appear in core files (they belong in the profile):")
        for rel, p in leaks:
            print(f"  {rel} contains {p}")
    if not args.yes and input(f"Create a branch with {len(modified)} file(s) in {lock['source']}? [y/N] ").lower() != "y":
        sys.exit("cancelled")
    work = Path(tempfile.mkdtemp())
    sh("git", "clone", "-q", lock["source"], str(work))
    branch = f"improve/{root.name}-{datetime.date.today():%Y%m%d}"
    sh("git", "checkout", "-q", "-b", branch, cwd=work)
    for rel in modified:
        copy(root / rel, work / "core" / rel)
    sh("git", "add", "-A", cwd=work)
    sh("git", "commit", "-q", "-m", args.message or f"Improve workflow core files from {root.name}", cwd=work)
    sh("git", "push", "-q", "origin", branch, cwd=work)
    print(f"Pushed branch {branch} to {lock['source']}.")
    if shutil.which("gh") and ("://" in lock["source"] or "@" in lock["source"]):
        print(sh("gh", "pr", "create", "--fill", cwd=work, check=False).stdout.strip() or "gh pr create did not run; open the PR by hand.")
    else:
        print("Open a pull request from that branch (or merge it) in the kit repo.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    install = sub.add_parser("install")
    install.add_argument("--target", required=True)
    install.add_argument("--force", action="store_true")
    sub.add_parser("status")
    sub.add_parser("pull")
    push = sub.add_parser("push")
    push.add_argument("-m", "--message")
    push.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    {"install": cmd_install, "status": cmd_status, "pull": cmd_pull, "push": cmd_push}[args.cmd](args)


if __name__ == "__main__":
    main()
