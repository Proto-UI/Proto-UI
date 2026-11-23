#!/usr/bin/env python3
"""Bounded real consumer agent: virtual file capabilities and fixed commands only.

The participant sees the task's starter and genuine distribution. It cannot read
the evaluator, another participant, this broker, environment variables or arbitrary
host paths. Textual JSON actions are intentionally dispatched as explicit tools;
this is distinct from the inert generation-only model-request.py executor.
"""
import argparse
from functools import partial
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import signal
import socketserver
import subprocess
import threading
import time
import urllib.error
import urllib.request


WRITABLE = {'src/App.tsx', 'src/style.css', 'generated/Component.tsx'}
ACTIONS = {
    'list': {'action'}, 'read': {'action', 'path', 'offset', 'length'},
    'copy_distribution': {'action'}, 'install': {'action'},
    'write': {'action', 'path', 'content'}, 'build': {'action'}, 'observe': {'action'},
    'finish': {'action', 'summary', 'completed', 'explanation', 'escapeHatches'},
}


def sha(bytes_):
    return hashlib.sha256(bytes_).hexdigest()


def validate_action(value):
    if not isinstance(value, dict) or value.get('action') not in ACTIONS or set(value) != ACTIONS[value['action']]:
        raise ValueError('Use exactly the declared JSON action fields; no arbitrary tools or commands')
    if value['action'] in ('read', 'write'):
        name = value['path']
        if not isinstance(name, str) or not name or name.startswith('/') or '\\' in name or '\x00' in name or '..' in name.split('/'):
            raise ValueError('Only literal listed relative paths are allowed')
    if value['action'] == 'read':
        if type(value['offset']) is not int or value['offset'] < 0 or type(value['length']) is not int or not 1 <= value['length'] <= 120:
            raise ValueError('Read requires a nonnegative line offset and length1..120')
    if value['action'] == 'write':
        if value['path'] not in WRITABLE or not isinstance(value['content'], str) or len(value['content'].encode()) > 96000:
            raise ValueError('Only bounded App, stylesheet or consumer-owned Component source may be written')
    if value['action'] == 'finish':
        if type(value['completed']) is not bool or not isinstance(value['summary'], str) or not isinstance(value['explanation'], str) or not isinstance(value['escapeHatches'], list):
            raise ValueError('Finish must record completion, explanation and escape hatches')
    return value


class StaticConsumer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'")
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Broker:
    def __init__(self, stage, output):
        self.stage, self.output = stage, output
        self.workspace = output / 'workspace'
        shutil.copytree(stage / 'starter', self.workspace)
        shutil.copytree(stage / 'distribution', self.workspace / 'distribution')
        self.exposed = {str(p.relative_to(self.workspace)) for p in self.workspace.rglob('*') if p.is_file()}
        self.revision = 0
        self.built_revision = None
        self.installed = False
        self.node = os.environ['PUI_STUDY_NODE']
        self.deadline = float('inf')

    def file(self, relative):
        path = self.workspace / relative
        if relative not in self.exposed or not path.is_file() or path.resolve() != path.absolute():
            raise ValueError('File is not in the participant capability list')
        return path

    def command(self, command, call_dir, timeout):
        env = {key: value for key, value in os.environ.items() if key not in ('PUI_STUDY_API_BASE', 'PUI_STUDY_API_KEY', 'NODE_OPTIONS', 'NODE_PATH')}
        env['PATH'] = str(Path(self.node).parent) + os.pathsep + env.get('PATH', '')
        start = time.monotonic()
        remaining = self.deadline - start
        if remaining <= 0:
            raise TimeoutError('Consumer time window ended before command dispatch')
        timeout = min(timeout, remaining)
        with (call_dir / 'command.log').open('x') as log:
            process = subprocess.Popen(command, cwd=self.workspace, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                try: os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                process.wait()
                code = None
        text = (call_dir / 'command.log').read_text(errors='replace')
        receipt = {'command': command, 'exitCode': code, 'processExitCode': process.returncode, 'timedOut': code is None, 'elapsedSeconds': time.monotonic() - start, 'output': text[-16000:]}
        (call_dir / 'command.json').write_text(json.dumps(receipt, indent=2) + '\n')
        return receipt

    def dispatch(self, action, call_dir):
        validate_action(action)
        name = action['action']
        if name == 'list':
            return {'files': sorted(self.exposed), 'writable': sorted(WRITABLE)}
        if name == 'read':
            path = self.file(action['path'])
            lines = path.read_text().splitlines(keepends=True)
            text = ''.join(lines[action['offset']:action['offset'] + action['length']])
            if len(text.encode()) > 18000:
                raise ValueError('Requested chunk exceeds18KB; request fewer lines')
            return {'path': action['path'], 'sha256': sha(path.read_bytes()), 'offset': action['offset'], 'totalLines': len(lines), 'content': text}
        if name == 'copy_distribution':
            destination = self.workspace / 'generated'
            shutil.copytree(self.workspace / 'distribution/generated', destination)
            self.exposed.update(str(p.relative_to(self.workspace)) for p in destination.rglob('*') if p.is_file())
            self.revision += 1
            return {'copied': 'distribution/generated → generated', 'files': sorted(x for x in self.exposed if x.startswith('generated/'))}
        if name == 'install':
            result = self.command(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], call_dir, 180)
            self.installed = result['exitCode'] == 0
            return result
        if name == 'write':
            path = self.file(action['path'])
            before = path.read_bytes()
            (call_dir / 'before.txt').write_bytes(before)
            path.write_text(action['content'])
            (call_dir / 'after.txt').write_bytes(path.read_bytes())
            self.revision += 1
            return {'path': action['path'], 'beforeSha256': sha(before), 'afterSha256': sha(path.read_bytes()), 'revision': self.revision}
        if name == 'build':
            if not self.installed:
                raise ValueError('Install the declared dependencies first')
            # Rebuilding can replace dist; only a new complete success authorizes observation.
            self.built_revision = None
            typecheck_directory = call_dir / 'typecheck'; typecheck_directory.mkdir()
            typecheck = self.command([self.node, str(self.workspace / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', 'tsconfig.json'], typecheck_directory, 90)
            if typecheck['exitCode'] != 0:
                return {'stage': 'typecheck', **typecheck}
            # A fixed compiler/bundler entry, never candidate package scripts.
            result = self.command([self.node, str(self.stage / 'build-submission.mjs'), str(self.workspace), 'consumer'], call_dir, 90)
            if result['exitCode'] == 0:
                self.built_revision = self.revision
            return result
        if name == 'observe':
            if self.built_revision != self.revision:
                raise ValueError('Build the current revision before observing it')
            server = socketserver.TCPServer(('127.0.0.1', 0), partial(StaticConsumer, directory=str(self.workspace / 'dist')))
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            try:
                result = self.command([self.node, str(self.stage / 'consumer-check.mjs'), '--url', f'http://127.0.0.1:{server.server_address[1]}', '--out', str(call_dir / 'observation')], call_dir, 60)
                observed = call_dir / 'observation/report.json'
                if observed.is_file():
                    report = json.loads(observed.read_text())
                    result['observation'] = {'outcome': report['outcome'], 'checks': [{'id': row['id'], 'status': row['status'], 'expected': row['expected'], 'error': row.get('error')} for row in report['checks']], 'runtimeErrors': report['runtimeErrors']}
                return result
            finally:
                server.shutdown(); server.server_close(); thread.join(timeout=5)
        if name == 'finish':
            return action
        raise AssertionError('Unreachable capability')


def main(stage, output):
    protocol = json.loads((stage / 'protocol.json').read_text())
    if protocol['status'] != 'independently-reviewed-frozen':
        raise ValueError('Freeze independently reviewed task/oracle/broker before collection')
    for relative, digest in protocol['inputs'].items():
        path = stage / relative
        if path.resolve() != path.absolute() or sha(path.read_bytes()) != digest:
            raise ValueError('Frozen stage input changed')
    output.mkdir(exist_ok=False)
    (output / 'protocol.json').write_bytes((stage / 'protocol.json').read_bytes())
    broker = Broker(stage, output)
    messages = [
        {'role': 'system', 'content': (stage / 'participant-system.txt').read_text()},
        {'role': 'user', 'content': (stage / 'task.md').read_text()},
    ]
    report = {'schemaVersion': 1, 'issue': 750, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'running', 'calls': [], 'model': protocol['model'], 'knowledgeExposure': 'No project-internal onboarding supplied. Prior training exposure unknown. Exact virtual-file reads, requests and responses retained.'}
    start = time.monotonic()
    broker.deadline = start + protocol['maximumElapsedSeconds']
    def deadline_signal(_signum, _frame):
        raise TimeoutError('Bounded inference request deadline reached')
    signal.signal(signal.SIGALRM, deadline_signal)
    for index in range(1, protocol['maximumCalls'] + 1):
        if time.monotonic() - start >= protocol['maximumElapsedSeconds']:
            report['status'] = 'time-budget-exhausted'; break
        call_dir = output / f'call-{index:02d}'; call_dir.mkdir()
        request = {'model': protocol['model'], 'messages': messages, 'temperature': protocol['temperature'], 'max_tokens': protocol['maxTokens'], 'stream': False, 'chat_template_kwargs': {'enable_thinking': False}, 'response_format': {'type': 'json_object'}}
        body = json.dumps(request, ensure_ascii=False).encode()
        (call_dir / 'request.json').write_bytes(body)
        receipt = {'call': index, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'requestSha256': sha(body), 'status': 'started', 'httpStatus': None}
        requested = time.monotonic()
        try:
            request_ = urllib.request.Request(os.environ['PUI_STUDY_API_BASE'].rstrip('/') + '/chat/completions', data=body, headers={'Content-Type': 'application/json'})
            timeout = min(protocol['requestTimeoutSeconds'], broker.deadline - time.monotonic())
            if timeout <= 0: raise TimeoutError('Consumer time window ended before inference')
            signal.setitimer(signal.ITIMER_REAL, timeout)
            try:
                with urllib.request.urlopen(request_, timeout=timeout) as connection:
                    receipt['httpStatus'] = connection.status; response_bytes = connection.read(2_000_001)
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
            if len(response_bytes) > 2_000_000: raise ValueError('Response size limit')
            (call_dir / 'response.json').write_bytes(response_bytes)
            response = json.loads(response_bytes); receipt['usage'] = response.get('usage'); receipt['reportedModel'] = response.get('model')
            choice = response['choices'][0]; message = choice['message']
            if choice['finish_reason'] != 'stop' or message.get('tool_calls') or message.get('function_call') or not isinstance(message.get('content'), str):
                raise ValueError('Only complete textual JSON actions are dispatched')
            text = message['content']; (call_dir / 'response.txt').write_text(text)
            messages.append({'role': 'assistant', 'content': text})
            receipt['inferenceElapsedSeconds'] = time.monotonic() - requested
            action = validate_action(json.loads(text))
            receipt['action'] = action['action']
            if time.monotonic() >= broker.deadline:
                raise TimeoutError('Consumer time window ended before action dispatch')
            result = broker.dispatch(action, call_dir)
            (call_dir / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
            receipt['status'] = 'executed'
            if action['action'] == 'finish':
                report['status'] = 'participant-finished'; report['finish'] = result
            else:
                messages.append({'role': 'user', 'content': 'Action result:\n' + json.dumps(result, ensure_ascii=False)})
        except Exception as error:
            receipt['status'] = 'failed'; receipt['errorClass'] = type(error).__name__
            # Only bounded local validation errors are surfaced; transport errors
            # may contain a private endpoint, so their exception strings stay out.
            message = str(error) if isinstance(error, (ValueError, KeyError)) and not isinstance(error, urllib.error.HTTPError) else type(error).__name__
            receipt['error'] = message
            messages.append({'role': 'user', 'content': 'No successful action result. Error: ' + message + '. Continue with one valid declared JSON action; failed calls remain recorded.'})
        receipt['elapsedSeconds'] = time.monotonic() - requested
        (call_dir / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        report['calls'].append(receipt)
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({key: receipt.get(key) for key in ['call', 'status', 'action', 'elapsedSeconds', 'errorClass']}), flush=True)
        if report['status'] == 'participant-finished': break
    if report['status'] == 'running': report['status'] = 'call-budget-exhausted'
    report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()); report['elapsedSeconds'] = time.monotonic() - start
    report['finalSources'] = {str(p.relative_to(broker.workspace)): sha(p.read_bytes()) for p in broker.workspace.rglob('*') if p.is_file() and 'node_modules' not in p.parts and ('src' in p.parts or 'generated' in p.parts)}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['status'] == 'participant-finished' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', type=Path); parser.add_argument('output', type=Path)
    args = parser.parse_args(); raise SystemExit(main(args.stage.resolve(), args.output.resolve()))
