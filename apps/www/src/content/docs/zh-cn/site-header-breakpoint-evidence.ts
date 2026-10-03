/** Read-only browser probes. Keep these functions self-contained: Playwright
 * serializes them into the page. Unit fixtures are only oracle-negative tests. */
export type HeaderPreferenceControl = 'runtime' | 'family';
type ExternalState = { get(): unknown };
type SelectRoot = HTMLElement & {
  getExposes?: () => { value?: ExternalState; textValue?: ExternalState };
};
export type HeaderPreferenceLease = {
  root: SelectRoot;
  trigger: HTMLElement;
  control: HeaderPreferenceControl;
  valueState: ExternalState | null;
  textState: ExternalState | null;
  expected: {
    owner: string;
    generation: string;
    runtime: string;
    family: string;
    text: string;
    value: unknown;
    textValue: unknown;
  };
};

/** C-EXPOSE-0008-B / C-EXPOSE-STATE-0001-I (draft): compare individual
 * public state entries, never a replacement top-level getExposes snapshot. */
export function captureHeaderPreferenceLease(
  trigger: HTMLElement,
  input: { root: SelectRoot; control: HeaderPreferenceControl }
): HeaderPreferenceLease {
  const root = input.root;
  for (const name of [
    'projectionOwner',
    'projectionGeneration',
    'projectionRuntime',
    'projectionFamily',
  ])
    if (!root.dataset[name]) throw new Error(`Select source coordinate ${name} is required`);
  const runtime = root.dataset.projectionRuntime!;
  const exposes = root.getExposes?.();
  if (runtime === 'wc' && (!exposes?.value || !exposes.textValue))
    throw new Error('WC Select must expose the declared value/textValue state handles');
  return {
    root,
    trigger,
    control: input.control,
    valueState: exposes?.value ?? null,
    textState: exposes?.textValue ?? null,
    expected: {
      owner: root.dataset.projectionOwner!,
      generation: root.dataset.projectionGeneration!,
      runtime,
      family: root.dataset.projectionFamily!,
      text:
        trigger
          .querySelector('[data-projection-prototype$="-select-value"]')
          ?.textContent?.trim() ?? '',
      value: exposes?.value?.get() ?? null,
      textValue: exposes?.textValue?.get() ?? null,
    },
  };
}

export function inspectHeaderPreferenceLease(
  lease: HeaderPreferenceLease,
  input: {
    insidePanel: boolean;
    portal?: HTMLElement;
    selected?: HTMLElement;
    focused: 'portal' | 'trigger';
  }
) {
  const { root, trigger, control, expected } = lease;
  const document = root.ownerDocument;
  const owner = document.querySelector('#home-preferences');
  const currentRoots = owner?.querySelectorAll(
    `[data-demo-ref="__pui_projection__${control}_root"]`
  );
  const currentTriggers = owner?.querySelectorAll(
    `[data-projection-control="${control}"] [role="combobox"]`
  );
  const exposes = root.getExposes?.();
  const header = document.querySelector<HTMLElement>('[data-homepage-runtime]');
  const value =
    trigger.querySelector('[data-projection-prototype$="-select-value"]')?.textContent?.trim() ??
    '';
  const rect = trigger.getBoundingClientRect();
  const portalId = trigger.getAttribute('aria-controls');
  return {
    sameRoot: currentRoots?.length === 1 && currentRoots[0] === root,
    sameTrigger: currentTriggers?.length === 1 && currentTriggers[0] === trigger,
    connected: root.isConnected && trigger.isConnected,
    visible: rect.width > 0 && rect.height > 0 && !trigger.closest('[hidden], [inert]'),
    expectedLocation: !!trigger.closest('[data-site-header-panel]') === input.insidePanel,
    generation: root.dataset.projectionGeneration,
    generationRetained:
      root.dataset.projectionGeneration === expected.generation &&
      trigger.dataset.projectionGeneration === expected.generation &&
      header?.dataset.runtimeGeneration === expected.generation,
    coordinatesRetained:
      root.dataset.projectionOwner === expected.owner &&
      trigger.dataset.projectionOwner === expected.owner &&
      root.dataset.projectionRuntime === expected.runtime &&
      trigger.dataset.projectionRuntime === expected.runtime &&
      root.dataset.projectionFamily === expected.family &&
      trigger.dataset.projectionFamily === expected.family,
    selectionRetained:
      value === expected.text &&
      (lease.valueState === null || exposes?.value?.get() === expected.value) &&
      (lease.textState === null || exposes?.textValue?.get() === expected.textValue),
    publicStateIdentityRetained:
      expected.runtime !== 'wc' ||
      (exposes?.value === lease.valueState && exposes?.textValue === lease.textState),
    focusRetained:
      document.activeElement === (input.focused === 'portal' ? input.selected : trigger),
    portalRetained:
      !input.portal ||
      (input.portal.isConnected &&
        !!portalId &&
        document.getElementById(portalId) === input.portal &&
        input.portal.getBoundingClientRect().width > 0 &&
        input.portal.getBoundingClientRect().height > 0),
    selectedOptionRetained:
      !input.portal ||
      (input.portal.querySelector('[role="option"][aria-selected="true"]') === input.selected &&
        input.selected?.isConnected === true),
    portalId,
    text: value,
    value: exposes?.value?.get() ?? null,
  };
}

export function headerPreferenceLeaseIssues(
  facts: ReturnType<typeof inspectHeaderPreferenceLease>
) {
  return Object.entries(facts).flatMap(([key, value]) =>
    typeof value === 'boolean' && !value ? [key] : []
  );
}

/** Measure the actual Prototype ring against every physical clipping ancestor.
 * Ring extent is taken from computed Prototype output, never a page CSS guess. */
export function measureHeaderPreferenceFocusRing(trigger: HTMLElement) {
  const view = trigger.ownerDocument.defaultView!;
  const style = view.getComputedStyle(trigger);
  const box = trigger.getBoundingClientRect();
  const ringWidth = Number.parseFloat(style.getPropertyValue('--pui-ring-width')) || 0;
  const ringOffset = Number.parseFloat(style.getPropertyValue('--pui-ring-offset-width')) || 0;
  const scaleX = trigger.offsetWidth ? box.width / trigger.offsetWidth : 1;
  const scaleY = trigger.offsetHeight ? box.height / trigger.offsetHeight : 1;
  const expansion = ringWidth + ringOffset;
  const ring = {
    left: box.left - expansion * scaleX,
    right: box.right + expansion * scaleX,
    top: box.top - expansion * scaleY,
    bottom: box.bottom + expansion * scaleY,
  };
  const clipping: Array<{
    tag: string;
    marker: string | null;
    overflowX: string;
    overflowY: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    containsX: boolean;
    containsY: boolean;
    unsupportedClip: boolean;
  }> = [];
  for (let parent = trigger.parentElement; parent; parent = parent.parentElement) {
    const computed = view.getComputedStyle(parent);
    const clipsX = ['hidden', 'clip', 'scroll', 'auto'].includes(computed.overflowX);
    const clipsY = ['hidden', 'clip', 'scroll', 'auto'].includes(computed.overflowY);
    const unsupportedClip =
      (computed.clipPath !== 'none' && computed.clipPath !== '') ||
      /(?:^|\s)(paint|strict|content)(?:\s|$)/.test(computed.contain);
    if (!clipsX && !clipsY && !unsupportedClip) continue;
    const bounds = parent.getBoundingClientRect();
    const sx = parent.offsetWidth ? bounds.width / parent.offsetWidth : 1;
    const sy = parent.offsetHeight ? bounds.height / parent.offsetHeight : 1;
    const left = bounds.left + parent.clientLeft * sx;
    const top = bounds.top + parent.clientTop * sy;
    const right = left + parent.clientWidth * sx;
    const bottom = top + parent.clientHeight * sy;
    clipping.push({
      tag: parent.tagName,
      marker: parent.className || parent.getAttribute('data-demo-ref'),
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      left,
      right,
      top,
      bottom,
      containsX: !clipsX || (ring.left >= left - 0.5 && ring.right <= right + 0.5),
      containsY: !clipsY || (ring.top >= top - 0.5 && ring.bottom <= bottom + 0.5),
      unsupportedClip,
    });
  }
  return {
    focused: trigger.ownerDocument.activeElement === trigger,
    focusVisible: trigger.matches(':focus-visible'),
    prototype: trigger.dataset.projectionPrototype,
    tokens: (trigger.getAttribute('data-pui-style') ?? '').split(/\s+/),
    ringWidth,
    ringOffset,
    shadow: style.boxShadow,
    ringColor: style.getPropertyValue('--pui-ring-color').trim(),
    target: box.toJSON(),
    ring,
    clipping,
    viewport: { width: view.innerWidth, height: view.innerHeight },
    inViewport:
      ring.left >= 0 &&
      ring.top >= 0 &&
      ring.right <= view.innerWidth &&
      ring.bottom <= view.innerHeight,
    unclipped: clipping.every(
      (parent) => parent.containsX && parent.containsY && !parent.unsupportedClip
    ),
  };
}
