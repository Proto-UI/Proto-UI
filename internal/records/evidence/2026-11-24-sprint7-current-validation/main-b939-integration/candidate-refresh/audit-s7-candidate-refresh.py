#!/usr/bin/env python3
"""Read-only audit of the fixed S7 candidate refresh. Writes JSON only to stdout."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys

BASELINE = "b939afe35d30a1a436766d80beea7093a46e4fb2"
MATRIX = "internal/coverage-matrices/prototype-coverage-matrix.json"
LEDGER = "internal/website/self-hosting-coverage-matrix.md"
FOLLOW_TAIL = "harness.transcript.follow-tail"
EXPECTED_METRICS = {
    "sourceBindings": 6016,
    "projectionRows": 57,
    "atomicProjectionMapping": 117,
    "gpuiCoverageRows": 468,
}
IDENTITY_KEYS = {"revision", "tree", "sourceBindingsObject", "sourceObjectProof"}
ALLOWED_CANDIDATE_CHANGE_KEYS = IDENTITY_KEYS | {"sourceBindings"}

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--repo", required=True, type=pathlib.Path)
parser.add_argument("--source-commit", required=True)
args = parser.parse_args()
repo = args.repo.resolve()
issues = []
receipt = {
    "schemaVersion": 1,
    "kind": "read-only-s7-candidate-refresh-audit",
    "baselineCommit": BASELINE,
    "advertisedSourceCommit": args.source_commit,
    "repo": str(repo),
    "doesNotReplace": [
        "original prototype producer validation and generated Markdown checks",
        "original complete source and coverage/agent-operations gates",
        "115 original plus49 recovery frozen payload mode/blob audit",
        "current-head runtime, native or research acceptance",
    ],
}

def require(condition, message):
    if not condition:
        issues.append(message)

def git(*arguments):
    result = subprocess.run(
        ["git", "-C", str(repo), *arguments],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
    )
    if result.returncode:
        raise RuntimeError(
            "git " + " ".join(arguments) + ": " +
            result.stderr.decode("utf-8", errors="replace").strip()
        )
    return result.stdout

def digest(data):
    return hashlib.sha256(data).hexdigest()

def keyed(items, key, label):
    require(isinstance(items, list), label + " must remain an array")
    if not isinstance(items, list):
        return {}
    result = {}
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get(key), str):
            issues.append(label + " contains a malformed member")
            continue
        identity = item[key]
        require(identity not in result, label + " contains duplicate " + identity)
        result[identity] = item
    return result

try:
    if re.fullmatch(r"[0-9a-f]{40}", args.source_commit) is None:
        raise ValueError("--source-commit must be the real full40-hex source commit")
    require(git("cat-file", "-t", args.source_commit).strip() == b"commit",
            "advertised source object must be a commit")
    git("merge-base", "--is-ancestor", args.source_commit, "HEAD")
    receipt["headAtAudit"] = git("rev-parse", "HEAD").decode().strip()

    baseline_bytes = git("show", BASELINE + ":" + MATRIX)
    current_bytes = (repo / MATRIX).read_bytes()
    baseline = json.loads(baseline_bytes)
    current = json.loads(current_bytes)
    receipt["matrixSha256"] = {
        "baseline": digest(baseline_bytes),
        "currentWorkingTree": digest(current_bytes),
    }

    require(set(baseline) == set(current), "top-level matrix key set changed")
    historical_keys = sorted(set(baseline) - {"candidateSource", "consumerRows"})
    historical_deltas = [key for key in historical_keys
                         if baseline[key] != current.get(key)]
    require(not historical_deltas,
            "historical/frozen top-level fields changed: " + ", ".join(historical_deltas))
    receipt["unchangedHistoricalKeys"] = historical_keys
    receipt["historicalFieldChanges"] = historical_deltas

    old_rows = keyed(baseline.get("consumerRows"), "ID", "baseline consumerRows")
    new_rows = keyed(current.get("consumerRows"), "ID", "current consumerRows")
    require(set(old_rows) == set(new_rows), "consumer ID set changed")
    row_deltas = []
    for identity in sorted(set(old_rows) & set(new_rows)):
        old, new = old_rows[identity], new_rows[identity]
        fields = sorted(key for key in set(old) | set(new)
                        if old.get(key) != new.get(key) or (key in old) != (key in new))
        if fields:
            row_deltas.append({"ID": identity, "changedFields": fields})
        if identity == FOLLOW_TAIL:
            require(fields == ["issues"], "follow-tail may change only its explicit issues index")
            require(new.get("issues") == [746, 1323], "follow-tail issues must equal [746,1323]")
        else:
            require(not fields, "unexpected consumer row change: " + identity + " " + str(fields))
    require(FOLLOW_TAIL in new_rows, "follow-tail row is missing")
    require(row_deltas == [{"ID": FOLLOW_TAIL, "changedFields": ["issues"]}],
            "consumer semantic delta must be exactly the one follow-tail issues reconciliation")
    receipt["consumerSemanticDelta"] = row_deltas
    receipt["followTailIssues"] = {
        "baseline": old_rows.get(FOLLOW_TAIL, {}).get("issues"),
        "current": new_rows.get(FOLLOW_TAIL, {}).get("issues"),
    }

    old_candidate = baseline.get("candidateSource", {})
    new_candidate = current.get("candidateSource", {})
    require(set(old_candidate) == set(new_candidate), "candidateSource key set changed")
    candidate_changes = sorted(
        key for key in set(old_candidate) | set(new_candidate)
        if old_candidate.get(key) != new_candidate.get(key)
    )
    unexpected_candidate_changes = sorted(set(candidate_changes) - ALLOWED_CANDIDATE_CHANGE_KEYS)
    require(not unexpected_candidate_changes,
            "candidate inventory/count/evidence semantics changed: " +
            ", ".join(unexpected_candidate_changes))
    receipt["candidateChangedKeys"] = candidate_changes
    receipt["candidateInventoryAndEvidenceKeysPreserved"] = sorted(
        set(old_candidate) - ALLOWED_CANDIDATE_CHANGE_KEYS
    )
    metrics = {}
    for key, expected in EXPECTED_METRICS.items():
        value = new_candidate.get(key)
        metrics[key] = len(value) if isinstance(value, list) else None
        require(metrics[key] == expected,
                key + " count must remain " + str(expected) + ", observed " + str(metrics[key]))
    receipt["candidateMetrics"] = metrics

    require(new_candidate.get("revision") == args.source_commit,
            "candidateSource.revision does not name actual source commit")
    require("tree" not in new_candidate,
            "normal commit refresh must not also advertise a tree identity")
    require(new_candidate.get("sourceBindingsObject") == args.source_commit,
            "candidate sourceBindingsObject differs from source commit")
    source_tree = git("rev-parse", args.source_commit + "^{tree}").decode().strip()
    proof = new_candidate.get("sourceObjectProof", {})
    require(proof.get("objectType") == "commit", "sourceObjectProof objectType must remain commit")
    require(proof.get("rootTree") == source_tree,
            "sourceObjectProof rootTree differs from actual source commit tree")
    receipt["actualSourceTree"] = source_tree

    old_bindings = keyed(old_candidate.get("sourceBindings"), "path", "baseline sourceBindings")
    new_bindings = keyed(new_candidate.get("sourceBindings"), "path", "current sourceBindings")
    require(set(old_bindings) == set(new_bindings), "source binding path set changed")
    binding_deltas = []
    for path in sorted(set(old_bindings) & set(new_bindings)):
        if old_bindings[path] != new_bindings[path]:
            binding_deltas.append({
                "path": path,
                "baselineSha256": old_bindings[path].get("sha256"),
                "currentSha256": new_bindings[path].get("sha256"),
            })
    require([row["path"] for row in binding_deltas] == [LEDGER],
            "only the reviewed Website ledger may change its candidate source binding")
    receipt["sourceBindingDelta"] = binding_deltas

    committed_ledger = git("show", args.source_commit + ":" + LEDGER)
    current_ledger = (repo / LEDGER).read_bytes()
    ledger_digest = digest(committed_ledger)
    require(current_ledger == committed_ledger,
            "Website ledger working bytes differ from advertised source commit")
    require(new_bindings.get(LEDGER, {}).get("sha256") == ledger_digest,
            "Website ledger binding does not match advertised source commit bytes")
    receipt["websiteLedgerBinding"] = {
        "sha256": ledger_digest,
        "workingTreeMatchesSourceCommit": current_ledger == committed_ledger,
        "gitBlob": git("rev-parse", args.source_commit + ":" + LEDGER).decode().strip(),
        "bytes": len(committed_ledger),
    }
except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
    issues.append(str(error))

receipt["issues"] = issues
receipt["status"] = "passed" if not issues else "failed"
print(json.dumps(receipt, ensure_ascii=False, indent=2))
sys.exit(1 if issues else 0)
