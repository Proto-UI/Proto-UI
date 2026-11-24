"""Record actual receipt times using Linux CLOCK_MONOTONIC across short processes.

This utility records observations, not authenticated participant behavior. Every
event still needs actual command, source, or browser evidence. No persistent PTY
or reconstruction from wall-clock timestamps is used.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


parser = argparse.ArgumentParser()
parser.add_argument("--root", required=True)
parser.add_argument("operation", choices=["release", "event", "command", "finish"])
parser.add_argument("arguments", nargs=argparse.REMAINDER)
options = parser.parse_args()
root = Path(options.root).resolve(strict=True)
measurement = root / "measurement"
measurement.mkdir(exist_ok=True)
boot_hash = digest(Path("/proc/sys/kernel/random/boot_id").read_bytes())


def ref(value):
    if isinstance(value, dict):
        value = value["path"]
    target = (root / value).resolve(strict=True)
    relative = target.relative_to(root)
    if not target.is_file():
        raise ValueError("Evidence must be a regular file")
    return {"path": relative.as_posix(), "sha256": digest(target.read_bytes())}


def append_event(event):
    if "atMs" in event:
        raise ValueError("The recorder supplies actual receipt offsets")
    if not all(isinstance(event.get(key), str) and event[key] for key in ["kind", "stage", "detail"]):
        raise ValueError("Event requires kind, stage, detail")
    if not event.get("evidence"):
        raise ValueError("Event requires raw evidence")
    event = dict(event)
    event["evidence"] = [ref(value) for value in event["evidence"]]
    for key in ["before", "after", "diff", "installedLockfile", "build"]:
        if key in event:
            event[key] = ref(event[key])
    if "shippedFiles" in event:
        event["shippedFiles"] = [ref(value) for value in event["shippedFiles"]]
    mono = time.clock_gettime_ns(time.CLOCK_MONOTONIC)
    event["atMs"] = (mono - release["systemMonotonicNs"]) / 1_000_000
    receipt = {"receivedAt": utc(), "systemMonotonicNs": mono, "event": event}
    with (measurement / "received.jsonl").open("a") as file:
        file.write(json.dumps(receipt, ensure_ascii=False) + "\n")
        file.flush()
        os.fsync(file.fileno())
    events = json.loads((measurement / "events.json").read_text())
    events.append(event)
    atomic_json(measurement / "events.json", events)
    print(json.dumps({"recorded": event["kind"], "stage": event["stage"], "atMs": event["atMs"], "receivedAt": receipt["receivedAt"]}))


with (measurement / "writer.lock").open("a") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if options.operation == "release":
        if (measurement / "release.json").exists() or len(options.arguments) != 3:
            raise ValueError("Fresh release requires protocol SHA, task SHA and alias")
        protocol_hash, task_hash, alias = options.arguments
        release = {"protocolSha256": protocol_hash, "taskSha256": task_hash, "participantAlias": alias,
                   "startedAt": utc(), "systemMonotonicNs": time.clock_gettime_ns(time.CLOCK_MONOTONIC),
                   "bootIdentitySha256": boot_hash, "clockImplementation": "Linux CLOCK_MONOTONIC via Python clock_gettime_ns",
                   "python": sys.version, "platform": platform.platform(),
                   "attribution": "Actual operator release-request bracket before task dispatch; first participant command is separately recorded."}
        atomic_json(measurement / "release.json", release)
        atomic_json(measurement / "events.json", [])
        print(json.dumps(release))
        sys.exit(0)
    release = json.loads((measurement / "release.json").read_text())
    if release["bootIdentitySha256"] != boot_hash:
        raise ValueError("Monotonic clock epoch changed; retain interruption, do not reconstruct")
    if (measurement / "clock.json").exists():
        raise ValueError("Run has already ended")
    if options.operation == "event":
        if len(options.arguments) != 1:
            raise ValueError("event requires one JSON event-file path")
        append_event(json.loads((root / options.arguments[0]).read_text()))
    elif options.operation == "command":
        stage, label, cwd, *argv = options.arguments
        if argv and argv[0] == "--":
            argv.pop(0)
        if not label.replace("-", "").replace("_", "").isalnum() or not argv:
            raise ValueError("Use a unique safe label and actual argv")
        directory = measurement / "commands"
        directory.mkdir(exist_ok=True)
        receipt_path = directory / (label + ".json")
        if receipt_path.exists():
            raise ValueError("Retain each command attempt under a new label")
        started = utc()
        error = None
        try:
            completed = subprocess.run(argv, cwd=(root / cwd).resolve(strict=True), capture_output=True)
            stdout, stderr, code = completed.stdout, completed.stderr, completed.returncode
        except Exception as exception:
            stdout, stderr, code, error = b"", str(exception).encode(), None, repr(exception)
        (directory / (label + ".stdout.log")).write_bytes(stdout)
        (directory / (label + ".stderr.log")).write_bytes(stderr)
        receipt = {"argv": argv, "cwd": str((root / cwd).resolve()), "startedAt": started, "finishedAt": utc(),
                   "exitCode": code if code is None or code >= 0 else None, "signal": -code if code is not None and code < 0 else None,
                   "error": error, "stdout": ref(str((directory / (label + ".stdout.log")).relative_to(root))),
                   "stderr": ref(str((directory / (label + ".stderr.log")).relative_to(root)))}
        atomic_json(receipt_path, receipt)
        append_event({"kind": "step", "stage": stage, "detail": f"Actual command {label}: exit={code}; error={error}",
                      "evidence": [str(receipt_path.relative_to(root))]})
        print(json.dumps({"receipt": str(receipt_path.relative_to(root)), "exitCode": code, "error": error}))
    else:
        ended = (time.clock_gettime_ns(time.CLOCK_MONOTONIC) - release["systemMonotonicNs"]) / 1_000_000
        clock = {"clock": "monotonic-ms-from-task-release", "startedAt": release["startedAt"], "endedMs": ended,
                 "outcome": "finished", "finishedAt": utc(),
                 "attribution": "Actual event-receipt offsets. Transport and operator/browser delays remain included and separately described."}
        atomic_json(measurement / "clock.json", clock)
        print(json.dumps(clock))
