import { parseContrastRuntimeOptions } from './contrast-audit-plan.mjs';

export const TOOLTIP_WARM_HANDOFF_STATE = 'warm-sibling-handoff';
// This is the existing native consumer's observation allowance, not the
// semantic delay: P-BASE-TOOLTIP-GROUP-WARMTH requires a zero-delay request.
export const TOOLTIP_WARM_OBSERVATION_MS = 300;

const text = (node) => {
  if (typeof node === 'string') return node;
  if (node?.kind === 'text') return node.text ?? '';
  return (node?.children ?? []).map(text).join('');
};
const delay = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error(`Tooltip audit requires an explicit finite ${name}.`);
  return value;
};

/** Derive the finite audit journey from the authored consumer, not another popup. */
export function compileTooltipWarmHandoffPlan(demo, serializedRuntimes) {
  const runtimes = parseContrastRuntimeOptions(serializedRuntimes, ['wc', 'react', 'vue']);
  const groups = [];
  const visit = (node, path) => {
    if (!node || typeof node === 'string') return;
    if (node.kind === 'proto' && node.prototypeId === 'brutalist-tooltip-group')
      groups.push({ node, path });
    (node.children ?? []).forEach((child, index) => visit(child, `${path}.children.${index}`));
  };
  visit(demo?.root, 'root');
  if (groups.length !== 1)
    throw new Error('Tooltip handoff requires one authored shared Group.');
  const { node: group, path } = groups[0];
  const roots = group.children ?? [];
  if (
    roots.length !== 2 ||
    roots.some((root) => root?.kind !== 'proto' || root.prototypeId !== 'brutalist-tooltip-root')
  )
    throw new Error('Tooltip handoff requires two authored sibling Roots in that Group.');
  const openDelay = delay(group.props?.openDelay, 'Group openDelay');
  const closeDelay = delay(group.props?.closeDelay, 'Group closeDelay');
  const skipDelay = delay(group.props?.skipDelay, 'Group skipDelay');
  if (openDelay <= TOOLTIP_WARM_OBSERVATION_MS || skipDelay <= 0 || closeDelay !== 0)
    throw new Error('The authored recipe must distinguish cold delay from the native warm budget.');
  const pairs = roots.map((root, index) => {
    if (
      ['open', 'defaultOpen', 'disabled', 'openDelay', 'closeDelay'].some(
        (name) => root.props && Object.hasOwn(root.props, name)
      )
    )
      throw new Error('This finite audit requires the authored uncontrolled, Group-delayed Roots.');
    const children = root.children ?? [];
    const trigger = children.filter((child) => child?.prototypeId === 'brutalist-tooltip-trigger');
    const content = children.filter((child) => child?.prototypeId === 'brutalist-tooltip-content');
    if (children.length !== 2 || trigger.length !== 1 || content.length !== 1)
      throw new Error('Each authored Tooltip Root must own one Trigger and one Content.');
    const triggerText = text(trigger[0]);
    const contentText = text(content[0]);
    if (!triggerText.trim() || !contentText.trim())
      throw new Error('Tooltip audit requires the authored Trigger and Content descriptions.');
    return {
      rootPath: `${path}.children.${index}`,
      triggerPath: `${path}.children.${index}.children.${children.indexOf(trigger[0])}`,
      contentPath: `${path}.children.${index}.children.${children.indexOf(content[0])}`,
      triggerText,
      contentText,
    };
  });
  return {
    recipeId: 'demo-brutalist-tooltip',
    route: '/en/ui-libraries/brutalist/components/tooltip/',
    groupPath: path,
    pairs,
    openDelay,
    closeDelay,
    skipDelay,
    coldGuardMs: 100,
    coldDeadlineMs: openDelay + 2000,
    warmDeadlineMs: TOOLTIP_WARM_OBSERVATION_MS,
    cells: runtimes.flatMap((runtime) => ['light', 'dark'].map((theme) => ({ runtime, theme }))),
    authority: [
      'P-BASE-TOOLTIP-GROUP-DELAYS',
      'P-BASE-TOOLTIP-GROUP-WARMTH',
      'P-BASE-TOOLTIP-GROUP-INSTANT-HANDOFF',
      'P-BASE-TOOLTIP-GROUP-LIFETIME',
      'P-BASE-TOOLTIP-TRIGGER-DESCRIPTION',
    ],
  };
}

/**
 * One forward-only native journey. A failed cold, lease, handoff or capture
 * barrier propagates before any subsequent input. The caller owns diagnostics;
 * there is no corrective reset, retry, focus seed or fallback activation here.
 */
export async function runTooltipWarmHandoff({ arm, hover, wait, capture, record }) {
  record.stage = 'cold-pointer-arm';
  await arm('cold');
  record.stage = 'cold-native-hover';
  await hover(0);
  record.stage = 'cold-observation';
  record.cold = await wait('cold');
  if (record.cold.achieved !== true)
    throw new Error('Tooltip cold opening did not satisfy its native timing/ownership boundary.');
  record.stage = 'cold-capture';
  await capture('hover');
  await capture('hover-open');
  record.stage = 'warm-pointer-arm';
  await arm('warm');
  record.stage = 'warm-native-hover';
  await hover(1);
  record.stage = 'warm-observation';
  record.warm = await wait('warm');
  if (record.warm.achieved !== true)
    throw new Error('Tooltip warm sibling handoff did not satisfy its native boundary.');
  record.stage = 'warm-capture';
  await capture(TOOLTIP_WARM_HANDOFF_STATE);
  record.stage = 'captured';
  return record;
}
