import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as BasePrototypes from '@proto.ui/prototypes-base';
import * as PackageRoot from '@proto.ui/compositions-chatui';
import * as CodeBlockEntry from '@proto.ui/compositions-chatui/code-block';
import * as MessageEntry from '@proto.ui/compositions-chatui/message';
import { COMPONENT_REGISTRY } from '../../../cli/src/registry/components';

type PrivateManifest = {
  name?: string;
  private?: boolean;
  publishConfig?: unknown;
  protoUi?: { release?: { scan?: boolean } };
  exports?: Record<string, unknown>;
};

describe('@proto.ui/compositions-chatui: private package boundary', () => {
  it('exports independent CodeBlock and Message entries without Base aliases', () => {
    expect(Object.keys(PackageRoot).sort()).toEqual(['CodeBlock', 'Message']);
    expect(Object.keys(CodeBlockEntry)).toEqual(['CodeBlock']);
    expect(Object.keys(MessageEntry)).toEqual(['Message']);
    expect(PackageRoot.CodeBlock).toBe(CodeBlockEntry.CodeBlock);
    expect(PackageRoot.Message).toBe(MessageEntry.Message);
    expect('CodeBlock' in BasePrototypes).toBe(false);
    expect('codeBlock' in BasePrototypes).toBe(false);
    expect('Message' in BasePrototypes).toBe(false);
    expect('message' in BasePrototypes).toBe(false);
  });

  it('is private, release-scan excluded, and source-exported only', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'packages/compositions/chatui/package.json'), 'utf8')
    ) as PrivateManifest;

    expect(manifest.name).toBe('@proto.ui/compositions-chatui');
    expect(manifest.private).toBe(true);
    expect(manifest.protoUi?.release?.scan).toBe(false);
    expect(manifest.publishConfig).toBeUndefined();
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual(['.', './code-block', './message']);
  });

  it('keeps private composition entries out of CLI and Base/ChatUI entity admission', () => {
    expect(
      Object.values(COMPONENT_REGISTRY).some(
        (entry) => entry.packageName === '@proto.ui/compositions-chatui'
      )
    ).toBe(false);
    for (const collection of ['prototypes', 'tests']) {
      expect(
        readdirSync(resolve(process.cwd(), 'spec', collection)).filter((file) =>
          /^[PT]-(?:BASE|CHATUI)-(?:MESSAGE|CODE-BLOCK)(?:[-.])/.test(file)
        )
      ).toEqual([]);
    }
  });
});
