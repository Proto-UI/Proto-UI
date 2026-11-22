import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('consumer_broker', Path(__file__).with_name('consumer-broker.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


class Capabilities(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(); self.root = Path(self.temporary.name)
        self.stage = self.root / 'stage'; self.output = self.root / 'output'
        (self.stage / 'starter/src').mkdir(parents=True); (self.stage / 'distribution/generated').mkdir(parents=True); self.output.mkdir()
        (self.stage / 'starter/src/App.tsx').write_text('export const observed = 1;')
        (self.stage / 'starter/package.json').write_text('{}')
        (self.stage / 'distribution/USAGE.md').write_text('Ordinary distribution instructions')
        (self.stage / 'distribution/generated/Component.tsx').write_text('export const Button = 1;')
        self.hidden = self.root / 'oracle.txt'; self.hidden.write_text('PRIVATE_ORACLE_CANARY')
        os.environ['PUI_STUDY_NODE'] = '/declared-node'
        self.broker = module.Broker(self.stage, self.output)
        self.call = self.output / 'call'; self.call.mkdir()

    def tearDown(self):
        self.temporary.cleanup()

    def test_read_and_write_are_actual_bounded_capabilities(self):
        read = self.broker.dispatch({'action': 'read', 'path': 'src/App.tsx', 'offset': 0, 'length': 5}, self.call)
        self.assertEqual(read['content'], 'export const observed = 1;')
        result = self.broker.dispatch({'action': 'write', 'path': 'src/App.tsx', 'content': 'export const observed = 2;'}, self.call)
        self.assertNotEqual(result['beforeSha256'], result['afterSha256'])
        self.assertEqual((self.call / 'before.txt').read_text(), 'export const observed = 1;')
        self.assertEqual((self.broker.workspace / 'src/App.tsx').read_text(), 'export const observed = 2;')

    def test_oracle_paths_and_unknown_files_never_read(self):
        for name in ['../oracle.txt', '/etc/passwd', 'src/../../oracle.txt', 'oracle.txt', 'node_modules/package.json']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.broker.dispatch({'action': 'read', 'path': name, 'offset': 0, 'length': 1}, self.call)
        self.assertNotIn('PRIVATE_ORACLE_CANARY', json.dumps(self.broker.dispatch({'action': 'list'}, self.call)))

    def test_symlink_escape_is_rejected(self):
        exposed = self.broker.workspace / 'src/App.tsx'; exposed.unlink(); exposed.symlink_to(self.hidden)
        with self.assertRaises(ValueError): self.broker.file('src/App.tsx')

    def test_package_scripts_and_arbitrary_commands_cannot_be_mutated_or_dispatched(self):
        for action in [
            {'action': 'write', 'path': 'package.json', 'content': '{"scripts":{"build":"cat /etc/passwd"}}'},
            {'action': 'install', 'command': 'cat /etc/passwd'},
            {'action': 'shell', 'command': 'whoami'},
            {'action': 'read', 'path': 'src/App.tsx', 'offset': 0, 'length': 121},
        ]:
            with self.subTest(action=action), self.assertRaises(ValueError): module.validate_action(action)

    def test_installation_requires_explicit_action_and_copy_retains_real_bytes(self):
        with self.assertRaises(ValueError): self.broker.dispatch({'action': 'build'}, self.call)
        copied = self.broker.dispatch({'action': 'copy_distribution'}, self.call)
        self.assertIn('generated/Component.tsx', copied['files'])
        self.assertEqual(self.broker.file('generated/Component.tsx').read_text(), 'export const Button = 1;')

    def test_no_observer_before_current_build(self):
        self.broker.built_revision = 0; self.broker.revision = 1
        with self.assertRaises(ValueError): self.broker.dispatch({'action': 'observe'}, self.call)

    def test_failed_rebuild_revokes_observation_until_full_success(self):
        self.broker.installed = True

        def build(label, outcomes):
            call = self.output / label; call.mkdir()
            self.broker.command = Mock(side_effect=[
                outcome if isinstance(outcome, Exception) else {'exitCode': outcome}
                for outcome in outcomes
            ])
            return self.broker.dispatch({'action': 'build'}, call)

        for label, outcomes in [
            ('typecheck-failure', [1]),
            ('typecheck-timeout', [None]),
            ('bundler-failure', [0, 1]),
            ('bundler-timeout', [0, None]),
            ('deadline-exception', [TimeoutError('Consumer time window ended')]),
        ]:
            with self.subTest(failure=label):
                self.assertEqual(build(label + '-initial', [0, 0])['exitCode'], 0)
                revision = self.broker.revision
                if isinstance(outcomes[-1], Exception):
                    with self.assertRaises(TimeoutError):
                        build(label + '-failed', outcomes)
                else:
                    self.assertNotEqual(build(label + '-failed', outcomes)['exitCode'], 0)
                self.assertEqual(self.broker.revision, revision)

                with patch.object(module.socketserver, 'TCPServer', side_effect=AssertionError('Stale observer started')) as server:
                    with self.assertRaisesRegex(ValueError, 'Build the current revision'):
                        self.broker.dispatch({'action': 'observe'}, self.call)
                    server.assert_not_called()

                self.assertEqual(build(label + '-recovered', [0, 0])['exitCode'], 0)
                self.broker.command = Mock(return_value={'exitCode': 0})
                server = Mock(server_address=('127.0.0.1', 12345))
                with patch.object(module.socketserver, 'TCPServer', return_value=server) as create_server, patch.object(module.threading, 'Thread') as create_thread:
                    self.assertEqual(self.broker.dispatch({'action': 'observe'}, self.call)['exitCode'], 0)
                    create_server.assert_called_once()
                    create_thread.return_value.start.assert_called_once()
                    create_thread.return_value.join.assert_called_once_with(timeout=5)
                self.broker.command.assert_called_once()
                server.shutdown.assert_called_once()
                server.server_close.assert_called_once()


if __name__ == '__main__': unittest.main()
