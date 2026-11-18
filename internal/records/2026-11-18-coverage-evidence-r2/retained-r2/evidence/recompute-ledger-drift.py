#!/usr/bin/env python3
"""Read-only recomputation of the website Source-scan binding drift.

Usage: python3 recompute-ledger-drift.py <repo> <revision>

Reads the committed matrix and the committed sources through `git show` only.
It reproduces the audited counts (158 rows / 81 mismatched / 77 matched) and
prints the mismatched rows whose owning matrix rows are all
`infrastructure-exempt` (the unearned set) as JSON.
"""
import hashlib
import json
import re
import subprocess
import sys

MATRIX = "internal/website/self-hosting-coverage-matrix.md"


def git(repo, rev, path):
    result = subprocess.run(
        ["git", "show", f"{rev}:{path}"], cwd=repo, capture_output=True, timeout=240
    )
    return None if result.returncode != 0 else result.stdout


def parse_row(line):
    text = line.strip()
    if not (text.startswith("|") and text.endswith("|")):
        return None
    inner = text[1:-1]
    cells, current, index = [], "", 0
    while index < len(inner):
        if inner[index] == "\\" and inner[index + 1] == "|":
            current += "|"
            index += 2
            continue
        if inner[index] == "|":
            cells.append(current.strip())
            current = ""
            index += 1
            continue
        current += inner[index]
        index += 1
    cells.append(current.strip())
    return cells


def normalized_digest(payload):
    text = payload.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    repo, rev = sys.argv[1], sys.argv[2]
    matrix = git(repo, rev, MATRIX).decode("utf-8")
    lines = matrix.split("\n")
    header = None
    for line in lines:
        cells = parse_row(line)
        if cells and cells[0] == "ID" and "State" in cells:
            header = cells
            break
    state_index, id_index = header.index("State"), header.index("ID")
    states = {}
    for line in lines:
        cells = parse_row(line)
        if cells and len(cells) == len(header) and cells[id_index].startswith("`www."):
            states[cells[id_index].strip("`")] = cells[state_index].strip("`")
    start = next(
        index
        for index, line in enumerate(lines)
        if line.startswith("| Interactive or integration source |")
    )
    rows, index = [], start + 2
    while index < len(lines) and lines[index].startswith("|"):
        cells = parse_row(lines[index])
        if cells and len(cells) == 3:
            rows.append((index + 1, cells))
        index += 1
    mismatched, matched = [], 0
    for line_number, cells in rows:
        path = cells[0].strip("`")
        pinned = cells[2].strip("`")
        payload = git(repo, rev, path)
        current = normalized_digest(payload) if payload is not None else "MISSING"
        owners = re.findall(r"`(www\.[a-z0-9.-]+)`", cells[1])
        record = {
            "line": line_number,
            "path": path,
            "owners": owners,
            "ownerStates": [states.get(owner) for owner in owners],
            "pinned": pinned,
            "current": current,
        }
        if current == pinned:
            matched += 1
        else:
            mismatched.append(record)
    unearned = [
        record
        for record in mismatched
        if set(record["ownerStates"]) == {"infrastructure-exempt"}
    ]
    print(
        json.dumps(
            {
                "revision": rev,
                "matrix": MATRIX,
                "rows": len(rows),
                "matched": matched,
                "mismatched": len(mismatched),
                "mismatchedByOwnerState": {
                    "infrastructure-exempt-only": len(unearned),
                    "other": len(mismatched) - len(unearned),
                },
                "unearnedRows": unearned,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
