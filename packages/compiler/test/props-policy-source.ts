import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

export function propsPolicySource(watcher: boolean): string {
  const source = readFileSync(
    new NodeURL('./fixtures/differential-browser/props-policy.proto.ts', import.meta.url),
    'utf8'
  );
  if (watcher) return source;
  const start = '    // props-policy:watch-start\n';
  const end = '    // props-policy:watch-end\n';
  const first = source.indexOf(start);
  const last = source.indexOf(end);
  if (first < 0 || last <= first || source.indexOf(start, first + start.length) >= 0)
    throw new Error('Props-policy watcher control no longer has one exact source region.');
  return source.slice(0, first) + source.slice(last + end.length);
}
