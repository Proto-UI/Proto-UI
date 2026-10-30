import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { createRuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';
import { fieldSwitch, fieldRoot, fieldLabel } from '../src/field';
for (const p of [fieldSwitch, fieldRoot, fieldLabel]) AdaptToWebComponent(p as any);
import { styleScope } from '../src/style-scope';
import { styleContains } from '../../test-utils/style';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
const sheet = document.createElement('style');
beforeAll(() => {
  sheet.textContent = renderProtoStyleTokenCss(['relative', 'inline-flex'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(sheet);
});
afterAll(() => sheet.remove());
AdaptToWebComponent(switchRoot as any);
AdaptToWebComponent(switchThumb as any);
AdaptToWebComponent(styleScope as any);
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const mount = (profile?: string) => {
  const scope = document.createElement('shadcn-style-scope') as any;
  const root = document.createElement('shadcn-switch-root') as any;
  const thumb = document.createElement('shadcn-switch-thumb') as any;
  if (profile) setElementProps(scope, { styleProfile: profile });
  root.append(thumb);
  scope.append(root);
  document.body.append(scope);
  return { scope, root, thumb };
};
describe('Switch shared style profile', () => {
  it('inherits Rhea and releases only its hit lease on NY while preserving checked and caller thumb', async () => {
    const { scope, root, thumb } = mount('rhea');
    try {
      await settle();
      expect(root.getExposes().getVisualStyle()).toBe('rhea');
      expect(styleContains(root, 'h-5')).toBe(true);
      expect(styleContains(root, 'rounded-[var(--pui-radius-2xl)]')).toBe(true);
      expect(root.getAttribute('data-pui-static-hit')).not.toBeNull();
      expect(styleContains(thumb, 'shadow-sm')).toBe(true);
      root.click();
      await settle();
      expect(root.getExposes().checked.get()).toBe(true);
      expect(styleContains(thumb, 'translate-x-[calc(100%_-_4px)]')).toBe(true);
      const changes: unknown[] = [];
      root.addEventListener('checkedChange', (e: any) => changes.push(e.detail));
      for (const profile of ['new-york-v4', 'rhea', 'new-york-v4']) {
        setElementProps(scope, { styleProfile: profile });
        await settle();
        expect(root.getExposes().getVisualStyle()).toBe(profile);
        expect(root.firstElementChild).toBe(thumb);
        expect(root.getExposes().checked.get()).toBe(true);
        expect(
          styleContains(
            thumb,
            profile === 'rhea' ? 'translate-x-[calc(100%_-_4px)]' : 'translate-x-[calc(100%_-_2px)]'
          )
        ).toBe(true);
        expect(root.hasAttribute('data-pui-static-hit')).toBe(profile === 'rhea');
      }
      expect(changes).toEqual([]);
    } finally {
      scope.remove();
      await settle();
    }
  });
  it('explicit NY overrides nearest Rhea until inherit restores both root and thumb', async () => {
    const { scope, root, thumb } = mount('rhea');
    try {
      setElementProps(root, { styleProfile: 'new-york-v4', size: 'sm' });
      await settle();
      expect(styleContains(root, 'h-3.5')).toBe(true);
      expect(styleContains(thumb, 'rounded-full')).toBe(true);
      expect(root.hasAttribute('data-pui-static-hit')).toBe(false);
      setElementProps(root, { styleProfile: 'inherit', size: 'sm' });
      await settle();
      expect(styleContains(root, 'h-4')).toBe(true);
      expect(styleContains(thumb, 'size-3')).toBe(true);
      expect(styleContains(thumb, 'rounded-[var(--pui-radius-2xl)]')).toBe(true);
      expect(root.hasAttribute('data-pui-static-hit')).toBe(true);
    } finally {
      scope.remove();
      await settle();
    }
  });
});

describe('Field Switch shared paint', () => {
  it.each(
    ['light', 'dark'].flatMap((theme) =>
      ['new-york-v4', 'rhea'].flatMap((profile) =>
        ['normal', 'readonly', 'disabled'].map((mode) => ({ theme, profile, mode }))
      )
    )
  )(
    'preserves invalid and focus ownership $theme/$profile/$mode',
    async ({ theme, profile, mode }) => {
      document.documentElement.dataset.theme = theme;
      const field = document.createElement(fieldRoot.name) as any;
      const label = document.createElement(fieldLabel.name) as any;
      const root = document.createElement(fieldSwitch.name) as any;
      const thumb = document.createElement(switchThumb.name) as any;
      setElementProps(root, {
        styleProfile: profile,
        readOnly: mode === 'readonly',
        disabled: mode === 'disabled',
      });
      label.textContent = 'Notifications';
      root.append(thumb);
      field.append(label, root);
      document.body.append(field);
      try {
        await settle();
        const checked = root.getExposes().checked;
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
        const matches = root.matches.bind(root);
        vi.spyOn(root, 'matches').mockImplementation(
          (selector: unknown) => selector === ':focus-visible' || matches(String(selector))
        );
        if (mode !== 'disabled') root.focus();
        await settle();
        setElementProps(field, { invalid: true, errors: ['Invalid'] });
        await settle();
        expect(root.getAttribute('aria-invalid')).toBe('true');
        if (profile === 'rhea') {
          expect(
            styleContains(root, theme === 'dark' ? 'ring-destructive/40' : 'ring-destructive/20')
          ).toBe(true);
          expect(styleContains(root, 'ring-ring/30')).toBe(false);
          expect(styleContains(root, 'ring-3')).toBe(true);
        } else {
          expect(root.getAttribute('data-pui-style')).not.toContain('destructive');
        }
        setElementProps(field, { invalid: false });
        await settle();
        expect(root.getAttribute('data-pui-style')).not.toContain('destructive');
        if (mode !== 'disabled')
          expect(styleContains(root, profile === 'rhea' ? 'ring-ring/30' : 'ring-ring/50')).toBe(
            true
          );
        expect(root.getExposes().checked).toBe(checked);
        expect(root.firstElementChild).toBe(thumb);
        root.click();
        await settle();
        expect(checked.get()).toBe(mode === 'normal');
      } finally {
        field.remove();
        delete document.documentElement.dataset.theme;
        vi.restoreAllMocks();
        await settle();
      }
    }
  );
});

it('rejects an unknown Switch style before claiming a profile', () => {
  expect(() =>
    createRuntimeSession(switchRoot, {
      prototypeName: switchRoot.name,
      getRawProps: () => ({ styleProfile: 'unknown' }) as any,
      schedule: (fn) => fn(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        const token = new EventTarget();
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, () => null],
          [ANATOMY_GET_PROTO_CAP, () => switchRoot],
          [ANATOMY_ROOT_TARGET_CAP, () => null],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, token],
          [AS_TRIGGER_PARENT_CAP, () => null],
          [AS_TRIGGER_GET_PROTO_CAP, () => switchRoot],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('event', [
          [EVENT_GLOBAL_TARGET_CAP, () => new EventTarget()],
          [EVENT_ROOT_TARGET_CAP, () => new EventTarget()],
        ]);
      },
    })
  ).toThrow(/Unsupported|Unknown/);
});
