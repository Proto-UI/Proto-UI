"""Summarize sampled V8 CPU profiles without treating them as acceptance results."""

import collections
import json
import pathlib
import sys


source = pathlib.Path(sys.argv[1])
loaded = json.loads(source.read_text())
profile = loaded.get('profile', loaded)
nodes = {node['id']: node for node in profile['nodes']}
parents = {}
for node in nodes.values():
    for child in node.get('children', []):
        parents[child] = node['id']


def frame(node_id):
    entry = nodes[node_id]['callFrame']
    return (
        entry.get('functionName') or '(anonymous)',
        entry.get('url', ''),
        entry.get('lineNumber', -1) + 1,
    )


self_time = collections.Counter()
inclusive_time = collections.Counter()
stacks = collections.Counter()
samples = profile.get('samples', [])
deltas = profile.get('timeDeltas', [])
for node_id, delta in zip(samples, deltas):
    self_time[frame(node_id)] += delta
    stack = []
    visited = set()
    while node_id in nodes and node_id not in visited:
        visited.add(node_id)
        entry = frame(node_id)
        stack.append(entry)
        node_id = parents.get(node_id)
    for entry in set(stack):
        inclusive_time[entry] += delta
    stacks[tuple(reversed(stack))] += delta


def top(counter, count=35):
    return [
        {'function': key[0], 'url': key[1], 'line': key[2], 'sampledMs': value / 1000}
        for key, value in counter.most_common(count)
    ]


print(json.dumps({
    'source': str(source),
    'diagnosticOnly': True,
    'durationMs': (profile['endTime'] - profile['startTime']) / 1000,
    'sampledMs': sum(deltas) / 1000,
    'sampleCount': len(samples),
    'nodeCount': len(nodes),
    'self': top(self_time),
    'inclusive': top(inclusive_time),
    'stacks': [
        {'sampledMs': value / 1000, 'frames': [
            {'function': f[0], 'url': f[1], 'line': f[2]} for f in stack
        ]}
        for stack, value in stacks.most_common(12)
    ],
}, indent=2))
