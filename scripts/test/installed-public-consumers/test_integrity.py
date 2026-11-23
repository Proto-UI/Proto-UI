import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from consumer_integrity import (
    OLD_CLI_SHA256, checked_tarball, dependency_closure, restore_old_cli, verify_installed,
)


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="installed-public-integrity-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def package(self, filename, code):
        target = self.root / filename
        manifest = {"name": "@proto.ui/example", "version": "0.3.0-alpha.2"}
        with tarfile.open(target, "w:gz") as archive:
            for name, text in [("package.json", json.dumps(manifest)), ("dist/index.js", code)]:
                content = text.encode()
                info = tarfile.TarInfo("package/" + name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        content = target.read_bytes()
        entry = {
            **manifest,
            "integrity": "sha512-" + base64.b64encode(hashlib.sha512(content).digest()).decode(),
            "shasum": hashlib.sha1(content).hexdigest(),
        }
        return target, entry

    def test_same_version_is_not_a_substitute_for_packed_bytes(self):
        current, entry = self.package("current.tgz", "export const portal = true;")
        old, _ = self.package("old.tgz", "export const portal = false;")
        checked_tarball(current, entry)
        with self.assertRaisesRegex(RuntimeError, "differs from its original pack manifest"):
            checked_tarball(old, entry)

    def test_installed_bytes_and_symlinked_sources_are_rejected(self):
        tarball, entry = self.package("package.tgz", "export const portal = true;")
        artifact = checked_tarball(tarball, entry)
        app = self.root / "app"
        installed = app / "node_modules/@proto.ui/example"
        (installed / "dist").mkdir(parents=True)
        with tarfile.open(tarball, "r:gz") as archive:
            for name in artifact["files"]:
                (installed / name).write_bytes(archive.extractfile("package/" + name).read())
        binding = {"packages": {"@proto.ui/example": artifact}}
        verify_installed(app, ["@proto.ui/example"], binding)
        (installed / "dist/index.js").write_text("export const portal = false;")
        with self.assertRaisesRegex(RuntimeError, "bytes differ"):
            verify_installed(app, ["@proto.ui/example"], binding)
        (installed / "dist/index.js").unlink()
        linked = self.root / "workspace.js"
        linked.write_text("export const portal = true;")
        (installed / "dist/index.js").symlink_to(linked)
        with self.assertRaisesRegex(RuntimeError, "symlink"):
            verify_installed(app, ["@proto.ui/example"], binding)

    def test_internal_optional_and_peer_dependencies_cannot_fall_through_to_registry(self):
        manifests = {
            "@proto.ui/app": {
                "dependencies": {"@proto.ui/core": "workspace:*"},
                "optionalDependencies": {"@proto.ui/optional": "workspace:*"},
                "peerDependencies": {"@proto.ui/peer": "workspace:*", "react": "19"},
            },
            "@proto.ui/core": {}, "@proto.ui/optional": {}, "@proto.ui/peer": {},
        }
        self.assertEqual(dependency_closure(manifests, ["@proto.ui/app"]), sorted(manifests))
        del manifests["@proto.ui/peer"]
        with self.assertRaisesRegex(RuntimeError, "Missing internal dependency"):
            dependency_closure(manifests, ["@proto.ui/app"])

    def test_original_cli_fixture_retains_its_pinned_bytes(self):
        fixture = Path(__file__).resolve().parent / "fixtures/old-cli-830287.provenance.json"
        result = restore_old_cli(fixture, self.root / "old-cli.tgz")
        self.assertEqual(result["artifact"]["sha256"], OLD_CLI_SHA256)
        self.assertEqual(result["artifact"]["manifest"]["name"], "@proto.ui/cli")
        self.assertEqual(result["artifact"]["bytes"], 198259)


if __name__ == "__main__":
    unittest.main()
