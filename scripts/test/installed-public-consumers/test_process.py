"""Exercise real owned process groups; no browser/package build is needed."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

from run import run_command

HERE = Path(__file__).resolve().parent


@unittest.skipUnless(sys.platform.startswith("linux"), "owned descendant checks use Linux /proc")
class ProcessTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="installed-public-process-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def command(self, source, timeout=5, negative=False):
        return run_command([sys.executable, "-B", "-c", source], self.root,
                           self.root / ("command-" + str(time.monotonic_ns()) + ".log"), timeout, negative)

    def test_only_the_normal_cli_exit_one_can_prove_unsupported_rejection(self):
        normal = self.command("print('unsupported component', flush=True); raise SystemExit(1)", negative=True)
        self.assertEqual(normal["status"], "passed")
        self.assertIsNone(normal["signal"])
        other = self.command("print('unsupported component', flush=True); raise SystemExit(2)", negative=True)
        self.assertEqual(other["status"], "failed")
        killed = self.command(
            "import os,signal; print('unsupported component', flush=True); os.kill(os.getpid(), signal.SIGKILL)",
            negative=True,
        )
        self.assertEqual(killed["status"], "failed")
        self.assertEqual(killed["exitCode"], -signal.SIGKILL)
        self.assertEqual(killed["signal"], signal.SIGKILL)

    def test_timed_out_child_cannot_prove_unsupported_rejection(self):
        result = self.command("import time; print('unsupported component', flush=True); time.sleep(20)",
                              timeout=0.15, negative=True)
        self.assertEqual(result["status"], "failed")
        self.assertTrue(result["timeout"])
        self.assertIsNotNone(result["retirement"])
        self.assertIsNone(result["cleanupFailure"])

    def wait_for(self, check, message, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if check():
                return
            time.sleep(0.02)
        self.fail(message)

    @staticmethod
    def live(pid):
        try:
            state = (Path("/proc") / str(pid) / "stat").read_text().rsplit(")", 1)[1].split()[0]
        except FileNotFoundError:
            return False
        # A terminated, reparented zombie is not a live descendant.
        return state not in ("Z", "X")

    def interrupt_owner(self, signum, install_handlers=True):
        descendant = self.root / "descendant.py"
        descendant.write_text(
            "import os,signal,time\nfrom pathlib import Path\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "signal.signal(signal.SIGINT, signal.SIG_IGN)\n"
            "Path('grandchild-ready').write_text(str(os.getpid()))\n"
            "while True: time.sleep(1)\n"
        )
        child = self.root / "child.py"
        child.write_text(
            "import json,os,signal,subprocess,sys,time\nfrom pathlib import Path\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "signal.signal(signal.SIGINT, signal.SIG_IGN)\n"
            "grandchild=subprocess.Popen([sys.executable,'-B','descendant.py'])\n"
            "while not Path('grandchild-ready').exists(): time.sleep(.01)\n"
            "Path('pids.json').write_text(json.dumps({'child':os.getpid(),'grandchild':grandchild.pid}))\n"
            "while True: time.sleep(1)\n"
        )
        owner = self.root / "owner.py"
        owner.write_text(
            "import json,sys\nfrom pathlib import Path\n"
            "sys.dont_write_bytecode=True\n"
            "sys.path.insert(0," + repr(str(HERE)) + ")\n"
            "import run\n"
            + ("run.install_interrupt_handlers()\n" if install_handlers else "")
            + "result=run.run_command([sys.executable,'-B','child.py'],Path.cwd(),Path('child.log'),20)\n"
            "try:\n"
            "    run.run_command([sys.executable,'-B','-c',\"from pathlib import Path; Path('wrong-next-stage').write_text('started')\"],Path.cwd(),Path('next.log'),5)\n"
            "    result['laterStageRejected']=False\n"
            "except run.OwnerInterrupted:\n"
            "    result['laterStageRejected']=True\n"
            "Path('owner-result.json').write_text(json.dumps(result))\n"
            "raise SystemExit(1 if result['interrupted'] else 0)\n"
        )
        with (self.root / "owner.log").open("wb") as log:
            parent = subprocess.Popen([sys.executable, "-B", str(owner)], cwd=self.root,
                                      stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            pids = None
            try:
                self.wait_for(lambda: (self.root / "pids.json").exists(), "owned descendant pair never started")
                pids = json.loads((self.root / "pids.json").read_text())
                self.assertTrue(self.live(pids["child"]))
                self.assertTrue(self.live(pids["grandchild"]))
                os.kill(parent.pid, signum)
                self.assertEqual(parent.wait(timeout=8), 1)
                receipt = json.loads((self.root / "owner-result.json").read_text())
                self.assertEqual(receipt["status"], "interrupted")
                self.assertEqual(receipt["interruptionSignal"], signum)
                self.assertTrue(receipt["laterStageRejected"])
                self.assertTrue(receipt["retirement"]["termSent"])
                self.assertTrue(receipt["retirement"]["killSent"])
                self.assertIsNone(receipt["cleanupFailure"])
                self.assertFalse((self.root / "wrong-next-stage").exists())
                self.wait_for(lambda: not any(self.live(pid) for pid in pids.values()),
                              "interrupted owner left a live child or grandchild")
            finally:
                if parent.poll() is None:
                    parent.kill()
                    parent.wait(timeout=3)
                if pids is not None:
                    try:
                        os.killpg(pids["child"], signal.SIGKILL)
                    except ProcessLookupError:
                        pass

    def test_sigterm_retires_real_child_and_grandchild_and_stops_later_stages(self):
        self.interrupt_owner(signal.SIGTERM)

    def test_sigint_retires_real_child_and_grandchild_and_stops_later_stages(self):
        self.interrupt_owner(signal.SIGINT)

    def test_default_keyboard_interrupt_also_retires_the_owned_group(self):
        self.interrupt_owner(signal.SIGINT, install_handlers=False)


if __name__ == "__main__":
    unittest.main()
