#!/usr/bin/env python3
"""Verify the exact preserved files, optionally restoring their original paths."""

import argparse
import hashlib
import json
import pathlib
import tarfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--restore", type=pathlib.Path)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
manifest = json.loads((root / "manifest.json").read_text())
expected = {entry["path"]: entry for entry in manifest["files"]}
assert len(expected) == manifest["originalFileCount"]
seen = set()
restored = []

for archive in manifest["archives"]:
    archive_path = root / archive["path"]
    compressed = archive_path.read_bytes()
    assert len(compressed) == archive["bytes"]
    assert digest(compressed) == archive["sha256"]
    with tarfile.open(archive_path, "r:gz") as source:
        members = source.getmembers()
        assert len(members) == archive["members"]
        for member in members:
            relative = pathlib.PurePosixPath(member.name)
            assert member.isfile() and not relative.is_absolute()
            assert ".." not in relative.parts
            assert member.name not in seen and member.name in expected
            entry = expected[member.name]
            assert entry["archive"] == archive["path"]
            data = source.extractfile(member).read()
            assert len(data) == entry["bytes"] and digest(data) == entry["sha256"]
            git_blob = b"blob " + str(len(data)).encode() + b"\0" + data
            assert hashlib.sha1(git_blob).hexdigest() == entry["gitBlobSha1"]
            assert member.mode == int(entry["mode"], 8)
            seen.add(member.name)
            if args.restore:
                restored.append((relative, member.mode, data))

assert seen == set(expected)
assert sum(entry["bytes"] for entry in expected.values()) == manifest["originalBytes"]
if args.restore:
    args.restore.mkdir(parents=True, exist_ok=False)
    for relative, mode, data in restored:
        destination = args.restore / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        destination.chmod(mode)
print(json.dumps({"verifiedFiles": len(seen), "verifiedArchives": len(manifest["archives"]),
                  "originalBytes": manifest["originalBytes"],
                  "restoredTo": str(args.restore.resolve()) if args.restore else None}))
