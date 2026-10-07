import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const source of [
  '../../../internal/agent-operations/README.md',
  '../../../.agents/skills/pui-review/SKILL.md',
]) {
  test(`review command examples retain validation predecessors: ${source}`, () => {
    const text = readFileSync(new URL(source, import.meta.url), 'utf8');
    const commands = [
      ...text.matchAll(/agent:review -- (validate|inspect|eligibility|submit-review)[^\n`]+/g),
    ]
      .map((m) => m[0])
      .filter((command) => command.includes('--handoff'));
    assert(commands.length >= 4);
    for (const command of commands) assert.match(command, /--prior-handoff/);
    assert.match(text, /actual.*(?:input|handoff)/);
  });
}
