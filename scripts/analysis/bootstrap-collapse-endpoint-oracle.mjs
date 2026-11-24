/**
 * Browser-side endpoint witness for the authored Bootstrap acceptance fixture.
 * Passed directly to page.evaluate: it has no module-scope dependencies.
 *
 * Native style calls, clocks and frame scheduling are preserved in observe mode.
 * A forced layout at candidate zero writes verifies actual geometry; this probe
 * therefore establishes application order, not a performance-budget result.
 * Mutation modes belong only to the independent oracle calibration.
 */
export function installBootstrapCloseEndpointOracle({ mode = 'observe' } = {}) {
  const modes = [
    'observe',
    'skip-zero',
    'detach-before-zero',
    'zero-on-replacement',
    'ancestor-hide-before-zero',
    'late-positive-idl',
  ];
  if (!modes.includes(mode)) throw new Error(`Unknown endpoint calibration mode: ${mode}`);
  if (globalThis.BootstrapCloseEndpointWitness)
    throw new Error('A previous close witness is still active.');

  const fixture = document.querySelector('#fixture');
  const content = fixture?.querySelector('[data-demo-ref="content"]');
  if (!fixture || !(content instanceof HTMLElement))
    throw new Error('The entered content must exist before starting its close witness.');
  const documentIdentity = content.ownerDocument;
  const styleIdentity = content.style;
  const initialAncestors = new Set();
  for (let node = content; node instanceof Element; node = node.parentElement)
    initialAncestors.add(node);
  BootstrapCollapse.remember();
  const initial = BootstrapCollapse.snapshot();
  if (initial.phase !== 'entered' || initial.hidden !== false || initial.height <= 0)
    throw new Error(`A close witness requires a visible entered owner: ${JSON.stringify(initial)}`);
  const startedAt = performance.now();
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  const originalRemove = Element.prototype.remove;
  const originalReplaceWith = Element.prototype.replaceWith;
  const zeros = [];
  const retirements = [];
  const writes = [];
  const mutationRecords = [];
  const styleTransitions = [];
  const mutations = [];
  let serial = 0;
  let finished;
  let replacement;
  let observationError;
  let requestedAt;
  let recordsDropped = 0;
  const recordLimit = 2000;
  const record = (values, value) => {
    if (values.length < recordLimit) values.push(value);
    else recordsDropped++;
  };
  const belongsToInitialView = (node) => initialAncestors.has(node);
  // Native CSSOM parsing of recorded inline styles, on one detached object.
  // This does not write the observed view or invoke any Runtime API.
  const styleParser = document.createElement('div').style;
  const parsedStyle = (text) => {
    styleParser.cssText = text ?? '';
    return {
      blockSize: styleParser.getPropertyValue('block-size'),
      display: styleParser.getPropertyValue('display'),
      visibility: styleParser.getPropertyValue('visibility'),
    };
  };
  const consume = (records) => {
    for (let index = 0; index < records.length; index++) {
      const item = records[index];
      const event = { order: ++serial, observedAt: performance.now(), type: item.type };
      if (item.type === 'attributes' && initialAncestors.has(item.target)) {
        // MutationObserver supplies the pre-write value. The next record for
        // the same attribute supplies this write's value even when multiple
        // mutations were delivered together after a synchronous retirement.
        let after = item.target.getAttribute(item.attributeName);
        for (let later = index + 1; later < records.length; later++) {
          const next = records[later];
          if (
            next.type === 'attributes' &&
            next.target === item.target &&
            next.attributeName === item.attributeName
          ) {
            after = next.oldValue;
            break;
          }
        }
        Object.assign(event, {
          attribute: item.attributeName,
          before: item.oldValue,
          after,
          content: item.target === content,
        });
        record(mutationRecords, event);
        if (
          (item.attributeName === 'hidden' ||
            item.attributeName === 'data-pui-view-detached' ||
            item.attributeName === 'data-pui-view-pending') &&
          after !== null
        )
          record(retirements, { ...event, reason: item.attributeName });
        if (item.attributeName === 'style') {
          const beforeStyle = parsedStyle(item.oldValue);
          const afterStyle = parsedStyle(after);
          if (item.target === content)
            record(styleTransitions, {
              ...event,
              beforeBlockSize: beforeStyle.blockSize,
              afterBlockSize: afterStyle.blockSize,
            });
          if (
            afterStyle.display === 'none' ||
            afterStyle.visibility === 'hidden' ||
            afterStyle.visibility === 'collapse'
          )
            record(retirements, { ...event, reason: 'hidden-inline-style' });
        }
        // A changing ancestor class could hide and restore the surface inside
        // one delivery. This fixture has no such class motion; do not infer
        // past stylesheet visibility from a final computed-style snapshot.
        if (item.attributeName === 'class' && item.oldValue !== after)
          record(retirements, { ...event, reason: 'unproved-class-visibility-change' });
      } else if (
        item.type === 'childList' &&
        Array.from(item.removedNodes).some(belongsToInitialView)
      ) {
        record(mutationRecords, { ...event, removedInitialView: true });
        record(retirements, { ...event, reason: 'removed-initial-view' });
      }
    }
  };
  const observer = new MutationObserver(consume);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      'style',
      'class',
      'hidden',
      'data-pui-view-detached',
      'data-pui-view-pending',
    ],
  });
  const zeroValue = (value) => /^[-+]?0(?:\.0+)?(?:px)?$/.test(String(value).trim());
  const currentContent = () => fixture.querySelector('[data-demo-ref="content"]');
  const wrappedSetProperty = function (name, value, priority) {
    if (this !== styleIdentity || name !== 'block-size')
      return originalSetProperty.call(this, name, value, priority);
    // Retirements already queued before this write are processed first. A
    // zero write on a detached/reinserted old surface cannot erase them.
    consume(observer.takeRecords());
    const beforeTime = performance.now();
    // Do not call public getters here: DemoRuntimeApi.call intentionally
    // requests an update, and doing so inside a native write would reenter
    // projection. The current request and physical view are native facts;
    // public owner identity is checked from the ordinary trace outside writes.
    const attemptedZero = requestedAt !== undefined && zeroValue(value);
    let result;
    if (attemptedZero && mode === 'skip-zero') {
      record(mutations, {
        order: ++serial,
        time: beforeTime,
        kind: mode,
        performed: true,
        before: styleIdentity.getPropertyValue(name),
        attempted: String(value),
      });
    } else if (attemptedZero && mode === 'detach-before-zero') {
      const wasConnected = content.isConnected;
      originalRemove.call(content);
      record(mutations, {
        order: ++serial,
        time: beforeTime,
        kind: mode,
        performed: wasConnected && !content.isConnected,
        wasConnected,
        nowConnected: content.isConnected,
      });
      consume(observer.takeRecords());
      result = originalSetProperty.call(this, name, value, priority);
    } else if (attemptedZero && mode === 'zero-on-replacement') {
      if (!replacement) {
        replacement = content.cloneNode(false);
        replacement.setAttribute('data-endpoint-calibration', 'replacement');
        originalReplaceWith.call(content, replacement);
      }
      result = originalSetProperty.call(replacement.style, name, value, priority);
      record(mutations, {
        order: ++serial,
        time: beforeTime,
        kind: mode,
        performed:
          !content.isConnected &&
          replacement.isConnected &&
          replacement.style.getPropertyValue(name) === '0px',
        oldConnected: content.isConnected,
        replacementConnected: replacement.isConnected,
        replacementValue: replacement.style.getPropertyValue(name),
      });
      consume(observer.takeRecords());
    } else {
      if (attemptedZero && mode === 'ancestor-hide-before-zero') {
        const ancestor = content.parentElement;
        if (ancestor) ancestor.hidden = true;
        record(mutations, {
          order: ++serial,
          time: beforeTime,
          kind: mode,
          performed: !!ancestor?.hidden,
          ancestorTag: ancestor?.tagName,
        });
        consume(observer.takeRecords());
      }
      result = originalSetProperty.call(this, name, value, priority);
    }

    record(writes, {
      order: ++serial,
      time: performance.now(),
      name,
      requested: String(value),
      actual: styleIdentity.getPropertyValue(name),
    });
    if (attemptedZero && zeroValue(styleIdentity.getPropertyValue(name))) {
      try {
        const sameContent = currentContent() === content;
        const connected = content.isConnected;
        const sameDocument = content.ownerDocument === documentIdentity;
        const visibility = [];
        for (let node = content; node instanceof Element; node = node.parentElement) {
          const computed = getComputedStyle(node);
          visibility.push({
            tag: node.tagName,
            hidden: node.hasAttribute('hidden'),
            detached: node.matches('[data-pui-view-detached],[data-pui-view-pending]'),
            display: computed.display,
            visibility: computed.visibility,
          });
        }
        const visible = visibility.every(
          (node) =>
            !node.hidden &&
            !node.detached &&
            node.display !== 'none' &&
            node.visibility === 'visible'
        );
        const height = content.getBoundingClientRect().height;
        const live =
          sameContent &&
          connected &&
          sameDocument &&
          visible &&
          height === 0 &&
          retirements.length === 0;
        record(zeros, {
          order: ++serial,
          time: performance.now(),
          sameContent,
          connected,
          sameDocument,
          visible,
          height,
          visibility,
          priorRetirements: retirements.length,
          live,
        });
      } catch (error) {
        observationError = String(error.stack ?? error);
      }
    }
    if (attemptedZero && mode === 'late-positive-idl') {
      // This deliberately bypasses the intercepted setProperty method. The
      // generic style MutationRecords must invalidate the earlier zero.
      content.style.blockSize = '7px';
      record(mutations, {
        order: ++serial,
        time: performance.now(),
        kind: mode,
        performed: content.style.blockSize === '7px',
        actual: content.style.blockSize,
      });
    }
    return result;
  };
  CSSStyleDeclaration.prototype.setProperty = wrappedSetProperty;
  globalThis.BootstrapCloseEndpointWitness = {
    requestStarted() {
      if (requestedAt !== undefined) throw new Error('The close request was already observed.');
      requestedAt = performance.now();
      return requestedAt;
    },
    finish(samples = []) {
      if (finished) return finished;
      consume(observer.takeRecords());
      observer.disconnect();
      const observerOwned = CSSStyleDeclaration.prototype.setProperty === wrappedSetProperty;
      if (observerOwned) CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
      const firstRetirement = retirements[0];
      const ownerSamples = samples.filter(
        (sample) =>
          requestedAt !== undefined &&
          sample.time >= requestedAt &&
          sample.phase === 'leaving' &&
          sample.bodyPresent &&
          (!firstRetirement || sample.time <= firstRetirement.observedAt)
      );
      const ownerVerified =
        initial.ownerSame &&
        ownerSamples.length > 0 &&
        ownerSamples.every((sample) => sample.ownerSame && sample.bodySame);
      const acceptedZero = zeros.find(
        (zero) =>
          zero.live &&
          firstRetirement &&
          requestedAt !== undefined &&
          zero.time >= requestedAt &&
          zero.time - requestedAt < 1000 &&
          firstRetirement.observedAt - requestedAt < 1000 &&
          zero.order < firstRetirement.order &&
          !writes.some(
            (write) =>
              write.order > zero.order &&
              write.order < firstRetirement.order &&
              write.actual !== '' &&
              !zeroValue(write.actual)
          ) &&
          !styleTransitions.some(
            (change) =>
              change.order > zero.order &&
              change.order < firstRetirement.order &&
              change.afterBlockSize !== '' &&
              !zeroValue(change.afterBlockSize)
          )
      );
      finished = {
        kind: 'native-live-owner-zero-before-retirement',
        mode,
        startedAt,
        requestedAt,
        endedAt: performance.now(),
        initial,
        writes,
        zeros,
        retirements,
        mutationRecords,
        styleTransitions,
        mutations,
        ownerSamples,
        ownerVerified,
        observerOwned,
        observationError,
        recordsDropped,
        accepted:
          !!acceptedZero &&
          ownerVerified &&
          observerOwned &&
          !observationError &&
          recordsDropped === 0,
        acceptedZero: acceptedZero ?? null,
        mutationPerformed: mutations.some((mutation) => mutation.performed),
        boundary:
          'Native application and retirement order of the initial physical view, joined with actual public owner identity in the ordinary close trace. No Runtime API is called in a native write. Layout reads at zero are observation overhead; no frame-budget or rasterization result is inferred.',
      };
      delete globalThis.BootstrapCloseEndpointWitness;
      return finished;
    },
  };
  return { startedAt, initial, mode };
}
