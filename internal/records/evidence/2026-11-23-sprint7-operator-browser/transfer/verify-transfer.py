#!/usr/bin/env python3
"""Restore/verify the unchanged operator preflight. Does not run a study."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['restore', 'verify'])
parser.add_argument('--manifest', type=Path, required=True)
parser.add_argument('--archive', type=Path)
parser.add_argument('--destination', type=Path, required=True)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--allow-browser', action='store_true')
args = parser.parse_args()
manifest = json.loads(args.manifest.read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
source = args.source.resolve(strict=True)
destination = args.destination.absolute()
expected = {row['path']: row for row in manifest['files']}
assert len(expected) == len(manifest['files']) == 220
assert sha(json.dumps(manifest['files'], sort_keys=True, separators=(',', ':')).encode()) == manifest['fileInventorySha256']
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip() == manifest['sourceRevision']
subprocess.run(['git', 'diff', '--quiet', 'HEAD'], cwd=source, check=True)
for row in manifest['executionInputs']:
    actual = source / row['path']
    assert actual.is_file() and not actual.is_symlink(), f'Missing execution input: {row["path"]}'
    assert sha(actual.read_bytes()) == row['sha256'], f'Execution input changed: {row["path"]}'
    original = subprocess.check_output(['git', 'show', manifest['sourceRevision'] + ':' + row['path']], cwd=source)
    assert sha(original) == row['sha256'], f'Execution input does not belong to the exact source: {row["path"]}'

if args.action == 'restore':
    assert args.archive and args.archive.is_file()
    assert sha(args.archive.read_bytes()) == manifest['archive']['sha256'], 'Archive digest mismatch'
    assert args.archive.stat().st_size == manifest['archive']['bytes']
    assert not destination.exists() and not destination.is_symlink(), 'Use a new destination; never overwrite an earlier attempt'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(args.archive, 'r:gz') as archive:
        members = archive.getmembers()
        assert len(members) == len(expected)
        assert len({member.name for member in members}) == len(members)
        for member in members:
            relative = PurePosixPath(member.name)
            assert member.isfile() and not member.issym() and not member.islnk(), 'Only regular archived files are accepted'
            assert not relative.is_absolute() and '..' not in relative.parts
            assert relative.parts[0] == manifest['archiveRoot']
            key = PurePosixPath(*relative.parts[1:]).as_posix()
            assert key in expected
            data = archive.extractfile(member).read()
            assert len(data) == expected[key]['bytes'] and sha(data) == expected[key]['sha256'], key
        destination.mkdir()
        for member in members:
            key = PurePosixPath(*PurePosixPath(member.name).parts[1:]).as_posix()
            target = destination / key
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as output:
                output.write(archive.extractfile(member).read())
            target.chmod(expected[key]['mode'])

assert destination.is_dir() and not destination.is_symlink()
actual_files = set()
for directory, dirs, names in os.walk(destination, followlinks=False):
    for name in list(dirs):
        entry = Path(directory) / name
        relative = entry.relative_to(destination).as_posix()
        if relative == 'clean-consumer/node_modules':
            assert entry.is_dir() and not entry.is_symlink(), 'Independent npm install must not link a workspace node_modules'
            dirs.remove(name)
        elif args.allow_browser and relative == 'operator/browser':
            assert not entry.is_symlink()
            dirs.remove(name)
        else:
            assert not entry.is_symlink(), f'Unexpected directory link: {relative}'
    for name in names:
        entry = Path(directory) / name
        relative = entry.relative_to(destination).as_posix()
        assert entry.is_file() and not entry.is_symlink(), f'Unexpected file link: {relative}'
        actual_files.add(relative)
        assert relative in expected, f'Unexpected archive file: {relative}'
        row = expected[relative]
        assert entry.stat().st_size == row['bytes'] and sha(entry.read_bytes()) == row['sha256'], f'Archive preimage changed: {relative}'
assert actual_files == set(expected), 'Missing archived files'
assert not (destination / 'operator/browser').exists() or args.allow_browser, 'A prior browser attempt must not be overwritten'
print(json.dumps({'status': 'verified-transfer', 'sourceRevision': manifest['sourceRevision'], 'archiveSha256': manifest['archive']['sha256'], 'filesVerified': len(actual_files), 'generatedOutputs': manifest['counts']['generatedOutputs'], 'observedConsumerRuns': 0, 'artifactAdmission': 'not performed', 'destination': str(destination)}))
