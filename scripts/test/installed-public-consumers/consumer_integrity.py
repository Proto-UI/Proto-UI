"""Integrity helpers retained from the c8a5cf installed Tooltip experiment."""
from pathlib import Path
import base64
import hashlib
import json
import subprocess
import tarfile

OLD_CLI_SHA256 = "0dd1537bdb151fa6f265df07c1ba35cef37adc20b7e2e7c69e7e0f2e60b7af9d"
OLD_CLI_ARCHIVE_SHA256 = "8a0ff2bc26bf2321a50a33e88edc1ea2ce3d9946ba6e73465f87a7ebda8e2885"
OLD_CLI_MEMBER = "tooltip-public-consumers-history/baseline-history/pack/tarballs/proto.ui-cli-0.3.0-alpha.2.tgz"
OLD_CLI_ENTRY = {
    "name": "@proto.ui/cli",
    "version": "0.3.0-alpha.2",
    "integrity": "sha512-GdhBL9LzW5zrVkxL7eoVeM4kMAwLeMC08A77/slqfKY39BmW1ZMdZnxy1tjB9C6JuUCWC/mdJIi42iq8MpWafw==",
    "shasum": "94d9f42b5a331a430e7738f25677519405e39a6b",
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_state(repo):
    return {
        key: subprocess.check_output(["git", *args], cwd=repo).decode().strip()
        for key, args in {
            "head": ["rev-parse", "HEAD"],
            "tree": ["rev-parse", "HEAD^{tree}"],
            "status": ["status", "--porcelain=v1", "--untracked-files=all"],
        }.items()
    }


def owned_file(root, relative):
    root = Path(root).resolve()
    path = Path(relative)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        raise RuntimeError("Invalid artifact path: " + str(relative))
    target = root / path
    current = root
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise RuntimeError("Artifact path contains a symlink: " + str(relative))
    if not target.is_file() or not target.resolve().is_relative_to(root):
        raise RuntimeError("Artifact is not an owned regular file: " + str(relative))
    return target


def checked_tarball(path, entry):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise RuntimeError("Tarball must be a regular owned file: " + str(path))
    content = path.read_bytes()
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(content).digest()).decode()
    shasum = hashlib.sha1(content).hexdigest()
    if integrity != entry["integrity"] or shasum != entry["shasum"]:
        raise RuntimeError("Tarball differs from its original pack manifest: " + entry["name"])
    files = {}
    package = None
    with tarfile.open(path, "r:gz") as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            if not member.isfile() or not member.name.startswith("package/"):
                raise RuntimeError("Unexpected package archive entry")
            name = member.name[len("package/"):]
            if not name or ".." in Path(name).parts or name.startswith("/") or name in files:
                raise RuntimeError("Invalid package member path")
            data = archive.extractfile(member).read()
            files[name] = hashlib.sha256(data).hexdigest()
            if name == "package.json":
                package = json.loads(data)
    if not package or package.get("name") != entry["name"] or package.get("version") != entry["version"]:
        raise RuntimeError("Packed package identity differs from its manifest")
    return {
        "path": str(path.resolve()),
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "integrity": integrity,
        "shasum": shasum,
        "manifest": package,
        "files": dict(sorted(files.items())),
    }


def bind_pack(repo, evidence, expected_head):
    evidence = Path(evidence)
    pack = evidence / "packed-release"
    receipt_path = owned_file(evidence, "pack-execution.json")
    manifest_path = owned_file(pack, "pack-manifest.json")
    receipt = json.loads(receipt_path.read_text())
    manifest = json.loads(manifest_path.read_text())
    state = source_state(repo)
    if receipt.get("status") != "passed" or receipt.get("exitCode") != 0:
        raise RuntimeError("Pack did not pass")
    if receipt.get("sourceBefore") != receipt.get("sourceAfter") or receipt["sourceBefore"] != state:
        raise RuntimeError("Pack/source binding drift")
    if state["head"] != expected_head or state["status"]:
        raise RuntimeError("Expected the exact clean candidate")
    manifest_digest = digest(manifest_path)
    if manifest_digest != receipt["packManifestSha256"]:
        raise RuntimeError("Manifest changed after the owned pack")
    entries = manifest["packages"]
    names = [entry["name"] for entry in entries]
    if len(names) != len(set(names)) or sorted(names) != sorted(receipt["scope"]):
        raise RuntimeError("Pack scope differs from the owned command")
    if any(entry["version"] != manifest["releaseVersion"] for entry in entries):
        raise RuntimeError("Mixed versions in pack manifest")
    artifacts = {
        entry["name"]: checked_tarball(owned_file(pack, entry["tarball"]), entry)
        for entry in entries
    }
    return {
        "source": state,
        "packReceiptSha256": digest(receipt_path),
        "packManifestSha256": manifest_digest,
        "releaseVersion": manifest["releaseVersion"],
        "packages": artifacts,
    }


def dependency_closure(manifests, roots):
    pending = list(roots)
    seen = set()
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        if name not in manifests:
            raise RuntimeError("Missing internal dependency: " + name)
        seen.add(name)
        for field in ("dependencies", "optionalDependencies", "peerDependencies"):
            pending.extend(n for n in manifests[name].get(field, {}) if n.startswith("@proto.ui/"))
    return sorted(seen)


def verify_installed(app, selected, binding):
    app = Path(app)
    records = {}
    actual = sorted("@proto.ui/" + p.name for p in (app / "node_modules/@proto.ui").iterdir() if p.is_dir())
    if actual != sorted(selected):
        raise RuntimeError("Installed Proto UI closure differs from selected tarballs")
    for name in selected:
        expected = binding["packages"][name]["files"]
        root = app / "node_modules" / name
        if root.is_symlink():
            raise RuntimeError("Installed Proto UI package is linked to a workspace: " + name)
        for relative, checksum in expected.items():
            if digest(owned_file(root, relative)) != checksum:
                raise RuntimeError("Installed package bytes differ from its tarball: " + name + "/" + relative)
        records[name] = {
            "files": len(expected),
            "digest": hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        }
    return records


def restore_old_cli(record_path, destination):
    record = json.loads(Path(record_path).read_text())
    if record.get("archiveSha256") != OLD_CLI_ARCHIVE_SHA256 or record.get("member") != OLD_CLI_MEMBER:
        raise RuntimeError("Unexpected historical CLI archive/member")
    content = (base64.b64decode(record["base64"], validate=True) if "base64" in record
               else owned_file(Path(record_path).resolve().parent, record["tarball"]).read_bytes())
    if len(content) != 198259 or record.get("bytes") != 198259 or hashlib.sha256(content).hexdigest() != OLD_CLI_SHA256 or record.get("sha256") != OLD_CLI_SHA256:
        raise RuntimeError("Historical CLI bytes differ from the recovered archive")
    entries = ([record["packManifestEntry"]] if "packManifestEntry" in record
               else [p for p in record["packManifest"]["packages"] if p["name"] == "@proto.ui/cli"])
    if len(entries) != 1 or any(entries[0].get(k) != v for k, v in OLD_CLI_ENTRY.items()):
        raise RuntimeError("Historical CLI manifest identity changed")
    destination = Path(destination)
    destination.write_bytes(content)
    artifact = checked_tarball(destination, OLD_CLI_ENTRY)
    return {
        "sourceHead": "830287f95959a4a1a4fb797df68b0bd6889e0bae",
        "archiveSha256": OLD_CLI_ARCHIVE_SHA256,
        "member": OLD_CLI_MEMBER,
        "recordSha256": digest(record_path),
        "artifact": artifact,
    }
