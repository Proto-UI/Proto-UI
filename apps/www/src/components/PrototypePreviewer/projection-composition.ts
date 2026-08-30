import type { RuntimeId } from './runtimes/registry';
import {
  assertDemoSpec,
  type DemoBoxAttrs,
  type DemoChild,
  type DemoNode,
  type DemoSetupContext,
  type DemoSpec,
  type DemoSurfaceStyle,
  type DemoSurfaceStyleEntry,
} from './demo-types';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionPart,
  type ProjectionComponentId,
  type ProjectionFamilyId,
  type ProjectionFamilyManifest,
} from './projection-families';
import {
  applyProjectionThemeSurfaceStyle,
  type ProjectionThemeSurfaceStyle,
} from './projection-theme';

export type ProjectionControlId = 'runtime' | 'family' | 'component';

export const PROJECTION_FOCUS_KEYS = Object.freeze({
  runtime: 'runtime-select',
  family: 'projection-family-select',
  component: 'component-select',
} as const);

export type ProjectionFocusKey = (typeof PROJECTION_FOCUS_KEYS)[ProjectionControlId];

export type ProjectionControlOption<Value extends string = string> = Readonly<{
  value: Value;
  label: string;
  disabled?: boolean;
}>;

export type ProjectionControlConfig<Value extends string> = Readonly<{
  label: string;
  placeholder?: string;
  options: readonly ProjectionControlOption<Value>[];
  onValueChange(value: Value): void;
}>;

export type ProjectionCompositionControls = Readonly<{
  runtime: ProjectionControlConfig<RuntimeId>;
  family: ProjectionControlConfig<ProjectionFamilyId>;
  component: ProjectionControlConfig<ProjectionComponentId>;
}>;

export type ProjectionCompositionOptions = Readonly<{
  ownerId: string;
  runtimeId: RuntimeId;
  projectionFamilyId: ProjectionFamilyId;
  generation: number;
  componentId: ProjectionComponentId;
  childDemo: DemoSpec;
  controls: ProjectionCompositionControls;
  /** Scope-owned controls to materialize. Defaults to all three controls. */
  controlIds?: readonly ProjectionControlId[];
  /** Consumer-owned theme values projected directly onto every Proto surface. */
  themeSurfaceStyle?: ProjectionThemeSurfaceStyle;
  locked?: boolean;
  /** Host generation gate; independent from physical disabled projection. */
  eventGateOpen?: boolean;
}>;

export type ProjectionComposition = Readonly<{
  demo: DemoSpec;
  setLocked(locked: boolean): void;
  setEventGateOpen(open: boolean): void;
  setThemeSurfaceStyle(themeSurfaceStyle: ProjectionThemeSurfaceStyle): void;
  restoreFocus(focusKey: ProjectionFocusKey): boolean;
}>;

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;
type DemoBoxNode = Extract<DemoNode, { kind: 'box' }>;

const REF_PREFIX = '__pui_projection__';
const SCOPE_REF = `${REF_PREFIX}scope`;
const CONTENT_REF = `${REF_PREFIX}content`;

const CONTROL_REFS: Readonly<
  Record<ProjectionControlId, Readonly<{ box: string; root: string; trigger: string }>>
> = Object.freeze({
  runtime: {
    box: `${REF_PREFIX}runtime_box`,
    root: `${REF_PREFIX}runtime_root`,
    trigger: `${REF_PREFIX}runtime_trigger`,
  },
  family: {
    box: `${REF_PREFIX}family_box`,
    root: `${REF_PREFIX}family_root`,
    trigger: `${REF_PREFIX}family_trigger`,
  },
  component: {
    box: `${REF_PREFIX}component_box`,
    root: `${REF_PREFIX}component_root`,
    trigger: `${REF_PREFIX}component_trigger`,
  },
});

function mergeClassName(existing: string | undefined, ...markers: string[]): string {
  return [existing, ...markers].filter(Boolean).join(' ');
}

function markerClass(
  kind: 'owner' | 'family' | 'runtime' | 'generation' | 'prototype',
  value: string
) {
  const encoded = Array.from(value)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('_');
  return `pui-projection-${kind}-${encoded}`;
}

function coordinateMarkerClasses(coordinateAttrs: DemoBoxAttrs): string[] {
  return [
    markerClass('owner', coordinateAttrs['data-projection-owner']!),
    markerClass('family', coordinateAttrs['data-projection-family']!),
    markerClass('runtime', coordinateAttrs['data-projection-runtime']!),
    markerClass('generation', coordinateAttrs['data-projection-generation']!),
  ];
}

function cloneJsonLike<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonLike(entry)) as Value;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        cloneJsonLike(entry),
      ])
    ) as Value;
  }
  return value;
}

function styleEntries(style: DemoSurfaceStyle | undefined): DemoSurfaceStyleEntry[] {
  if (style === undefined) return [];
  const entries = Array.isArray(style) ? style : [style];
  return entries.map((entry) =>
    typeof entry === 'string' ? entry : { ...entry }
  ) as DemoSurfaceStyleEntry[];
}

function mergeSurfaceStyle(
  existing: DemoSurfaceStyle | undefined,
  consumerTheme: DemoSurfaceStyle | undefined
): DemoSurfaceStyle | undefined {
  const entries = [...styleEntries(existing), ...styleEntries(consumerTheme)];
  if (entries.length === 0) return undefined;
  if (entries.every((entry) => typeof entry === 'object' && !Array.isArray(entry))) {
    // React's physical `style` surface requires one object; an array of style
    // records is accepted by Vue but becomes indexed CSSStyleDeclaration
    // writes in React. Later consumer theme entries intentionally win.
    return Object.assign({}, ...(entries as Array<Record<string, string>>));
  }
  return entries.length === 1 ? entries[0] : entries;
}

function copyThemeSurfaceStyle(
  theme: ProjectionThemeSurfaceStyle,
  previous?: ProjectionThemeSurfaceStyle
): ProjectionThemeSurfaceStyle {
  const entries = Object.entries(theme);
  if (entries.length === 0) {
    throw new Error('[PrototypePreviewer] projection theme copy must not be empty.');
  }
  for (const [property, value] of entries) {
    if (!/^--pui-[a-z0-9-]+$/.test(property) || typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `[PrototypePreviewer] projection theme copy has invalid property "${property}".`
      );
    }
  }
  if (previous) {
    const previousProperties = new Set(Object.keys(previous));
    if (
      previousProperties.size !== entries.length ||
      entries.some(([property]) => !previousProperties.has(property))
    ) {
      throw new Error(
        '[PrototypePreviewer] projection theme update must preserve the complete token shape.'
      );
    }
  }
  return Object.freeze(Object.fromEntries(entries)) as ProjectionThemeSurfaceStyle;
}

function assertReservedRefsAvailable(node: DemoChild): void {
  if (typeof node === 'string' || node.kind === 'text') return;
  if (node.ref?.startsWith(REF_PREFIX)) {
    throw new Error(
      `[PrototypePreviewer] child demo ref "${node.ref}" uses the reserved projection prefix.`
    );
  }
  for (const child of node.children ?? []) assertReservedRefsAvailable(child);
}

function assertProjectionRecipeClosure(
  node: DemoChild,
  requiredPrototypeIds: readonly string[],
  recipeId: string
): void {
  const actualPrototypeIds = new Set<string>();
  const collect = (child: DemoChild): void => {
    if (typeof child === 'string' || child.kind === 'text') return;
    if (child.kind === 'proto') actualPrototypeIds.add(child.prototypeId);
    for (const nested of child.children ?? []) collect(nested);
  };
  collect(node);

  const required = new Set(requiredPrototypeIds);
  const undeclared = [...actualPrototypeIds].filter((prototypeId) => !required.has(prototypeId));
  if (undeclared.length > 0) {
    throw new Error(
      `[PrototypePreviewer] projection recipe "${recipeId}" uses undeclared Prototype(s): ${undeclared.join(', ')}.`
    );
  }
  const missing = requiredPrototypeIds.filter(
    (prototypeId) => !actualPrototypeIds.has(prototypeId)
  );
  if (missing.length > 0) {
    throw new Error(
      `[PrototypePreviewer] projection recipe "${recipeId}" is incomplete; missing required Prototype(s): ${missing.join(', ')}.`
    );
  }
}

function assertControl<Value extends string>(
  id: ProjectionControlId,
  currentValue: Value,
  config: ProjectionControlConfig<Value>
): void {
  if (!config.label.trim()) {
    throw new Error(`[PrototypePreviewer] projection ${id} control requires a label.`);
  }
  const values = new Set<string>();
  for (const option of config.options) {
    if (!option.value || !option.label.trim()) {
      throw new Error(`[PrototypePreviewer] projection ${id} control has an invalid option.`);
    }
    if (values.has(option.value)) {
      throw new Error(
        `[PrototypePreviewer] projection ${id} control declares duplicate value "${option.value}".`
      );
    }
    values.add(option.value);
  }
  if (!values.has(currentValue)) {
    throw new Error(
      `[PrototypePreviewer] projection ${id} control has no option for current value "${currentValue}".`
    );
  }
}

function createCoordinateAttrs(options: ProjectionCompositionOptions): DemoBoxAttrs {
  return {
    'data-projection-owner': options.ownerId,
    'data-projection-family': options.projectionFamilyId,
    'data-projection-runtime': options.runtimeId,
    'data-projection-generation': String(options.generation),
  };
}

function createProjectedProto(
  prototypeId: string,
  coordinateAttrs: DemoBoxAttrs,
  themeSurfaceStyle: DemoSurfaceStyle | undefined,
  input: Omit<DemoProtoNode, 'kind' | 'prototypeId'> = {}
): DemoProtoNode {
  return {
    ...input,
    kind: 'proto',
    prototypeId,
    className: mergeClassName(
      input.className,
      'pui-projection-prototype',
      ...coordinateMarkerClasses(coordinateAttrs),
      markerClass('prototype', prototypeId)
    ),
    props: { ...(input.props ?? {}) },
    surfaceStyle: mergeSurfaceStyle(input.surfaceStyle, themeSurfaceStyle),
  };
}

function cloneProjectedChild(
  node: DemoChild,
  coordinateAttrs: DemoBoxAttrs,
  themeSurfaceStyle: DemoSurfaceStyle | undefined,
  allowedPrototypeIds: ReadonlySet<string>,
  componentRootPrototypeId: string
): DemoChild {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return { ...node };

  const children = node.children?.map((child) =>
    cloneProjectedChild(
      child,
      coordinateAttrs,
      themeSurfaceStyle,
      allowedPrototypeIds,
      componentRootPrototypeId
    )
  );
  if (node.kind === 'box') {
    return {
      ...node,
      attrs: { ...(node.attrs ?? {}), ...coordinateAttrs },
      className: mergeClassName(node.className, 'pui-projection-box'),
      children,
    };
  }

  if (!allowedPrototypeIds.has(node.prototypeId)) {
    throw new Error(
      `[PrototypePreviewer] component demo Prototype "${node.prototypeId}" is not declared by the selected projection family.`
    );
  }
  return createProjectedProto(node.prototypeId, coordinateAttrs, themeSurfaceStyle, {
    ...node,
    props: cloneJsonLike(node.props ?? {}),
    // Constrain only the declared component root through the Adapter's
    // normalized surface channel. The Website wrapper no longer reaches into
    // arbitrary demo children with CSS selectors.
    surfaceStyle: mergeSurfaceStyle(
      cloneJsonLike(node.surfaceStyle),
      node.prototypeId === componentRootPrototypeId ? { maxWidth: '100%' } : undefined
    ),
    children,
  });
}

function createSelectControl<Value extends string>(
  id: ProjectionControlId,
  currentValue: Value,
  config: ProjectionControlConfig<Value>,
  selectParts: Readonly<Record<'root' | 'trigger' | 'value' | 'content' | 'item', string>>,
  coordinateAttrs: DemoBoxAttrs,
  themeSurfaceStyle: DemoSurfaceStyle | undefined,
  locked: boolean
): DemoBoxNode {
  const refs = CONTROL_REFS[id];
  const label = {
    kind: 'box',
    className: 'pui-projection-control-label',
    attrs: {
      ...coordinateAttrs,
      'data-projection-control-label': id,
    },
    children: [config.label],
  } satisfies DemoBoxNode;
  const value = createProjectedProto(selectParts.value, coordinateAttrs, themeSurfaceStyle, {
    props: { placeholder: config.placeholder ?? config.label },
  });
  const trigger = createProjectedProto(selectParts.trigger, coordinateAttrs, themeSurfaceStyle, {
    ref: refs.trigger,
    props: { 'aria-label': config.label },
    children: [value],
  });
  const content = createProjectedProto(selectParts.content, coordinateAttrs, themeSurfaceStyle, {
    props: { position: 'popper', align: 'start' },
    children: config.options.map((option) =>
      createProjectedProto(selectParts.item, coordinateAttrs, themeSurfaceStyle, {
        props: {
          value: option.value,
          textValue: option.label,
          disabled: option.disabled === true,
        },
        children: [option.label],
      })
    ),
  });
  const root = createProjectedProto(selectParts.root, coordinateAttrs, themeSurfaceStyle, {
    ref: refs.root,
    props: { value: currentValue, disabled: locked, closeOnSelect: true },
    // Width is a host-owned normalized surface input projected by every
    // Adapter. Website CSS must not reach through the wrapper to style the
    // physical combobox surface.
    surfaceStyle: { width: '100%' },
    children: [trigger, content],
  });

  return {
    kind: 'box',
    ref: refs.box,
    className: 'pui-projection-control',
    attrs: {
      ...coordinateAttrs,
      'data-projection-control': id,
      'data-projection-id': `${id}-control`,
      'aria-disabled': String(locked),
    },
    children: [label, root],
  };
}

function eventValue(event: Event): string | undefined {
  const value = (event as CustomEvent<{ value?: unknown }>).detail?.value;
  return typeof value === 'string' ? value : undefined;
}

function callbackValue(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const value = (detail as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}

function childRefsWithin(
  contentHost: HTMLElement,
  refs: Record<string, HTMLElement>
): Record<string, HTMLElement> {
  return Object.fromEntries(
    Object.entries(refs).filter(
      ([ref, element]) => !ref.startsWith(REF_PREFIX) && contentHost.contains(element)
    )
  );
}

export function createProjectionComposition(
  options: ProjectionCompositionOptions
): ProjectionComposition {
  if (!options.ownerId.trim()) {
    throw new Error('[PrototypePreviewer] projection composition requires a stable ownerId.');
  }
  if (!Number.isSafeInteger(options.generation) || options.generation < 1) {
    throw new Error('[PrototypePreviewer] projection composition generation must be positive.');
  }
  assertDemoSpec(options.childDemo);
  assertReservedRefsAvailable(options.childDemo.root);
  const requestedControlIds = options.controlIds ?? (['runtime', 'family', 'component'] as const);
  const controlIds: ProjectionControlId[] = [];
  for (const controlId of requestedControlIds) {
    if (!Object.prototype.hasOwnProperty.call(CONTROL_REFS, controlId)) {
      throw new Error(
        `[PrototypePreviewer] projection composition declares unsupported control "${String(controlId)}".`
      );
    }
    if (!controlIds.includes(controlId)) controlIds.push(controlId);
  }

  const controlValues = {
    runtime: options.runtimeId,
    family: options.projectionFamilyId,
    component: options.componentId,
  } as const;
  for (const controlId of controlIds) {
    assertControl(
      controlId,
      controlValues[controlId],
      options.controls[controlId] as ProjectionControlConfig<string>
    );
  }

  const family = PROJECTION_FAMILY_MANIFESTS[
    options.projectionFamilyId
  ] as ProjectionFamilyManifest;
  const componentFamily = family.families[options.componentId];
  if (!componentFamily) {
    throw new Error(
      `[PrototypePreviewer] projection family ${options.projectionFamilyId} has no component ${options.componentId}.`
    );
  }
  assertProjectionRecipeClosure(
    options.childDemo.root,
    componentFamily.recipePrototypeIds,
    componentFamily.recipeId
  );
  const allowedPrototypeIds = new Set(componentFamily.recipePrototypeIds);
  const componentRootPrototypeId = resolveProjectionPart(
    options.projectionFamilyId,
    options.componentId,
    'root'
  ).prototypeId;
  const coordinateAttrs = createCoordinateAttrs(options);
  const selectParts = Object.fromEntries(
    (['root', 'trigger', 'value', 'content', 'item'] as const).map((partId) => [
      partId,
      resolveProjectionPart(options.projectionFamilyId, 'select', partId).prototypeId,
    ])
  ) as Record<'root' | 'trigger' | 'value' | 'content' | 'item', string>;

  let locked = options.locked === true;
  let eventGateOpen = options.eventGateOpen ?? !locked;
  let themeSurfaceStyle = options.themeSurfaceStyle
    ? copyThemeSurfaceStyle(options.themeSurfaceStyle)
    : undefined;
  let activeContext: DemoSetupContext | null = null;
  let stampActiveProjectionSurfaces: (() => void) | null = null;
  const projectedChild = cloneProjectedChild(
    options.childDemo.root,
    coordinateAttrs,
    themeSurfaceStyle,
    allowedPrototypeIds,
    componentRootPrototypeId
  );

  const controls = controlIds.map((id) =>
    createSelectControl(
      id,
      controlValues[id],
      options.controls[id] as ProjectionControlConfig<string>,
      selectParts,
      coordinateAttrs,
      themeSurfaceStyle,
      locked
    )
  );

  const applyLocked = (context: DemoSetupContext): void => {
    const scope = context.refs[SCOPE_REF];
    scope?.setAttribute('data-projection-state', locked ? 'preparing' : 'ready');
    scope?.setAttribute('aria-busy', String(locked));

    for (const id of controlIds) {
      const refs = CONTROL_REFS[id];
      context.refs[refs.box]?.setAttribute('aria-disabled', String(locked));
      if (locked) {
        context.api.call(refs.root, 'close', 'projection composition locked');
      }
      context.api.setProps(refs.root, { disabled: locked });
    }
  };

  const setup = (context: DemoSetupContext): (() => void) => {
    if (activeContext) {
      throw new Error('[PrototypePreviewer] projection composition is already mounted.');
    }
    const contentHost = context.refs[CONTENT_REF];
    if (!contentHost) {
      throw new Error('[PrototypePreviewer] projection composition content host is missing.');
    }

    activeContext = context;
    const listeners: Array<Readonly<{ element: HTMLElement; listener: EventListener }>> = [];
    const document = contentHost.ownerDocument;
    const view = document.defaultView;
    if (!view) {
      activeContext = null;
      throw new Error('[PrototypePreviewer] projection composition document has no window.');
    }
    const ownerMarker = markerClass('owner', options.ownerId);
    const generationMarker = markerClass('generation', String(options.generation));
    const prototypeMarkers = new Map<string, string>();
    for (const prototypeId of new Set([...allowedPrototypeIds, ...Object.values(selectParts)])) {
      prototypeMarkers.set(markerClass('prototype', prototypeId), prototypeId);
    }
    const stampProjectionSurfaces = () => {
      for (const element of Array.from(document.getElementsByClassName(ownerMarker))) {
        if (
          !(element instanceof view.HTMLElement) ||
          !element.classList.contains(generationMarker)
        ) {
          continue;
        }
        for (const [name, value] of Object.entries(coordinateAttrs)) {
          element.setAttribute(name, value);
        }
        if (themeSurfaceStyle) {
          applyProjectionThemeSurfaceStyle(element, themeSurfaceStyle);
        }
        for (const [prototypeMarker, prototypeId] of prototypeMarkers) {
          if (!element.classList.contains(prototypeMarker)) continue;
          element.setAttribute('data-projection-prototype', prototypeId);
          break;
        }
      }
    };
    stampActiveProjectionSurfaces = stampProjectionSurfaces;
    const markerObserver = new view.MutationObserver(stampProjectionSurfaces);
    let childCleanup: void | (() => void) = undefined;
    try {
      for (const id of controlIds) {
        const rootRef = CONTROL_REFS[id].root;
        const element = context.refs[rootRef];
        if (!element) {
          throw new Error(`[PrototypePreviewer] projection ${id} control root is missing.`);
        }
        const trigger = context.refs[CONTROL_REFS[id].trigger];
        if (!trigger) {
          throw new Error(`[PrototypePreviewer] projection ${id} control trigger is missing.`);
        }
        trigger.setAttribute('aria-label', options.controls[id].label);
        const handleValueChange = (value: string | undefined) => {
          if (value === undefined) return;
          if (activeContext !== context) return;
          // Close before callbacks can begin an async generation replacement.
          context.api.call(rootRef, 'close', 'projection control valueChange');
          if (locked || !eventGateOpen) return;
          const control = options.controls[id] as ProjectionControlConfig<string>;
          if (!control.options.some((option) => option.value === value && !option.disabled)) return;
          control.onValueChange(value);
        };
        if (options.runtimeId === 'wc') {
          // Web Components expose protocol events as bubbling CustomEvents.
          // Do not also install the callback prop or one physical selection
          // could request the next generation twice.
          const listener: EventListener = (event) => handleValueChange(eventValue(event));
          element.addEventListener('valueChange', listener);
          listeners.push({ element, listener });
        } else {
          // Framework Adapters expose protocol events through their native
          // callback channel rather than redispatching DOM CustomEvents.
          context.api.setProps(rootRef, {
            onValueChange: (detail: unknown) => handleValueChange(callbackValue(detail)),
          });
        }
      }

      childCleanup = options.childDemo.setup?.({
        host: contentHost,
        refs: childRefsWithin(contentHost, context.refs),
        api: context.api,
      });
      stampProjectionSurfaces();
      markerObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      applyLocked(context);
    } catch (error) {
      markerObserver.disconnect();
      for (const { element, listener } of listeners) {
        element.removeEventListener('valueChange', listener);
      }
      try {
        if (typeof childCleanup === 'function') childCleanup();
      } finally {
        if (stampActiveProjectionSurfaces === stampProjectionSurfaces) {
          stampActiveProjectionSurfaces = null;
        }
        activeContext = null;
      }
      throw error;
    }

    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;
      eventGateOpen = false;
      markerObserver.disconnect();
      try {
        for (const id of controlIds) {
          context.api.call(CONTROL_REFS[id].root, 'close', 'projection composition cleanup');
        }
        for (const { element, listener } of listeners) {
          element.removeEventListener('valueChange', listener);
        }
        if (typeof childCleanup === 'function') childCleanup();
      } finally {
        if (activeContext === context) {
          activeContext = null;
          if (stampActiveProjectionSurfaces === stampProjectionSurfaces) {
            stampActiveProjectionSurfaces = null;
          }
        }
      }
    };
  };

  const demo: DemoSpec = {
    type: 'demo',
    setup,
    root: {
      kind: 'box',
      ref: SCOPE_REF,
      className: 'pui-projection-scope',
      attrs: {
        'data-projection-scope': options.ownerId,
        'data-projection-family': options.projectionFamilyId,
        'data-projection-runtime': options.runtimeId,
        'data-projection-generation': String(options.generation),
        'data-projection-state': 'preparing',
        'aria-busy': 'true',
      },
      children: [
        {
          kind: 'box',
          className: 'pui-projection-controls',
          attrs: coordinateAttrs,
          children: controls,
        },
        {
          kind: 'box',
          ref: CONTENT_REF,
          className: 'pui-projection-content',
          attrs: {
            ...coordinateAttrs,
            'data-projection-content': '',
            'data-projection-id': options.componentId,
            'data-projection-prototype': componentRootPrototypeId,
          },
          children: [projectedChild],
        },
      ],
    },
  };
  assertDemoSpec(demo);

  return {
    demo,
    setLocked(nextLocked) {
      locked = nextLocked;
      if (activeContext) applyLocked(activeContext);
    },
    setEventGateOpen(open) {
      eventGateOpen = open;
    },
    setThemeSurfaceStyle(nextThemeSurfaceStyle) {
      themeSurfaceStyle = copyThemeSurfaceStyle(nextThemeSurfaceStyle, themeSurfaceStyle);
      stampActiveProjectionSurfaces?.();
    },
    restoreFocus(focusKey) {
      if (!activeContext) return false;
      const controlId = (Object.keys(PROJECTION_FOCUS_KEYS) as ProjectionControlId[]).find(
        (id) => PROJECTION_FOCUS_KEYS[id] === focusKey
      );
      if (!controlId) return false;
      const triggerRef = CONTROL_REFS[controlId].trigger;
      const trigger = activeContext.refs[triggerRef];
      if (!trigger) return false;
      activeContext.api.call(triggerRef, 'focusSelf', { reason: 'programmatic' });
      if (trigger.ownerDocument.activeElement !== trigger) trigger.focus();
      return true;
    },
  };
}
