import type { DemoChild, DemoSpec, DemoSetupContext } from './demo-types';

export type MaterialStagePlan = Readonly<{
  scopeRef: string;
  mountRef: string;
  overlayRef: string;
}>;
type Attachment = { dispose(): void };
type Attach = (scope: HTMLElement, mount: HTMLElement, overlay: HTMLElement) => Attachment;

/** Pure admission of trusted static demo declarations, before host/source effects.
 * This is not an untrusted-object/cycle parser. */
export function planMaterialStages(root: DemoChild): readonly MaterialStagePlan[] {
  const nodes = new Map<string, { node: Exclude<DemoChild, string>; ancestors: string[] }>();
  const plans: MaterialStagePlan[] = [];
  let duplicate = false;
  let dynamic = false;
  function visit(node: DemoChild, ancestors: string[], inStage: boolean) {
    if (typeof node === 'string' || node.kind === 'text') return;
    dynamic ||= 'dynamicChildren' in node;
    if (node.ref) {
      duplicate ||= nodes.has(node.ref);
      nodes.set(node.ref, { node, ancestors });
    }
    const stage = node.kind === 'box' ? node.materialStage : undefined;
    if (stage !== undefined) {
      if (
        !stage ||
        typeof stage !== 'object' ||
        Array.isArray(stage) ||
        typeof stage.mountRef !== 'string' ||
        !stage.mountRef ||
        typeof stage.overlayRef !== 'string' ||
        !stage.overlayRef ||
        Object.keys(stage).some((key) => key !== 'mountRef' && key !== 'overlayRef')
      )
        throw new Error('[PrototypePreviewer] invalid material stage declaration.');
      if (node.kind !== 'box' || inStage || !node.ref || (node.tag && node.tag !== 'div'))
        throw new Error(
          '[PrototypePreviewer] material stages require non-nested ref-bearing div boxes.'
        );
      plans.push({ scopeRef: node.ref, ...stage });
    }
    for (const child of node.children ?? [])
      visit(child, node.ref ? [...ancestors, node.ref] : ancestors, inStage || !!stage);
  }
  visit(root, [], false);
  if (!plans.length) return plans;
  if (duplicate || dynamic)
    throw new Error(
      '[PrototypePreviewer] material stages require unique refs and static children.'
    );
  const targets = new Set<string>();
  for (const plan of plans) {
    for (const ref of [plan.mountRef, plan.overlayRef]) {
      const entry = nodes.get(ref);
      if (
        !entry ||
        entry.node.kind !== 'box' ||
        (entry.node.tag && entry.node.tag !== 'div') ||
        !entry.ancestors.includes(plan.scopeRef) ||
        targets.has(ref)
      )
        throw new Error(
          '[PrototypePreviewer] material stage targets must be distinct descendant div boxes.'
        );
      targets.add(ref);
    }
    const mount = nodes.get(plan.mountRef)!;
    const overlay = nodes.get(plan.overlayRef)!;
    if (
      mount.ancestors.includes(plan.overlayRef) ||
      overlay.ancestors.includes(plan.mountRef) ||
      (overlay.node.kind === 'box' && overlay.node.children?.length)
    )
      throw new Error(
        '[PrototypePreviewer] material stage flow and empty overlay must be disjoint.'
      );
  }
  return plans;
}

function finish(steps: readonly (() => void)[], primary: readonly unknown[] = []) {
  const errors = [...primary];
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'Material stage cleanup failed.');
}

/** One original framework tree/API/setup. Attachments never own framework DOM. */
export function withMaterialStages(
  demo: DemoSpec,
  plans: readonly MaterialStagePlan[],
  attach: Attach,
  isCurrent: () => boolean
): DemoSpec {
  return {
    ...demo,
    setup(ctx: DemoSetupContext) {
      const scenes: Attachment[] = [];
      let userCleanup: void | (() => void);
      let retired = false;
      const cleanup = () => {
        if (retired) return;
        retired = true;
        // Revoke sources before user/framework teardown; every cleanup runs.
        finish([
          ...scenes.reverse().map((scene) => () => scene.dispose()),
          () => {
            if (typeof userCleanup === 'function') userCleanup();
          },
        ]);
      };
      try {
        const targets = new Set<HTMLElement>();
        const resolved = plans.map((plan) => {
          const scope = ctx.refs[plan.scopeRef],
            mount = ctx.refs[plan.mountRef],
            overlay = ctx.refs[plan.overlayRef];
          for (const el of [scope, mount, overlay]) {
            if (!el || !el.isConnected || !ctx.host.contains(el) || targets.has(el))
              throw new Error(
                '[PrototypePreviewer] material stage DOM refs are missing, stale or aliased.'
              );
            targets.add(el);
          }
          if (
            !scope.contains(mount) ||
            !scope.contains(overlay) ||
            mount.contains(overlay) ||
            overlay.contains(mount)
          )
            throw new Error(
              '[PrototypePreviewer] material stage DOM ownership does not match its plan.'
            );
          return { scope, mount, overlay };
        });
        for (const { scope, mount, overlay } of resolved) {
          if (!isCurrent()) {
            cleanup();
            return;
          }
          scenes.push(attach(scope, mount, overlay));
        }
        if (!isCurrent()) {
          cleanup();
          return;
        }
        userCleanup = demo.setup?.(ctx);
        if (!isCurrent()) {
          cleanup();
          return;
        }
        return cleanup;
      } catch (error) {
        finish([cleanup], [error]);
      }
    },
  };
}
