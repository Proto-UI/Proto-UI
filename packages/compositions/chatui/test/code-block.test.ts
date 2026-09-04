import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { executeWithHost, type ExecuteWithHostResult, type RuntimeHost } from '@proto.ui/runtime';
import { CodeBlock } from '../src/code-block';
import { CODE_BLOCK_FAMILY } from '../src/code-block/shared';

type EmptyProps = Record<never, never>;
type CodeBlockPrototype = Prototype<EmptyProps>;
type Part = {
  instance: HTMLElement;
  parent: HTMLElement | null;
  prototype: CodeBlockPrototype;
};

function mountFamily(parts: readonly Part[]): ExecuteWithHostResult[] {
  const parents = new Map(parts.map((part) => [part.instance, part.parent]));
  const prototypes = new Map(parts.map((part) => [part.instance, part.prototype]));

  return parts.map(({ instance, prototype }) => {
    const host: RuntimeHost<EmptyProps> = {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, instance],
          [
            ANATOMY_PARENT_CAP,
            (candidate: unknown) => parents.get(candidate as HTMLElement) ?? null,
          ],
          [
            ANATOMY_GET_PROTO_CAP,
            (candidate: unknown) => prototypes.get(candidate as HTMLElement) ?? null,
          ],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (candidate: unknown) => (candidate instanceof HTMLElement ? candidate : null),
          ],
        ]);
      },
    };

    return executeWithHost(prototype, host);
  });
}

function disposeAll(results: readonly ExecuteWithHostResult[]): void {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    results[index]?.invokeUnmounted();
  }
}

function resultAt(results: readonly ExecuteWithHostResult[], index: number): ExecuteWithHostResult {
  const result = results[index];
  if (!result) throw new Error(`Expected mounted result at index ${index}.`);
  return result;
}

function diagnosticsOf(result: ExecuteWithHostResult) {
  return result.caps.getPort<AnatomyPort>('anatomy')?.getDiagnostics() ?? [];
}

describe('@proto.ui/compositions-chatui: CodeBlock anatomy', () => {
  it('declares Root 1..1, Header 0..1, Content 1..1, and Root containment', () => {
    expect(CODE_BLOCK_FAMILY.debugName).toBe('chatui-code-block');
    expect(CODE_BLOCK_FAMILY.decl.roles).toEqual({
      root: { cardinality: { min: 1, max: 1 } },
      header: { cardinality: { min: 0, max: 1 } },
      content: { cardinality: { min: 1, max: 1 } },
    });
    expect(CODE_BLOCK_FAMILY.decl.relations).toEqual([
      { kind: 'contains', parent: 'root', child: 'header' },
      { kind: 'contains', parent: 'root', child: 'content' },
    ]);
    expect(Object.keys(CodeBlock)).toEqual(['Root', 'Header', 'Content']);
  });

  it.each([
    ['Root', CodeBlock.Root],
    ['Header', CodeBlock.Header],
    ['Content', CodeBlock.Content],
  ] as const)('%s renders one anonymous authored-children slot', (_label, prototype) => {
    const instance = document.createElement('div');
    const results = mountFamily([{ instance, parent: null, prototype }]);

    try {
      expect(resultAt(results, 0).children).toEqual({
        type: { kind: 'slot' },
        style: undefined,
        children: null,
      });
    } finally {
      disposeAll(results);
    }
  });

  it('accepts a Root with required Content and no Header', () => {
    const root = document.createElement('div');
    const content = document.createElement('div');
    const results = mountFamily([
      { instance: root, parent: null, prototype: CodeBlock.Root },
      { instance: content, parent: root, prototype: CodeBlock.Content },
    ]);

    try {
      const rootResult = resultAt(results, 0);
      expect(diagnosticsOf(rootResult)).toEqual([]);
      const roles = rootResult.invokeInCallbackScope(() =>
        rootResult.session.kernel.run.anatomy.parts(CODE_BLOCK_FAMILY).map((part) => part.role)
      );
      expect(roles).toEqual(['root', 'content']);
    } finally {
      disposeAll(results);
    }
  });

  it('reports missing Content as a family error', () => {
    const root = document.createElement('div');
    const results = mountFamily([{ instance: root, parent: null, prototype: CodeBlock.Root }]);

    try {
      expect(diagnosticsOf(resultAt(results, 0))).toContainEqual(
        expect.objectContaining({
          level: 'error',
          scope: 'family',
          code: 'ANATOMY_FAMILY_MIN',
          role: 'content',
        })
      );
    } finally {
      disposeAll(results);
    }
  });

  it.each([
    ['Header', CodeBlock.Header, 'header'],
    ['Content', CodeBlock.Content, 'content'],
  ] as const)('reports duplicate %s as a family error', (_label, prototype, role) => {
    const root = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    const requiredContent = document.createElement('div');
    const parts: Part[] = [
      { instance: root, parent: null, prototype: CodeBlock.Root },
      { instance: first, parent: root, prototype },
      { instance: second, parent: root, prototype },
    ];
    if (role === 'header') {
      parts.push({ instance: requiredContent, parent: root, prototype: CodeBlock.Content });
    }
    const results = mountFamily(parts);

    try {
      expect(diagnosticsOf(resultAt(results, 0))).toContainEqual(
        expect.objectContaining({
          level: 'error',
          scope: 'family',
          code: 'ANATOMY_FAMILY_MAX',
          role,
        })
      );
    } finally {
      disposeAll(results);
    }
  });

  it('rejects a Content claim outside a Root domain', () => {
    const content = document.createElement('div');
    const results = mountFamily([
      { instance: content, parent: null, prototype: CodeBlock.Content },
    ]);

    try {
      const contentResult = resultAt(results, 0);
      expect(() =>
        contentResult.invokeInCallbackScope(() =>
          contentResult.session.kernel.run.anatomy.parts(CODE_BLOCK_FAMILY)
        )
      ).toThrow(/not part of a valid domain/);
    } finally {
      disposeAll(results);
    }
  });
});
