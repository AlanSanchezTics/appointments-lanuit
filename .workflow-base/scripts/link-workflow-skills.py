"""Expose shared .agents/skills to Claude without copying or replacing owner skills."""
import os
from pathlib import Path
import sys


def main():
    """Create relocatable skill links; return a failure without overwriting collisions."""
    root = Path(__file__).resolve().parent.parent
    source = root / '.agents/skills'
    target = root / '.claude/skills'
    if not source.is_dir():
        sys.exit(f'Shared skills directory does not exist: {source}')
    target.parent.mkdir(exist_ok=True)
    if target.is_symlink():
        if target.resolve() == source.resolve():
            print('Shared skills link already configured.')
            return
        sys.exit(f'Existing skills link has a different target: {target}')
    if not target.exists():
        target.symlink_to(os.path.relpath(source, target.parent), target_is_directory=True)
        print('Linked .claude/skills -> ../.agents/skills')
        return
    if not target.is_dir():
        sys.exit(f'Existing skills path is not a directory: {target}')
    skills = sorted(path for path in source.iterdir() if path.is_dir() and (path / 'SKILL.md').is_file())
    conflicts = []
    for skill in skills:
        destination = target / skill.name
        if destination.exists() or destination.is_symlink():
            if not destination.is_symlink() or destination.resolve() != skill.resolve():
                conflicts.append(str(destination.relative_to(root)))
    if conflicts:
        sys.exit('Conflicting skills; ask the owner before changing them:\n  ' + '\n  '.join(conflicts))
    for skill in skills:
        destination = target / skill.name
        if not destination.is_symlink():
            destination.symlink_to(os.path.relpath(skill, target), target_is_directory=True)
            print(f'Linked {destination.relative_to(root)}')
    print('Shared skills configured; existing Claude-only skills preserved.')


if __name__ == '__main__':
    main()
