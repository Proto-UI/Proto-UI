"""Reconstruct captured evidence bytes; never execute compiler/generated code."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat


def relative(name):
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(p in (".", "..") for p in path.parts):
        raise ValueError("Unsafe relative evidence path")
    return path


def read_file(root, name):
    path = root
    parts = relative(name).parts
    for i, part in enumerate(parts):
        path = path / part
        mode = path.lstat().st_mode
        if not (stat.S_ISREG(mode) if i == len(parts) - 1 else stat.S_ISDIR(mode)):
            raise ValueError("Evidence path is not a regular file/directory")
    return path.read_bytes()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-record", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    manifest = json.loads(read_file(here, "manifest.json"))
    base = args.base_record
    if not stat.S_ISDIR(base.lstat().st_mode):
        raise ValueError("Base must be an existing non-symlink directory")
    data = {}
    for item in manifest["baseFiles"]:
        raw = read_file(base, item["path"])
        if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
            raise ValueError("Pinned reconstructed R7 base mismatch: " + item["path"])
        data[item["path"]] = raw
    component = manifest["component"]
    old = data[component["basePath"]]
    new = old
    previous_end = 0
    for item in component["edits"]:
        offset = item["byteOffset"]
        deleted = item["delete"].encode()
        if not isinstance(offset, int) or offset < previous_end or offset + len(deleted) > len(old):
            raise ValueError("Invalid or overlapping captured edit")
        if old[offset:offset + len(deleted)] != deleted:
            raise ValueError("Captured edit does not match pinned original bytes")
        previous_end = offset + len(deleted)
    for item in reversed(component["edits"]):
        offset = item["byteOffset"]
        new = new[:offset] + item["insert"].encode() + new[offset + len(item["delete"].encode()):]
    if digest(old) != component["baseSHA256"] or digest(new) != component["resultSHA256"]:
        raise ValueError("Captured Component hash mismatch")
    old_quote = json.dumps(old.decode(), ensure_ascii=False).encode()
    new_quote = json.dumps(new.decode(), ensure_ascii=False).encode()
    module = data["actual-generated-module.json"]
    if module.count(old_quote) != 1:
        raise ValueError("Expected exactly one generated code field")
    program = data["strict-program.portable.json"]
    if program.count(digest(old).encode()) != 1:
        raise ValueError("Expected exactly one Component program hash")
    results = {
        "graph/Component.js": new,
        "actual-generated-module.json": module.replace(old_quote, new_quote),
        "strict-program.portable.json": program.replace(digest(old).encode(), digest(new).encode()),
        "diagnostics.portable.json": read_file(here, "diagnostics.portable.json"),
    }
    for item in manifest["copiedFiles"]:
        results[item["outputPath"]] = data[item["basePath"]]
    expected = {item["path"]: item for item in manifest["outputs"]}
    if set(results) != set(expected):
        raise ValueError("Output set mismatch")
    for name, raw in results.items():
        relative(name)
        if len(raw) != expected[name]["bytes"] or digest(raw) != expected[name]["sha256"]:
            raise ValueError("Actual capture output mismatch: " + name)
    # All outputs verified before making a new directory. Never overwrite evidence.
    args.output.mkdir(exist_ok=False)
    for name, raw in results.items():
        target = args.output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            output.write(raw)
    print(json.dumps({"files": len(results), "diagnostics": len(json.loads(results["diagnostics.portable.json"])),
                      "verifiedCapturedBytes": True, "projectCodeExecuted": False}))


if __name__ == "__main__":
    main()
