import { createHash } from 'node:crypto';
import type { PrototypeIR } from '../ir';
import type { TargetOperationAnalysis } from '../targets';

/** Host implementation units, not component names or authored semantic hooks. */
export const nativeSupportFeatures = [
  'ownership',
  'event',
  'trigger',
  'focus',
  'entry',
  'scope',
  'roving',
  'a11y',
  'part-relationships',
  'control-label',
  'anatomy',
  'collection',
  'boundary',
  'hit',
  'positioning',
  'overlay',
  'scroll',
  'text',
  'image',
  'table',
] as const;
export type NativeSupportFeature = (typeof nativeSupportFeatures)[number];

export interface NativeSupportUnit {
  readonly imports: readonly NativeSupportFeature[];
  readonly resources: readonly string[];
  readonly cleanup: readonly string[];
}
/** The dependency and lifecycle contract is explicit; no source substring decides reachability. */
export const nativeSupportUnits: Readonly<Record<NativeSupportFeature, NativeSupportUnit>> = {
  ownership: {
    imports: [],
    resources: ['logical-owner', 'physical-root'],
    cleanup: ['unregister-owner', 'release-root'],
  },
  event: {
    imports: ['ownership'],
    resources: ['native-input-listeners'],
    cleanup: ['remove-input-listeners', 'invalidate-event-epoch'],
  },
  trigger: { imports: ['event'], resources: [], cleanup: [] },
  focus: {
    imports: ['event'],
    resources: ['focus-observations'],
    cleanup: ['reset-focus-observations', 'cancel-focus-request'],
  },
  entry: { imports: ['focus'], resources: [], cleanup: [] },
  scope: {
    imports: ['focus'],
    resources: ['scope-observations', 'scope-navigation', 'scope-topology-observer'],
    cleanup: ['cancel-entry', 'release-scope', 'remove-scope-observer'],
  },
  roving: {
    imports: ['focus'],
    resources: ['roving-observations', 'roving-navigation', 'roving-topology-observer'],
    cleanup: ['reset-roving-observations', 'remove-roving-observer'],
  },
  a11y: {
    imports: ['ownership'],
    resources: ['accessible-state-subscriptions', 'attribute-ownership'],
    cleanup: ['unsubscribe-accessible-state', 'restore-attributes'],
  },
  'part-relationships': {
    imports: ['a11y', 'anatomy'],
    resources: [
      'part-registrations',
      'part-key-subscriptions',
      'relationship-id-reservations',
      'relationship-token-leases',
    ],
    cleanup: [
      'unregister-parts',
      'unsubscribe-part-keys',
      'release-relationship-tokens',
      'release-relationship-identity',
    ],
  },
  'control-label': {
    imports: ['a11y', 'anatomy'],
    resources: [
      'control-label-pair',
      'control-label-name-lease',
      'control-label-input-listeners',
      'control-label-view-observer',
    ],
    cleanup: [
      'release-control-label-pair',
      'release-control-label-name',
      'remove-control-label-listeners',
      'disconnect-control-label-observer',
    ],
  },
  anatomy: {
    imports: ['ownership'],
    resources: ['anatomy-claims', 'anatomy-topology-observer'],
    cleanup: ['release-claims', 'remove-anatomy-observer'],
  },
  collection: {
    imports: ['anatomy'],
    resources: ['collection-state', 'collection-topology-subscription'],
    cleanup: ['unsubscribe-collection'],
  },
  boundary: {
    imports: ['ownership'],
    resources: ['boundary-regions', 'boundary-stack', 'outside-pointer-listener'],
    cleanup: ['release-boundary-stack', 'remove-outside-listener'],
  },
  hit: {
    imports: ['ownership'],
    resources: ['hit-region-claims'],
    cleanup: ['restore-hit-regions'],
  },
  positioning: {
    imports: ['ownership'],
    resources: ['floating-ui-auto-update', 'position-style-ownership'],
    cleanup: ['stop-position-update', 'restore-position-styles'],
  },
  overlay: {
    imports: ['boundary', 'positioning', 'focus'],
    resources: ['overlay-observation', 'modal-lock', 'overlay-dismiss-listeners'],
    cleanup: ['release-modal-lock', 'remove-dismiss-listeners'],
  },
  scroll: {
    imports: ['anatomy'],
    resources: [
      'scroll-observations',
      'scroll-listeners',
      'scroll-timer',
      'scroll-frame',
      'scroll-chrome',
    ],
    cleanup: ['remove-scroll-listeners', 'cancel-scroll-work', 'restore-scroll-chrome'],
  },
  text: {
    imports: ['ownership'],
    resources: ['text-input-listeners', 'text-composition'],
    cleanup: ['remove-text-listeners', 'reset-composition'],
  },
  image: {
    imports: ['ownership'],
    resources: ['image-request', 'image-completion-boundary'],
    cleanup: ['invalidate-image-request', 'remove-image-listeners'],
  },
  table: {
    imports: ['anatomy', 'a11y'],
    resources: ['table-state', 'table-projection'],
    cleanup: ['release-table-projection'],
  },
};

export interface NativeSupportPlan {
  readonly version: 2;
  readonly id: string;
  readonly roots: readonly NativeSupportFeature[];
  readonly features: readonly NativeSupportFeature[];
  readonly resources: readonly string[];
  readonly cleanup: readonly string[];
  readonly packages: readonly string[];
  readonly interactionPath: string;
  readonly modulesPath: string;
}
export function nativeSupportPlanFromFeatures(
  roots: Iterable<NativeSupportFeature>
): NativeSupportPlan {
  const rootSet = new Set(roots),
    reached = new Set<NativeSupportFeature>();
  function reach(feature: NativeSupportFeature) {
    if (reached.has(feature)) return;
    reached.add(feature);
    for (const imported of nativeSupportUnits[feature].imports) reach(imported);
  }
  for (const root of rootSet) reach(root);
  const features = nativeSupportFeatures.filter((feature) => reached.has(feature));
  const id = createHash('sha256')
    .update('dom-support-v2\0' + features.join('\0'))
    .digest('hex')
    .slice(0, 16);
  return Object.freeze({
    version: 2,
    id,
    roots: nativeSupportFeatures.filter((feature) => rootSet.has(feature)),
    features,
    resources: [...new Set(features.flatMap((feature) => nativeSupportUnits[feature].resources))],
    cleanup: [...new Set(features.flatMap((feature) => nativeSupportUnits[feature].cleanup))],
    packages: reached.has('positioning') ? ['@floating-ui/dom'] : [],
    interactionPath: `.proto-ui/interaction/native-${id}-v2.ts`,
    modulesPath: `.proto-ui/interaction/modules-${id}-v2.ts`,
  });
}
const hookFeatures: Readonly<Record<string, NativeSupportFeature>> = {
  asTrigger: 'trigger',
  asFocusable: 'focus',
  asAccessible: 'a11y',
  asControlLabel: 'control-label',
  asFocusEntry: 'entry',
  asFocusScope: 'scope',
  asFocusRoving: 'roving',
  asCollection: 'collection',
  asCollectionItem: 'collection',
  asBoundary: 'boundary',
  asHitParticipation: 'hit',
  asOverlay: 'overlay',
  asScrollSurface: 'scroll',
  asTextControl: 'text',
  asImageView: 'image',
  asTableStructure: 'table',
};
const operationFeatures: Readonly<Record<string, NativeSupportFeature>> = {
  event: 'event',
  eventControl: 'event',
  focus: 'focus',
  focusEntry: 'entry',
  focusScope: 'scope',
  focusRoving: 'roving',
  accessible: 'a11y',
  controlLabel: 'control-label',
  controlLabelRequest: 'control-label',
  anatomy: 'anatomy',
  anatomyPart: 'anatomy',
  collection: 'collection',
  collectionItem: 'collection',
  boundary: 'boundary',
  hitParticipation: 'hit',
  positioning: 'positioning',
  overlay: 'overlay',
  scroll: 'scroll',
  textControl: 'text',
  imageView: 'image',
  tableStructure: 'table',
  host: 'ownership',
};
const ownerOperations = new Set([
  'props',
  'render',
  'lifecycle',
  'state',
  'expose',
  'context',
  'style',
  'rule',
  'feedback',
  'run',
  'subscription',
  'binding',
  'scheduler',
  'delay',
  'presence',
  'presentation',
  'meta',
  'capture',
]);
/** Input is the target's reached, checked call graph; unused function bodies never become roots. */
export function planNativeSupport(
  ir: Pick<PrototypeIR, 'moduleDeclarations'>,
  admitted: Pick<TargetOperationAnalysis, 'operations'>,
  options: { ownership?: boolean } = {}
): NativeSupportPlan {
  const roots = new Set<NativeSupportFeature>(options.ownership ? ['ownership'] : []);
  for (const operation of admitted.operations) {
    if (operation === 'accessible.part' || operation === 'accessible.relation')
      roots.add('part-relationships');
    const [family, name] = operation.split('.');
    if (ownerOperations.has(family)) continue;
    const feature = family === 'hook' ? hookFeatures[name] : operationFeatures[family];
    if (!feature)
      throw new Error(
        `Missing native support dependency contract for reached operation ${operation}.`
      );
    roots.add(feature);
  }
  for (const declaration of ir.moduleDeclarations) {
    if (
      declaration.id === 'text-control' ||
      declaration.id === '@proto.ui/text-control/declaration'
    )
      roots.add('text');
    else if (
      declaration.id === 'image-view' ||
      declaration.id === '@proto.ui/image-view/declaration'
    )
      roots.add('image');
    else
      throw new Error(
        `Missing native support dependency contract for declaration ${declaration.id}.`
      );
  }
  return nativeSupportPlanFromFeatures(roots);
}
