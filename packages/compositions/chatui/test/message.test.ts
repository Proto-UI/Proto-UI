import { describe, expect, expectTypeOf, it } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  type AnatomyPort,
} from '@proto.ui/module-anatomy';
import { executeWithHost, type ExecuteWithHostResult, type RuntimeHost } from '@proto.ui/runtime';
import { Message, type MessageRootProps } from '../src/message';
import { MESSAGE_FAMILY } from '../src/message/shared';
import * as styles from '../src/message/styles';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

type Part = {
  instance: HTMLElement;
  parent: HTMLElement | null;
  prototype: Prototype<MessageRootProps>;
};

function mountFamily(parts: readonly Part[], onCommit?: () => void): ExecuteWithHostResult[] {
  const parents = new Map(parts.map((part) => [part.instance, part.parent]));
  const prototypes = new Map(parts.map((part) => [part.instance, part.prototype]));
  return parts.map(({ instance, prototype }) => {
    const host: RuntimeHost<MessageRootProps> = {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        onCommit?.();
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
  for (let index = results.length - 1; index >= 0; index -= 1) results[index]?.invokeUnmounted();
}

function resultAt(results: readonly ExecuteWithHostResult[], index: number): ExecuteWithHostResult {
  const result = results[index];
  if (!result) throw new Error(`Expected mounted result at index ${index}.`);
  return result;
}

function diagnosticsOf(result: ExecuteWithHostResult) {
  return result.caps.getPort<AnatomyPort>('anatomy')?.getDiagnostics() ?? [];
}

describe('@proto.ui/compositions-chatui: Message', () => {
  it('declares the accepted package-local anatomy and only the three recipe inputs', () => {
    expect(Object.keys(Message)).toEqual([
      'Root',
      'Leading',
      'Header',
      'Content',
      'Footer',
      'Actions',
    ]);
    expect(MESSAGE_FAMILY.decl.roles).toEqual({
      root: { cardinality: { min: 1, max: 1 } },
      leading: { cardinality: { min: 0, max: 1 } },
      header: { cardinality: { min: 1, max: 1 } },
      content: { cardinality: { min: 1, max: 1 } },
      footer: { cardinality: { min: 0, max: 1 } },
      actions: { cardinality: { min: 0, max: '*' } },
    });
    expectTypeOf<MessageRootProps>().toEqualTypeOf<{
      alignment?: 'start' | 'end' | 'stretch';
      tone?: 'default' | 'user' | 'assistant' | 'system';
      spacing?: 'default' | 'compact';
    }>();
  });

  it.each(Object.entries(Message))(
    '%s renders one anonymous slot without owning a11y or exposes',
    (_name, prototype) => {
      const results = mountFamily([
        { instance: document.createElement('div'), parent: null, prototype },
      ]);
      try {
        const result = resultAt(results, 0);
        expect(result.children).toEqual({
          type: { kind: 'slot' },
          style: undefined,
          children: null,
        });
        expect(
          result.caps.getPort<{ getAll(): Record<string, unknown> }>('expose')?.getAll()
        ).toEqual({});
        const a11y = result.caps
          .getPort<{ getSnapshot(): A11ySemanticObjectSnapshot }>('a11y')
          ?.getSnapshot();
        expect(a11y).toMatchObject({ states: {}, relations: {}, actions: {} });
        expect(a11y?.role).toBeUndefined();
        expect(a11y?.name).toBeUndefined();
        expect(a11y?.tree).toBeUndefined();
      } finally {
        disposeAll(results);
      }
    }
  );

  it.each([0, 2])(
    'accepts required Header/Content and %i authored Actions without optional parts',
    (actionCount) => {
      const root = document.createElement('div');
      const children = [
        Message.Header,
        Message.Content,
        ...Array.from({ length: actionCount }, () => Message.Actions),
      ];
      const results = mountFamily([
        { instance: root, parent: null, prototype: Message.Root },
        ...children.map((prototype) => ({
          instance: document.createElement('div'),
          parent: root,
          prototype,
        })),
      ]);
      try {
        expect(diagnosticsOf(resultAt(results, 0))).toEqual([]);
      } finally {
        disposeAll(results);
      }
    }
  );

  it.each(['header', 'content'] as const)('reports missing required %s', (missingRole) => {
    const root = document.createElement('div');
    const results = mountFamily([
      { instance: root, parent: null, prototype: Message.Root },
      {
        instance: document.createElement('div'),
        parent: root,
        prototype: missingRole === 'header' ? Message.Content : Message.Header,
      },
    ]);
    try {
      expect(diagnosticsOf(resultAt(results, 0))).toContainEqual(
        expect.objectContaining({
          level: 'error',
          scope: 'family',
          code: 'ANATOMY_FAMILY_MIN',
          role: missingRole,
        })
      );
    } finally {
      disposeAll(results);
    }
  });

  it.each([
    ['leading', Message.Leading],
    ['header', Message.Header],
    ['content', Message.Content],
    ['footer', Message.Footer],
  ] as const)('reports duplicate bounded %s', (role, prototype) => {
    const root = document.createElement('div');
    const children = [prototype, prototype];
    if (role !== 'header') children.push(Message.Header);
    if (role !== 'content') children.push(Message.Content);
    const results = mountFamily([
      { instance: root, parent: null, prototype: Message.Root },
      ...children.map((child) => ({
        instance: document.createElement('div'),
        parent: root,
        prototype: child,
      })),
    ]);
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

  it('keeps neighboring Message roots separate and rejects orphaned parts', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const results = mountFamily([
      { instance: first, parent: null, prototype: Message.Root },
      { instance: document.createElement('div'), parent: first, prototype: Message.Header },
      { instance: second, parent: null, prototype: Message.Root },
      { instance: document.createElement('div'), parent: second, prototype: Message.Content },
      { instance: document.createElement('div'), parent: null, prototype: Message.Actions },
    ]);
    try {
      expect(diagnosticsOf(resultAt(results, 0))).toContainEqual(
        expect.objectContaining({ code: 'ANATOMY_FAMILY_MIN', role: 'content' })
      );
      expect(diagnosticsOf(resultAt(results, 2))).toContainEqual(
        expect.objectContaining({ code: 'ANATOMY_FAMILY_MIN', role: 'header' })
      );
      const orphan = resultAt(results, 4);
      expect(() =>
        orphan.invokeInCallbackScope(() => orphan.session.kernel.run.anatomy.parts(MESSAGE_FAMILY))
      ).toThrow(/not part of a valid domain/);
    } finally {
      disposeAll(results);
    }
  });

  it('changes only recipe feedback when App props change and removes stale recipe tokens', () => {
    let commits = 0;
    const results = mountFamily(
      [{ instance: document.createElement('div'), parent: null, prototype: Message.Root }],
      () => {
        commits += 1;
      }
    );
    const result = resultAt(results, 0);
    try {
      expect(result.controller.getRuleStyleTokens()).toEqual(
        expect.arrayContaining(['me-auto', 'bg-muted/30', 'gap-3', 'p-4'])
      );
      const initialCommits = commits;
      result.controller.applyRawProps({ alignment: 'end', tone: 'user', spacing: 'compact' });
      const compact = result.controller.getRuleStyleTokens();
      expect(compact).toEqual(expect.arrayContaining(['ms-auto', 'bg-primary/10', 'gap-2', 'p-2']));
      expect(compact).not.toContain('me-auto');
      expect(compact).not.toContain('p-4');
      result.controller.applyRawProps({ alignment: 'stretch', tone: 'system' });
      expect(result.controller.getRuleStyleTokens()).toEqual(
        expect.arrayContaining(['w-full', 'bg-transparent', 'p-4'])
      );
      result.controller.applyRawProps({});
      expect(result.controller.getRuleStyleTokens()).toEqual(
        expect.arrayContaining(['me-auto', 'bg-muted/30', 'p-4'])
      );
      expect(commits).toBe(initialCommits);
    } finally {
      result.invokeUnmounted();
    }
  });

  it('translates every recipe through the generic CSS renderer', () => {
    const tokens = Object.values(styles).flatMap((value) =>
      (typeof value === 'string' ? [value] : Object.values(value)).flatMap((tokenSet) =>
        tokenSet.split(/\s+/)
      )
    );
    const css = renderProtoStyleTokenCss([...new Set(tokens)]);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('margin-inline-start: auto;');
    expect(css).toContain('margin-inline-end: auto;');
    expect(css).toContain('flex-wrap: wrap;');
  });
});
