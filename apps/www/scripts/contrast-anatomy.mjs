// Private audit model. Identities and multiplicities always come from the exact
// validated DemoSpec. These policies only describe existing Base L1 presence
// boundaries; they do not create a component count table or public API.
const presence = new Map([
  ['P-BASE-DIALOG-CONTENT', 'expanded'],
  ['P-BASE-DIALOG-MASK', 'expanded-mask'],
  ['P-BASE-SELECT-CONTENT', 'expanded'],
  ['P-BASE-DROPDOWN-MENU-CONTENT', 'expanded'],
  ['P-BASE-TOOLTIP-CONTENT', 'description'],
  ['P-BASE-HOVER-CARD-CONTENT', 'intent'],
  ['P-BASE-TABS-CONTENT', 'selected'],
]);

export function compileContrastAnatomy(demo, manifest) {
  const instances = [];
  const visit = (node, path, parent = null, boundary = null) => {
    if (!node || typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto') {
      if (!manifest.recipePrototypeIds.includes(node.prototypeId))
        throw new Error(`Authored anatomy identity is absent from manifest: ${node.prototypeId}`);
      const part = Object.entries(manifest.parts).find(
        ([, value]) => value.prototypeId === node.prototypeId
      );
      const policy = presence.get(part?.[1].basePrototypeId) ?? null;
      instances.push({
        path,
        parent,
        boundary,
        prototypeId: node.prototypeId,
        ref: node.ref ?? null,
        props: node.props ?? {},
        part: part?.[0] ?? null,
        basePrototypeId: part?.[1].basePrototypeId ?? null,
        policy,
      });
      parent = path;
      if (policy) boundary = path;
    }
    for (const [index, child] of (node.children ?? []).entries())
      visit(child, `${path}.children.${index}`, parent, boundary);
  };
  visit(demo.root, 'root');
  if (
    !instances.length ||
    manifest.recipePrototypeIds.some((id) => !instances.some((node) => node.prototypeId === id))
  )
    throw new Error('Authored anatomy does not materialize the complete manifest identity set.');
  return {
    recipeId: manifest.recipeId,
    rootPrototypeId: manifest.parts.root.prototypeId,
    instances,
  };
}

export function compareContrastAnatomy(plan, observed, { requirePrimaryOpen = false } = {}) {
  const failures = [];
  const matched = new Map();
  const used = new Set();
  const omitted = new Set();
  const unpaintedBoundaries = new Set();
  const retainedShellBoundaries = new Set();
  const expectations = [];
  const byPath = new Map(plan.instances.map((instance) => [instance.path, instance]));
  const actual = observed.surfaces;
  const sameParent = (surface, parent) => surface.parent === (parent?.uid ?? null);
  const knownHidden = (surface) =>
    surface.painted === false &&
    surface.visibility?.visible === false &&
    surface.visibility.classification === 'exempt-not-visible';
  const ownerFor = (instance) => {
    let owner = byPath.get(instance.parent);
    while (owner && owner.prototypeId !== plan.rootPrototypeId) owner = byPath.get(owner.parent);
    return owner;
  };
  const reject = (instance, reason, extra = {}) =>
    failures.push({ path: instance.path, prototypeId: instance.prototypeId, reason, ...extra });
  const accept = (instance, candidates, required, policy) => {
    const eligible = candidates.filter((surface) => !used.has(surface.uid));
    expectations.push({ path: instance.path, prototypeId: instance.prototypeId, required, policy });
    if (!eligible.length) {
      if (required) reject(instance, 'Missing authored materialized instance.');
      else omitted.add(instance.path);
      return;
    }
    const found = eligible[0];
    matched.set(instance.path, found);
    used.add(found.uid);
    if (
      retainedShellBoundaries.has(instance.boundary) &&
      (!found.withinContent || found.currentLease !== true || !knownHidden(found))
    )
      reject(
        instance,
        'Retained owner-shell descendants must stay hidden under the current lease.'
      );
    // A hidden unchecked Indicator remains authored anatomy. Checked/mixed
    // Indicator and every Switch Thumb must be painted at the frame boundary.
    const parent = matched.get(instance.parent);
    const mustPaint =
      instance.basePrototypeId === 'P-BASE-SWITCH-THUMB' ||
      (instance.basePrototypeId === 'P-BASE-CHECKBOX-INDICATOR' &&
        parent?.role === 'checkbox' &&
        ['true', 'mixed'].includes(parent.ariaChecked));
    if (mustPaint && !unpaintedBoundaries.has(instance.boundary) && !found.painted)
      reject(instance, 'Required current-state anatomy is not supported painted content.', {
        parentState: parent?.ariaChecked,
        visibility: found.visibility,
      });
  };
  // First bind persistent structure, so conditional Content can consult its
  // authored Trigger even when a recipe places Content before Trigger.
  for (const instance of plan.instances.filter((node) => !node.policy && !node.boundary)) {
    const parent = matched.get(instance.parent);
    if (instance.parent && !parent) {
      reject(instance, 'Authored parent is missing.');
      continue;
    }
    accept(
      instance,
      actual.filter(
        (surface) =>
          surface.withinContent &&
          sameParent(surface, parent) &&
          surface.prototypeId === instance.prototypeId &&
          surface.ref === instance.ref
      ),
      true,
      'always-authored'
    );
  }
  for (const instance of plan.instances.filter((node) => node.policy || node.boundary)) {
    const parent = matched.get(instance.parent);
    if (instance.boundary && !matched.has(instance.boundary)) {
      if (omitted.has(instance.boundary)) omitted.add(instance.path);
      else reject(instance, 'Conditional ancestor failed to materialize.');
      continue;
    }
    if (!instance.policy) {
      accept(
        instance,
        actual.filter(
          (surface) =>
            sameParent(surface, parent) &&
            surface.prototypeId === instance.prototypeId &&
            surface.ref === instance.ref
        ),
        true,
        'materialized-subtree'
      );
      continue;
    }
    const owner = ownerFor(instance);
    const ownerPhysical = owner && matched.get(owner.path);
    const triggers = owner
      ? plan.instances.filter(
          (node) => node.part === 'trigger' && ownerFor(node)?.path === owner.path
        )
      : [];
    let triggerNode = triggers[0];
    if (instance.policy === 'selected')
      triggerNode = triggers.find((node) => node.props.value === instance.props.value);
    const trigger = triggerNode && matched.get(triggerNode.path);
    if (!ownerPhysical || !trigger || (instance.policy !== 'selected' && triggers.length !== 1)) {
      reject(instance, 'No unambiguous authored owner and trigger for presence.');
      continue;
    }
    let required;
    let paintRequired;
    let ids = [];
    if (instance.policy === 'selected') {
      if (!['true', 'false'].includes(trigger.ariaSelected)) {
        reject(instance, 'Invalid Tabs selection state.');
        continue;
      }
      paintRequired = trigger.ariaSelected === 'true';
      required = paintRequired || instance.props.keepMounted === true;
      ids = trigger.controls;
    } else if (instance.policy.startsWith('expanded')) {
      if (!['true', 'false'].includes(trigger.ariaExpanded)) {
        reject(instance, 'Invalid trigger expanded state.');
        continue;
      }
      paintRequired = required = trigger.ariaExpanded === 'true';
      ids = instance.policy === 'expanded-mask' ? [] : trigger.controls;
    } else {
      // Hover/focus intent is not open truth: delayed entry and Escape may
      // leave that intent while Content is correctly detached. Only the exact
      // primary trigger's already-established open capture requires presence.
      required = requirePrimaryOpen && observed.primary === trigger.uid;
      if (instance.policy === 'description') {
        ids = trigger.descriptions;
        required ||= actual.some(
          (surface) => ids.includes(surface.id) && surface.prototypeId === instance.prototypeId
        );
      }
      paintRequired = required;
    }
    if (!paintRequired) unpaintedBoundaries.add(instance.path);
    if (
      (instance.policy === 'expanded' || (instance.policy === 'selected' && required)) &&
      ids.length !== 1
    ) {
      reject(instance, 'Presence relation must name one exact controlled target.');
      continue;
    }
    if (instance.policy === 'description' && required && ids.length === 0) {
      reject(instance, 'Open Tooltip has no owned description relation.');
      continue;
    }
    // Hover Card and Dialog Mask have no trigger-to-part ARIA relation. The
    // current one-Root recipe and lease must make that association unambiguous.
    if (
      ['intent', 'expanded-mask'].includes(instance.policy) &&
      plan.instances.filter((node) => node.prototypeId === plan.rootPrototypeId).length !== 1
    ) {
      reject(instance, 'Unrelated portaled parts cannot be assigned across multiple roots.');
      continue;
    }
    // L1 detach may retain a hidden owner shell and authored descendants, before
    // a view epoch projects its target ID (C-LIFECYCLE-0008-J). That shell is
    // structural evidence only: it cannot satisfy an open/selected relation,
    // borrow a portal exception, or turn unsupported paint into hidden proof.
    const anonymousOwnerShell = (surface) =>
      !required && surface.withinContent && surface.id === '';
    const retainedClosedShell = (surface) =>
      anonymousOwnerShell(surface) &&
      sameParent(surface, parent) &&
      surface.currentLease === true &&
      knownHidden(surface);
    // Tooltip Content owns a stable ID/role independently of presence
    // (P-BASE-TOOLTIP-CONTENT-SEMANTICS). A preserved hidden in-content view
    // is structural evidence only, never an open description or portal.
    const retainedHiddenTooltip = (surface) =>
      instance.policy === 'description' &&
      !required &&
      ids.length === 0 &&
      surface.withinContent &&
      sameParent(surface, parent) &&
      surface.currentLease === true &&
      knownHidden(surface) &&
      typeof surface.id === 'string' &&
      surface.id.length > 0 &&
      surface.role === 'tooltip' &&
      actual.filter((part) => part.id === surface.id).length === 1 &&
      actual.every(
        (part) => !part.controls.includes(surface.id) && !part.descriptions.includes(surface.id)
      );
    const mayMatchRelation =
      required || ids.length > 0 || !['selected', 'description'].includes(instance.policy);
    const candidates = actual.filter(
      (surface) =>
        surface.prototypeId === instance.prototypeId &&
        surface.ref === instance.ref &&
        // An ID relation never substitutes for the authored parent of
        // in-content structure. Tabs Content has no portal boundary;
        // only genuinely detached popup parts may lose physical parentage.
        (surface.withinContent ? sameParent(surface, parent) : instance.policy !== 'selected') &&
        (retainedClosedShell(surface) ||
          retainedHiddenTooltip(surface) ||
          (!anonymousOwnerShell(surface) &&
            mayMatchRelation &&
            (ids.length
              ? ids.includes(surface.id)
              : sameParent(surface, ownerPhysical) || !surface.withinContent)))
    );
    if (candidates.length > 1) {
      reject(instance, 'Ambiguous or duplicate materialized conditional part.');
      continue;
    }
    accept(instance, candidates, required, instance.policy);
    const content = matched.get(instance.path);
    if (content && (retainedClosedShell(content) || retainedHiddenTooltip(content)))
      retainedShellBoundaries.add(instance.path);
    if (paintRequired && content && !content.painted)
      reject(
        instance,
        'Required open/selected conditional part is not supported painted content.',
        { visibility: content.visibility }
      );
  }
  const extras = actual.filter((surface) => !used.has(surface.uid));
  return {
    achieved: observed.currentLease && failures.length === 0 && extras.length === 0,
    recipeId: plan.recipeId,
    expectations,
    failures,
    extras,
    matched: [...matched].map(([path, surface]) => ({
      path,
      uid: surface.uid,
      prototypeId: surface.prototypeId,
    })),
    omitted: [...omitted],
    basis:
      'Exact authored recipe instances, native current state/relations and current projection lease; closed detached subtrees may be omitted, or retained as exact hidden in-content owner shells. Tooltip may retain its unique stable ID/role only without an active relation. Not full semantic or cue conformance.',
  };
}
