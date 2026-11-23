#!/usr/bin/env python3
"""Pack the exact candidate and execute three independently reported public-App groups."""
import argparse
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

# Keep running the committed owner from creating untracked Python caches.
sys.dont_write_bytecode = True

from consumer_integrity import (
    bind_pack, dependency_closure, digest, owned_file, restore_old_cli,
    source_state, verify_installed,
)

HOSTS = ("wc", "react", "vue", "vue2")
FAMILIES = ("base", "shadcn", "brutalist")
GROUPS = ("tooltip", "select", "old-cli")
HELPERS = (
    "run.py", "consumer_integrity.py", "extract-authored.mjs",
    "build-consumer.mjs", "verify-native.mjs", "native-cleanup.mjs", "verify-result.mjs",
)
HERE = Path(__file__).resolve().parent


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n")


def expected_rows(group):
    if group == "tooltip":
        return [(family, host) for host in HOSTS for family in FAMILIES]
    if group == "select":
        return [("base", host) for host in HOSTS]
    if group == "old-cli":
        return [("shadcn", "react")]
    raise RuntimeError("Unknown installed public consumer group: " + group)


class OwnerInterrupted(BaseException):
    pass


_interruption_signal = None


def _mark_interrupted(signum):
    global _interruption_signal
    if _interruption_signal is None:
        _interruption_signal = int(signum)


def install_interrupt_handlers():
    previous = {}
    for signum in (signal.SIGINT, signal.SIGTERM):
        previous[signum] = signal.getsignal(signum)
        # Keep the handler non-throwing, including during Popen construction.
        # The command wait loop notices this sticky flag within 100 ms.
        signal.signal(signum, lambda received, frame: _mark_interrupted(received))
    return previous


def raise_if_interrupted():
    if _interruption_signal is not None:
        raise OwnerInterrupted("owner interrupted by " + signal.Signals(_interruption_signal).name)


def _signal_owned_group(child, signum):
    # Every child passed here was created below with start_new_session=True.
    # No caller-supplied pid, executable scan, or unrelated process is targeted.
    try:
        os.killpg(child.pid, signum)
        return True
    except ProcessLookupError:
        return False


def _retire_owned_group(child, grace=1.0):
    retirement = {"termSent": _signal_owned_group(child, signal.SIGTERM), "killSent": False}
    deadline = time.monotonic() + grace
    while time.monotonic() < deadline:
        child.poll()  # Reap the leader even if a descendant keeps its group alive.
        if not _signal_owned_group(child, 0):
            break
        time.sleep(0.02)
    if _signal_owned_group(child, 0):
        retirement["killSent"] = _signal_owned_group(child, signal.SIGKILL)
    try:
        retirement["exitCode"] = child.wait(timeout=2)
    except subprocess.TimeoutExpired:
        retirement["killSent"] = _signal_owned_group(child, signal.SIGKILL)
        retirement["exitCode"] = child.wait(timeout=2)
    return retirement


def run_command(argv, cwd, log, timeout, negative=False):
    raise_if_interrupted()
    started = now()
    timed_out = False
    retirement = None
    code = None
    cleanup_failure = None
    deadline = time.monotonic() + timeout
    with Path(log).open("wb") as stream:
        child = subprocess.Popen(argv, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            while True:
                if _interruption_signal is not None:
                    break
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    timed_out = True
                    break
                try:
                    code = child.wait(timeout=min(0.1, remaining))
                    break
                except subprocess.TimeoutExpired:
                    pass
        except KeyboardInterrupt:
            _mark_interrupted(signal.SIGINT)
        finally:
            if timed_out or _interruption_signal is not None or child.poll() is None:
                try:
                    retirement = _retire_owned_group(child)
                    code = retirement["exitCode"]
                except Exception as error:
                    cleanup_failure = repr(error)
                    # A failed TERM/grace attempt still gets an owned-group KILL.
                    try:
                        _signal_owned_group(child, signal.SIGKILL)
                        code = child.wait(timeout=2)
                    except Exception as final_error:
                        cleanup_failure += "; " + repr(final_error)
            else:
                code = child.returncode
    text = Path(log).read_text(errors="replace")
    interrupted = _interruption_signal is not None
    # The real unsupported-component CLI returns 1. Signals (negative codes),
    # timeouts, cancellation and arbitrary other failures cannot prove rejection.
    accepted = (
        not interrupted and not timed_out and not cleanup_failure
        and (code == 1 and "unsupported component" in text if negative else code == 0)
    )
    return {
        "argv": [str(value) for value in argv], "startedAt": started,
        "finishedAt": now(), "exitCode": code, "signal": -code if code is not None and code < 0 else None,
        "timeout": timed_out, "interrupted": interrupted, "interruptionSignal": _interruption_signal,
        "status": "interrupted" if interrupted else "passed" if accepted else "failed",
        "expectedRejection": negative, "retirement": retirement, "cleanupFailure": cleanup_failure,
        "log": str(log), "logSha256": digest(log),
    }


def roots_for(group, family, host):
    adapter = "web-component" if host == "wc" else host
    roots = ["@proto.ui/cli", "@proto.ui/adapter-" + adapter, "@proto.ui/prototypes-" + family]
    # Modern init loads an embedded style preset; it does not generate or
    # import Shadcn facades. Base consumers keep their actual public closure.
    if group == "select":
        roots.append("@proto.ui/prototypes-lucide")
    return sorted(set(roots))


def install_authored(app, group, family, host, authored):
    if group != "select":
        displayed = authored["tooltip"][family][host]
    else:
        code = authored["select"][host]["demo-base-select"]
        name = "index.html" if host == "wc" else "src/App.tsx" if host == "react" else "src/App.vue"
        displayed = [{"name": name, "code": code}]
    for item in displayed:
        name = Path(item["name"])
        if name.is_absolute() or ".." in name.parts:
            raise RuntimeError("Authored example path escaped its App")
        target = app / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item["code"] + "\n")
    files = [{"path": item["name"], "sha256": digest(app / item["name"])} for item in displayed]
    if host == "wc":
        if group == "select":
            modules = re.findall(r'<script type="module">([\s\S]*?)</script>', (app / "index.html").read_text())
            if len(modules) != 1:
                raise RuntimeError("Select HTML must contain its one public application module")
            (app / "main.js").write_text(modules[0])
            entry = "main.js"
        else:
            entry = "src/main.ts"
    else:
        entry = "src/main.tsx" if host == "react" else "src/main.js"
        bootstrap = {
            "react": (
                "import * as React from 'react';\nimport {createRoot} from 'react-dom/client';\n"
                "import App from './App';\nconst mount=document.querySelector('#app');\n"
                "if(!mount) throw new Error('Missing #app');\nconst root=createRoot(mount);\n"
                "root.render(<App/>);\nObject.assign(window,{disposePublicConsumer:()=>root.unmount()});\n"
            ),
            "vue": (
                "import {createApp} from 'vue';\nimport App from './App.vue';\n"
                "const app=createApp(App);\napp.mount('#app');\n"
                "Object.assign(window,{disposePublicConsumer:()=>app.unmount()});\n"
            ),
            "vue2": (
                "import Vue from 'vue';\nimport App from './App.vue';\n"
                "const app=new Vue({render:h=>h(App)}).$mount('#app');\n"
                "Object.assign(window,{disposePublicConsumer:()=>{app.$destroy();app.$el.remove();}});\n"
            ),
        }[host]
        (app / entry).write_text(bootstrap)
    return files, entry


def write_browser_html(app, group, family, host):
    marker = "select" if group == "select" else "tooltip"
    if host == "wc" and group == "select":
        source = (app / "index.html").read_text()
        html, count = re.subn(r'<script type="module">[\s\S]*?</script>',
                             '<script type="module" src="./app.js"></script>', source)
        if count != 1 or html.count("<body>") != 1 or html.count("</body>") != 1 or html.count("</head>") != 1:
            raise RuntimeError("Unexpected authored Select HTML document")
        html = html.replace("<body>", '<body><main data-select-public-app="base-wc">').replace("</body>", "</main></body>")
        html = html.replace("</head>", '<link rel="icon" href="data:,"><link rel="stylesheet" href="./app.css"></head>')
    else:
        if host == "wc":
            source = (app / "index.html").read_text()
            module = '<script type="module" src="/src/main.ts"></script>'
            if source.count(module) != 1:
                raise RuntimeError("Unexpected authored Tooltip HTML entry")
            markup = source.replace(module, "")
        else:
            markup = '<div id="app"></div>'
        html = (
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<link rel="icon" href="data:,"><title>Public ' + marker + " · " + family + " · " + host + '</title>'
            '<link rel="stylesheet" href="./app.css"></head><body><main data-' + marker + '-public-app="' +
            family + "-" + host + '">' + markup + '</main><script type="module" src="./app.js"></script></body></html>'
        )
    (app / "dist/index.html").write_text(html)


def prepare_group(repo, output, group, candidate, binding, authored, old_cli, npm_cli, pipeline, save_pipeline):
    directory = output / group
    directory.mkdir()
    write_json(directory / "pack-binding.json", binding)
    consumer_binding = copy.deepcopy(binding)
    overrides = []
    if group == "old-cli":
        consumer_binding["packages"]["@proto.ui/cli"] = old_cli["artifact"]
        if old_cli["artifact"]["sha256"] == binding["packages"]["@proto.ui/cli"]["sha256"]:
            raise RuntimeError("Current CLI is identical to the known broken control")
        overrides = [old_cli]
    manifests = {name: item["manifest"] for name, item in consumer_binding["packages"].items()}
    report = {
        "schemaVersion": 2, "kind": "packed-installed-public-usage", "group": group,
        "sourceHead": candidate, "fullSourceBefore": source_state(repo),
        "sourceFiles": authored["sourceFiles"], "authoredFilesSha256": digest(output / "authored-files.json"),
        "packBindingSha256": digest(directory / "pack-binding.json"),
        "packBindingAfter": None, "packageOverrides": overrides,
        "startedAt": now(), "status": "running", "browserAcceptance": "not-run",
        "buildDriverSha256": digest(HERE / "build-consumer.mjs"),
        "rows": [{"family": family, "host": host, "status": "not-run", "steps": []} for family, host in expected_rows(group)],
    }
    save = lambda: write_json(directory / "execution.json", report)
    save()
    try:
        for row in report["rows"]:
            raise_if_interrupted()
            family, host = row["family"], row["host"]
            app = directory / (family + "-" + host)
            app.mkdir()
            row["status"] = "running"
            save()

            def step(name, argv, negative=False):
                result = run_command(argv, app, app / (name + ".log"), 300, negative)
                result["name"] = name
                row["steps"].append(result)
                save()
                raise_if_interrupted()
                if result["status"] != "passed":
                    raise RuntimeError(name + " failed: " + result["log"])

            try:
                selected = dependency_closure(manifests, roots_for(group, family, host))
                dependencies = {name: "file:" + consumer_binding["packages"][name]["path"] for name in selected}
                tools = {"esbuild": "0.25.12", "typescript": "5.9.3"}
                if host == "react":
                    dependencies.update({"react": "19.2.6", "react-dom": "19.2.6"})
                    tools.update({"@types/react": "19.2.14", "@types/react-dom": "19.2.3"})
                if host == "vue":
                    dependencies["vue"] = "3.5.31"
                    tools["@vue/compiler-sfc"] = "3.5.31"
                if host == "vue2":
                    dependencies["vue"] = "2.6.14"
                    tools.update({"vue-template-compiler": "2.6.14", "vue-template-es2015-compiler": "1.9.1"})
                row["authoredFiles"], entry = install_authored(app, group, family, host, authored)
                row["entry"] = {"path": entry, "sha256": digest(app / entry)}
                pkg = {
                    "name": "installed-public-" + group + "-" + family + "-" + host,
                    "private": True, "version": "0.0.0", "type": "module",
                    "publicConsumer": {"group": group, "family": family, "host": host, "entry": entry},
                    "dependencies": dependencies, "devDependencies": tools,
                }
                write_json(app / "package.json", pkg)
                shutil.copyfile(HERE / "build-consumer.mjs", app / "build.mjs")
                step("install", ["node", str(npm_cli), "install", "--no-audit", "--no-fund", "--ignore-scripts",
                                 "--prefer-offline", "--fetch-timeout=20000", "--fetch-retries=0"])
                row["lockSha256"] = digest(app / "package-lock.json")
                row["installedArtifactsBefore"] = verify_installed(app, selected, consumer_binding)
                row["selectedPackages"] = selected
                row["installedPackageSha256"] = {name: consumer_binding["packages"][name]["sha256"] for name in selected}
                cli = "node_modules/@proto.ui/cli/bin/proto-ui.js"
                step("init", ["node", cli, "init", "--yes", "--no-interactive", "--prototypes",
                              "brutalist" if family == "brutalist" else "shadcn"])
                if group != "select":
                    before = digest(app / "proto-ui/config.json")
                    step("add", ["node", cli, "add", host, family + "-tooltip", "--no-install", "--no-interactive"],
                         negative=family != "shadcn")
                    if family != "shadcn" and digest(app / "proto-ui/config.json") != before:
                        raise RuntimeError("Rejected add mutated configuration")
                step("build", ["node", "--max-old-space-size=512", "build.mjs"])
                write_browser_html(app, group, family, host)
                row["authoredFilesAfter"] = [{"path": item["path"], "sha256": digest(app / item["path"])} for item in row["authoredFiles"]]
                if row["authoredFilesAfter"] != row["authoredFiles"] or digest(app / entry) != row["entry"]["sha256"]:
                    raise RuntimeError("Authored App or bootstrap changed during preparation")
                if digest(app / "build.mjs") != report["buildDriverSha256"]:
                    raise RuntimeError("Copied build helper changed")
                row["installedArtifactsAfter"] = verify_installed(app, selected, consumer_binding)
                row["generatedFiles"] = [
                    {"path": str(p.relative_to(app)), "sha256": digest(p)}
                    for parent in (app / "proto-ui", app / "src/styles")
                    for p in sorted(parent.rglob("*")) if p.is_file()
                ]
                row["outputs"] = [
                    {"path": str(p.relative_to(app)), "sha256": digest(p), "bytes": p.stat().st_size}
                    for p in sorted((app / "dist").rglob("*")) if p.is_file()
                ]
                row["buildChecks"] = json.loads((app / "build-checks.json").read_text())
                row["status"] = "passed"
            except Exception as error:
                row.update({"status": "failed", "failure": repr(error)})
            save()
            print(group + "/" + family + "/" + host + ": " + row["status"], flush=True)
    except OwnerInterrupted as error:
        report["failure"] = repr(error)
    except KeyboardInterrupt as error:
        _mark_interrupted(signal.SIGINT)
        report["failure"] = repr(error)
    except Exception as error:
        report["failure"] = repr(error)
    finally:
        report["interrupted"] = _interruption_signal is not None
        for row in report["rows"]:
            if row["status"] == "running":
                row["status"] = "interrupted" if report["interrupted"] else "failed"
        report["finishedAt"] = now()
        report["fullSourceAfter"] = source_state(repo)
        report["status"] = "interrupted" if report["interrupted"] else "passed" if not report.get("failure") and all(row["status"] == "passed" for row in report["rows"]) else "failed"
        try:
            report["packBindingAfter"] = bind_pack(repo, output, candidate)
            if report["packBindingAfter"] != binding or report["fullSourceBefore"] != report["fullSourceAfter"]:
                raise RuntimeError("Source or pack drifted during consumer preparation")
            for item in report["sourceFiles"]:
                if digest(owned_file(repo, item["path"])) != item["sha256"]:
                    raise RuntimeError("Authored generator changed")
            if group == "old-cli" and digest(old_cli["artifact"]["path"]) != old_cli["artifact"]["sha256"]:
                raise RuntimeError("Historical CLI changed during preparation")
        except Exception as error:
            report.update({"status": "failed", "integrityFailure": repr(error)})
        save()
    pipeline["rows"][GROUPS.index(group) + 1].update({
        "status": report["status"], "receipt": str(directory / "execution.json"),
        "receiptSha256": digest(directory / "execution.json"),
    })
    save_pipeline()
    raise_if_interrupted()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--old-cli-record", default=str(HERE / "fixtures/old-cli-830287.provenance.json"),
                        help="Pinned baseline provenance; also accepts the original recovered-old-cli.json")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.candidate):
        parser.error("--candidate must be the full lowercase commit SHA")
    repo = Path(args.repository).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists() or output.is_relative_to(repo):
        parser.error("--output must be new and outside the candidate checkout")
    if not os.environ.get("CHROME_PATH"):
        parser.error("CHROME_PATH must select the installed sandbox-capable browser")
    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    if not node_version.startswith("v24."):
        parser.error("The canonical owner requires Node 24 on PATH; got " + node_version)
    before = source_state(repo)
    if before["head"] != args.candidate or before["status"]:
        parser.error("The requested candidate checkout must be exact and clean")
    output.mkdir(parents=True)
    report = {
        "schemaVersion": 1, "kind": "installed-public-consumer-pipeline",
        "candidate": args.candidate, "sourceBefore": before, "node": node_version, "python": sys.version,
        "lockfileSha256": digest(repo / "pnpm-lock.yaml"),
        "helpersBefore": {name: digest(HERE / name) for name in HELPERS},
        "startedAt": now(), "status": "running",
        "rows": [{"name": name, "status": "not-run"} for name in
                 ("pack", "tooltip-preparation", "select-preparation", "old-cli-preparation",
                  "tooltip-native", "select-native", "old-cli-native")],
    }
    save = lambda: write_json(output / "pipeline.json", report)
    save()
    install_interrupt_handlers()
    try:
        old_cli = restore_old_cli(args.old_cli_record, output / "old-cli.tgz")
        write_json(output / "old-cli-binding.json", old_cli)
        extraction = run_command(["node", str(HERE / "extract-authored.mjs"), str(repo), str(output / "authored-files.json")],
                                 repo, output / "extract.log", 120)
        report["extraction"] = extraction
        save()
        if extraction["status"] != "passed":
            raise RuntimeError("Public source extraction failed")
        raise_if_interrupted()
        authored = json.loads((output / "authored-files.json").read_text())
        report["authoredFilesSha256"] = digest(output / "authored-files.json")
        save()
        roots = sorted({name for group in ("tooltip", "select") for family, host in expected_rows(group)
                        for name in roots_for(group, family, host)})
        scope = dependency_closure(authored["workspacePackages"], roots)
        write_json(output / "pack-scope.json", {"roots": roots, "packages": scope})
        command = ["node", "scripts/release/publish.mjs", "--pack", "--only", ",".join(scope),
                   "--out-dir", str(output / "packed-release")]
        report["rows"][0]["status"] = "running"
        save()
        packed = run_command(command, repo, output / "pack.log", 1800)
        packed.update({"sourceBefore": before, "sourceAfter": source_state(repo), "scope": scope})
        manifest = output / "packed-release/pack-manifest.json"
        if manifest.is_file():
            packed["packManifestSha256"] = digest(manifest)
        if packed["sourceAfter"] != before or not manifest.is_file():
            packed["status"] = "failed"
        write_json(output / "pack-execution.json", packed)
        report["rows"][0].update({"status": packed["status"], "receipt": str(output / "pack-execution.json"),
                                  "receiptSha256": digest(output / "pack-execution.json")})
        save()
        if packed["status"] != "passed":
            raise RuntimeError("Owned candidate pack failed")
        binding = bind_pack(repo, output, args.candidate)
        write_json(output / "pack-binding.json", binding)
        npm_cli = repo / "node_modules/npm/bin/npm-cli.js"
        if not npm_cli.is_file():
            raise RuntimeError("Frozen workspace npm dependency is missing")
        preparations = {}
        for group in GROUPS:
            raise_if_interrupted()
            report["rows"][GROUPS.index(group) + 1]["status"] = "running"
            save()
            preparations[group] = prepare_group(repo, output, group, args.candidate, binding, authored, old_cli, npm_cli, report, save)
        for index, group in enumerate(GROUPS):
            raise_if_interrupted()
            row = report["rows"][index + 4]
            if preparations[group]["status"] != "passed":
                row["reason"] = "The group's actual preparation did not pass"
                save()
                continue
            row["status"] = "running"
            save()
            result = run_command([
                "node", str(HERE / "verify-native.mjs"), str(output / group), str(repo),
                str(output / (group + "-native")), group, args.candidate,
            ], repo, output / (group + "-native.log"), 600)
            row.update(result)
            native = output / (group + "-native/native.json")
            if native.is_file():
                native_report = json.loads(native.read_text())
                row.update({"receipt": str(native), "receiptSha256": digest(native)})
                if result["status"] != "interrupted" and native_report["status"] != "passed":
                    row["status"] = "failed"
            else:
                row.update({"status": "interrupted" if result["status"] == "interrupted" else "failed", "failure": "Native receipt missing"})
            save()
            raise_if_interrupted()
    except OwnerInterrupted as error:
        report["failure"] = repr(error)
    except KeyboardInterrupt as error:
        _mark_interrupted(signal.SIGINT)
        report["failure"] = repr(error)
    except Exception as error:
        report["failure"] = repr(error)
    finally:
        report["interrupted"] = _interruption_signal is not None
        report["interruptionSignal"] = _interruption_signal
        report["sourceAfter"] = source_state(repo)
        report["helpersAfter"] = {name: digest(HERE / name) for name in HELPERS}
        report["finishedAt"] = now()
        report["status"] = "passed" if (
            not report["interrupted"] and not report.get("failure") and all(row["status"] == "passed" for row in report["rows"])
            and report["sourceAfter"] == before and report["helpersAfter"] == report["helpersBefore"]
            and digest(repo / "pnpm-lock.yaml") == report["lockfileSha256"]
        ) else "failed"
        for row in report["rows"]:
            if row["status"] == "running":
                row.update({"status": "interrupted" if report["interrupted"] else "failed", "failure": "Interrupted before terminal evidence"})
        if report["interrupted"]:
            report["status"] = "interrupted"
        save()
    print(json.dumps({"status": report["status"], "rows": [{"name": r["name"], "status": r["status"]} for r in report["rows"]]}))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
