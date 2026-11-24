from pathlib import Path
import hashlib
import json
import os
import subprocess
import time

parent = Path('/home/ezra/.local/state/proto-ui-header-080997012d40')
repo = parent / 'repo'
head = '4a556a37acdda77e2cbbc59bb9f10c259b8b5036'
env = dict(os.environ)
env.update({
    'PATH': '/home/ezra/.npm/_npx/e492a4414fcaa974/node_modules/.bin:' + env['PATH'],
    'TMPDIR': str(parent / 'tmp'),
    'NODE_OPTIONS': '--max-old-space-size=6144',
    'CHROME_PATH': '/usr/bin/chromium',
    'PROTO_UI_HEADER_BASELINE': '06d4f20249d8128575d6e0e13385e9dcf540c84c',
})
results = []

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo, text=True).strip()

def run(name, command, timeout, allow_failure=False):
    assert git('rev-parse', 'HEAD') == head
    start = time.monotonic()
    with (parent / (name + '.log')).open('w') as output:
        completed = subprocess.run(command, cwd=repo, env=env, stdout=output,
                                   stderr=subprocess.STDOUT, timeout=timeout)
    results.append({'name': name, 'command': command, 'head': head,
                    'exitCode': completed.returncode,
                    'durationSeconds': round(time.monotonic() - start, 3),
                    'worktreeStatus': git('status', '--porcelain')})
    (parent / 'final-validation-results.json').write_text(json.dumps(results, indent=2) + '\n')
    if completed.returncode and not allow_failure:
        raise RuntimeError(name + ' failed')

try:
    assert git('rev-parse', 'HEAD') == head
    assert git('status', '--porcelain') == ''
    expected = {
        'apps/www/astro.config.mjs': '10404ebdfd8ec0f96f74f59bba0b064b9f361b26de9483e82e5550d7aba7e58d',
        'apps/www/scripts/client-chunk-isolation.mjs': 'ab1b90b6ab049058595d686ae23b835cdec6d3b96058bd4055982c8a73c57e69',
    }
    for name, digest in expected.items():
        assert hashlib.sha256((repo / name).read_bytes()).hexdigest() == digest
    run('final-candidate-build', ['corepack', 'pnpm@10.32.1', 'docs:build'], 900)
    run('final-candidate-inspect', ['node', str(parent / 'inspect-header-graph.mjs'),
                                  'candidate', str(repo)], 120)
    graph = json.loads((parent / 'header-candidate-graph-report.json').read_text())
    env['PROTO_UI_HEADER_GRAPH_SHA'] = graph['graphSha256']
    run('final-candidate-controls', ['node', str(parent / 'header-production-controls.mjs'),
                                   str(repo), str(parent / 'final-candidate-controls')],
        300, allow_failure=True)
    run('final-real-vitest', ['node', 'scripts/test/run-runtime-tests.mjs',
                            'packages/adapters/base/test/material-sink-wiring.test.ts',
                            'packages/modules/feedback/test/deferred-view-sink.test.ts',
                            '--maxWorkers=1', '--minWorkers=1'], 180)
    (parent / 'final-validation.exit').write_text('0\n')
except Exception as error:
    (parent / 'final-validation-error.txt').write_text(repr(error) + '\n')
    (parent / 'final-validation.exit').write_text('1\n')
    raise
