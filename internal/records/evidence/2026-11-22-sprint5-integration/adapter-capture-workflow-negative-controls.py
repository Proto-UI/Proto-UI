from pathlib import Path
import copy
import json
import re
import subprocess
import sys

root = Path("/workspace/scratch/3c698ea06f1e/s5-adapter-capture")
yaml = (root / ".github/workflows/gpui-adapter-acceptance.yml").read_text()
match = re.search(r"if node -e '([\s\S]*?)' \"\$EVIDENCE/accesskit/", yaml)
if match is None:
    raise RuntimeError("native pixel receipt gate missing from workflow")
source = match.group(1)
directory = Path("/workspace/scratch/3c698ea06f1e/adapter-capture-workflow-negative-controls")
directory.mkdir(exist_ok=True)
(directory / "workflow-receipt-gate.cjs").write_text(source)
base = {
    "rule": "two-label-content-v1", "passed": True, "pixelGatePassed": True,
    "platformFrames": {"callbacks": 2, "visible": True, "error": None},
    "labels": [{"label": "passive", "passed": True}, {"label": "actionable", "passed": True}],
}
cases = [("valid-current-receipt", base, True)]
for name, mutate in [
    ("missing-frames", lambda r: r.pop("platformFrames")),
    ("missing-callbacks", lambda r: r["platformFrames"].pop("callbacks")),
    ("string-callbacks", lambda r: r["platformFrames"].update(callbacks="2")),
    ("fractional-callbacks", lambda r: r["platformFrames"].update(callbacks=2.5)),
    ("one-callback", lambda r: r["platformFrames"].update(callbacks=1)),
    ("null-callbacks", lambda r: r["platformFrames"].update(callbacks=None)),
    ("occluded-window", lambda r: r["platformFrames"].update(visible=False)),
    ("frame-timeout", lambda r: r["platformFrames"].update(error="timed out")),
    ("black-content", lambda r: r.update(pixelGatePassed=False)),
    ("overall-failure", lambda r: r.update(passed=False)),
    ("missing-one-label", lambda r: r["labels"].pop()),
    ("second-label-failed", lambda r: r["labels"][1].update(passed=False)),
    ("wrong-label-identity", lambda r: r["labels"][1].update(label="passive")),
    ("unknown-rule", lambda r: r.update(rule="file-only")),
]:
    data = copy.deepcopy(base)
    mutate(data)
    cases.append((name, data, False))
failures = []
for name, data, expected in cases:
    receipt = directory / f"{name}.json"
    receipt.write_text(json.dumps(data))
    result = subprocess.run(["node", "-e", source, str(receipt)], capture_output=True, text=True)
    accepted = result.returncode == 0
    print(f"{name}: exit={result.returncode}; accepted={accepted}; expected={expected}")
    if accepted != expected:
        failures.append(name)
print(f"workflow source gate: {len(cases)-len(failures)}/{len(cases)} passed")
if failures:
    raise SystemExit("unexpected gate results: " + ", ".join(failures))
