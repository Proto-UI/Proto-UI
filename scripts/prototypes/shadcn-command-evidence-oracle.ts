import assert from 'node:assert/strict';

export type CommandEvidenceStyle = 'new-york-v4' | 'rhea';
export interface CommandEvidenceShellObservation {
  kind: string;
  type: 'command' | 'input';
  theme: { rootFontSize: string; rootRadiusToken: string; mdRadiusToken: string };
  input: { border: string; radius: string; font: string };
  shell: { radius: string; height: number; border: string };
}

/** Fixed 16px-root fixture, not browser zoom or a full profile conformance oracle. */
export function assertCommandEvidenceShell(
  row: CommandEvidenceShellObservation,
  style: CommandEvidenceStyle
) {
  const owner = `${row.kind}/${row.type}/${style}`;
  assert(['new-york-v4', 'rhea'].includes(style), `${owner}: unsupported fixture profile`);
  assert(['command', 'input'].includes(row.type), `${owner}: unsupported consumer`);
  assert.equal(row.theme.rootFontSize, '16px', `${owner}: fixed root font`);
  assert.equal(row.theme.rootRadiusToken, '0.625rem', `${owner}: fixed radius token`);
  assert.equal(
    row.theme.mdRadiusToken,
    'max(calc(0.625rem - 2px), 0px)',
    `${owner}: derived md radius token`
  );
  assert.equal(row.input.border, '0px', `${owner}: editor border`);
  assert.equal(row.input.radius, '0px', `${owner}: editor radius`);
  assert.equal(row.input.font, '14px', `${owner}: editor font`);
  // The existing NY Command shell is h-auto/rounded-none around its h-10
  // editor. Ordinary Input owns h-9/rounded-md; only the fixed latter is 8px.
  assert.equal(
    row.shell.radius,
    style === 'rhea' ? '18px' : row.type === 'command' ? '0px' : '8px',
    `${owner}: passive shell radius`
  );
  assert.equal(
    row.shell.height,
    style === 'rhea' ? 32 : row.type === 'command' ? 40 : 36,
    `${owner}: passive shell height`
  );
  assert.equal(
    row.shell.border,
    style === 'new-york-v4' && row.type === 'command' ? '0px' : '1px',
    `${owner}: passive shell border`
  );
}
