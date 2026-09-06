import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as BasePrototypes from '@proto.ui/prototypes-base';
import * as PackageRoot from '@proto.ui/compositions-chatui';
import * as CodeBlockEntry from '@proto.ui/compositions-chatui/code-block';

type PrivateManifest = {
  name?: string;
  private?: boolean;
  publishConfig?: unknown;
  protoUi?: { release?: { scan?: boolean } };
  exports?: Record<string, unknown>;
};

describe('@proto.ui/compositions-chatui: private package boundary', () => {
  it('exports one direct CodeBlock entry without a Base alias', () => {
    expect(Object.keys(PackageRoot)).toEqual(['CodeBlock']);
    expect(Object.keys(CodeBlockEntry)).toEqual(['CodeBlock']);
    expect(PackageRoot.CodeBlock).toBe(CodeBlockEntry.CodeBlock);
    expect('CodeBlock' in BasePrototypes).toBe(false);
    expect('codeBlock' in BasePrototypes).toBe(false);
  });

  it('is private, release-scan excluded, and source-exported only', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'packages/compositions/chatui/package.json'), 'utf8')
    ) as PrivateManifest;

    expect(manifest.name).toBe('@proto.ui/compositions-chatui');
    expect(manifest.private).toBe(true);
    expect(manifest.protoUi?.release?.scan).toBe(false);
    expect(manifest.publishConfig).toBeUndefined();
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual(['.', './code-block']);
  });
});
