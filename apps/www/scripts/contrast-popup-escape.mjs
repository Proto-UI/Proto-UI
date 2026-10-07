// Audit-only transition attribution. These browser readers retain physical
// nodes in a JSHandle; IDs describe them but never replace their identity.
// They do not add a Prototype guarantee or a new planned contrast state.
export function readContrastPopupEscapeBefore({ family, trigger, popup, owner, generation }) {
  const contentPrototype = {
    tooltip: 'brutalist-tooltip-content',
    'dropdown-menu': 'brutalist-dropdown-content',
    select: 'brutalist-select-content',
    dialog: 'brutalist-dialog-content',
    'hover-card': 'brutalist-hover-card-content',
  }[family];
  const visibility = globalThis.puiContrastProbe.readContrastPaintedVisibility(popup);
  // The authored Hover Card has one Root and no aria-controls relationship.
  // Bind its sole content and Trigger to that exact current recipe ownership.
  const hoverRoots =
    family === 'hover-card'
      ? [
          ...document.querySelectorAll(
            '[data-pui-root][data-projection-prototype="brutalist-hover-card-root"]'
          ),
        ].filter(
          (element) =>
            element.getAttribute('data-projection-owner') === owner &&
            element.getAttribute('data-projection-generation') === generation
        )
      : [];
  const related =
    family === 'hover-card'
      ? hoverRoots.length === 1 &&
        hoverRoots[0].contains(trigger) &&
        trigger.getAttribute('data-projection-prototype') === 'brutalist-hover-card-trigger'
      : family === 'tooltip'
        ? (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).includes(popup.id)
        : trigger.getAttribute('aria-controls') === popup.id;
  const owned =
    !!owner &&
    !!generation &&
    [trigger, popup].every(
      (element) =>
        element.getAttribute('data-projection-owner') === owner &&
        element.getAttribute('data-projection-generation') === generation
    );
  const options =
    family === 'select'
      ? [...popup.querySelectorAll('[role="option"]')].map((element) => ({
          element,
          id: element.id,
          text: element.textContent?.trim() ?? '',
          selected: element.getAttribute('aria-selected'),
        }))
      : [];
  // P-BASE-SELECT owns committed value/textValue; M-EXPOSE-STATE-WEB-0001
  // projects them publicly. Toolbar Selects share this lease, so bind the
  // unique physical Root containing this exact Trigger, never the first Root.
  const selectRoots =
    family === 'select'
      ? [
          ...document.querySelectorAll(
            '[data-pui-root][data-projection-prototype="brutalist-select-root"]'
          ),
        ].filter(
          (element) =>
            element.contains(trigger) &&
            element.getAttribute('data-projection-owner') === owner &&
            element.getAttribute('data-projection-generation') === generation
        )
      : [];
  const selectRoot = selectRoots.length === 1 ? selectRoots[0] : null;
  const rootSelection = selectRoot
    ? {
        value: selectRoot.getAttribute('data-value'),
        textValue: selectRoot.getAttribute('data-text-value'),
        open: selectRoot.hasAttribute('data-open'),
      }
    : null;
  const observation = {
    achieved:
      !!contentPrototype &&
      trigger.isConnected &&
      popup.isConnected &&
      (family === 'hover-card' || !!popup.id) &&
      related &&
      owned &&
      popup.getAttribute('data-projection-prototype') === contentPrototype &&
      visibility.visible &&
      visibility.classification === 'source-model-visible' &&
      (family !== 'select' ||
        (selectRoot?.isConnected &&
          !selectRoot.hasAttribute('data-pui-view-detached') &&
          !selectRoot.hasAttribute('data-pui-view-pending') &&
          rootSelection.value !== null &&
          rootSelection.textValue !== null &&
          rootSelection.open === true &&
          rootSelection.textValue === (trigger.textContent?.trim() ?? '') &&
          options.length > 0 &&
          options.every((option) => option.text && ['true', 'false'].includes(option.selected)) &&
          options.filter((option) => option.selected === 'true').length === 1 &&
          new Set(options.map((option) => option.text)).size === options.length &&
          options.find((option) => option.selected === 'true')?.text ===
            (trigger.textContent?.trim() ?? ''))),
    family,
    owner,
    generation,
    popupId: popup.id,
    contentPrototype,
    related,
    owned,
    visibility,
    rootSelection,
    triggerText: trigger.textContent?.trim() ?? '',
    selection: options.map(({ id, text, selected }) => ({ id, text, selected })),
    focusWasTrigger: document.activeElement === trigger,
    focusBefore: document.activeElement
      ? {
          id: document.activeElement.id,
          tag: document.activeElement.tagName,
          role: document.activeElement.getAttribute('role'),
          prototype: document.activeElement.getAttribute('data-projection-prototype'),
        }
      : null,
  };
  return {
    trigger,
    popup,
    hoverRoot: hoverRoots[0] ?? null,
    selectRoot,
    activeElement: document.activeElement,
    options,
    observation,
  };
}

export function readContrastPopupEscapeAfter(baseline) {
  const {
    trigger,
    popup,
    hoverRoot,
    selectRoot,
    activeElement,
    options,
    observation: before,
  } = baseline;
  const visibility = globalThis.puiContrastProbe.readContrastPaintedVisibility(popup);
  const matching = [...document.querySelectorAll('[data-pui-root]')].filter(
    (element) =>
      element.getAttribute('data-projection-prototype') === before.contentPrototype &&
      element.getAttribute('data-projection-owner') === before.owner &&
      element.getAttribute('data-projection-generation') === before.generation
  );
  const sameOwnedPopup =
    trigger.isConnected &&
    trigger.getAttribute('data-projection-owner') === before.owner &&
    trigger.getAttribute('data-projection-generation') === before.generation &&
    (!popup.isConnected ||
      (popup.id === before.popupId &&
        [popup].every(
          (element) =>
            element.getAttribute('data-projection-owner') === before.owner &&
            element.getAttribute('data-projection-generation') === before.generation
        ) &&
        popup.getAttribute('data-projection-prototype') === before.contentPrototype)) &&
    (before.family === 'hover-card'
      ? matching.length === 1 &&
        matching[0] === popup &&
        hoverRoot?.isConnected &&
        hoverRoot.contains(trigger) &&
        hoverRoot.getAttribute('data-projection-owner') === before.owner &&
        hoverRoot.getAttribute('data-projection-generation') === before.generation &&
        hoverRoot.getAttribute('data-projection-prototype') === 'brutalist-hover-card-root'
      : matching.every(
          (element) => !globalThis.puiContrastProbe.readContrastPaintedVisibility(element).visible
        ));
  const selection = options.map(({ element }) => ({
    id: element.id,
    text: element.textContent?.trim() ?? '',
    selected: element.getAttribute('aria-selected'),
  }));
  const triggerText = trigger.textContent?.trim() ?? '';
  const sameOwnedSelectRoot =
    before.family === 'select' &&
    !!selectRoot?.isConnected &&
    selectRoot.contains(trigger) &&
    selectRoot.hasAttribute('data-pui-root') &&
    selectRoot.getAttribute('data-projection-prototype') === 'brutalist-select-root' &&
    selectRoot.getAttribute('data-projection-owner') === before.owner &&
    selectRoot.getAttribute('data-projection-generation') === before.generation &&
    !selectRoot.hasAttribute('data-pui-view-detached') &&
    !selectRoot.hasAttribute('data-pui-view-pending') &&
    [
      ...document.querySelectorAll(
        '[data-pui-root][data-projection-prototype="brutalist-select-root"]'
      ),
    ].filter(
      (element) =>
        element.contains(trigger) &&
        element.getAttribute('data-projection-owner') === before.owner &&
        element.getAttribute('data-projection-generation') === before.generation
    ).length === 1;
  const rootSelection = selectRoot
    ? {
        value: selectRoot.getAttribute('data-value'),
        textValue: selectRoot.getAttribute('data-text-value'),
        open: selectRoot.hasAttribute('data-open'),
      }
    : null;
  const rootSelectionUnchanged =
    sameOwnedSelectRoot &&
    rootSelection.value !== null &&
    rootSelection.textValue !== null &&
    rootSelection.value === before.rootSelection?.value &&
    rootSelection.textValue === before.rootSelection?.textValue &&
    before.rootSelection?.open === true &&
    rootSelection.open === false;
  const connectedOwnedOptions = options.every(
    ({ element }) =>
      element.isConnected &&
      popup.contains(element) &&
      element.hasAttribute('data-pui-root') &&
      element.getAttribute('data-projection-prototype') === 'brutalist-select-item' &&
      element.getAttribute('data-projection-owner') === before.owner &&
      element.getAttribute('data-projection-generation') === before.generation
  );
  const retainedOptions =
    connectedOwnedOptions &&
    options.every(
      ({ element }) =>
        element.isConnected &&
        element.getAttribute('data-projection-owner') === before.owner &&
        element.getAttribute('data-projection-generation') === before.generation &&
        element.getAttribute('role') === 'option' &&
        ['true', 'false'].includes(element.getAttribute('aria-selected'))
    );
  const retiredOptions = options.every(({ element }) => !element.isConnected);
  // A fully withdrawn closed option-view has no secondary ARIA witness.
  // This is not semantic retirement: the exact live Root remains mandatory.
  // Partial withdrawal, ownership changes and mixed connectivity fail closed.
  const optionViewWithdrawn =
    connectedOwnedOptions &&
    popup.hasAttribute('data-pui-view-detached') &&
    !visibility.visible &&
    options.every(
      ({ element, text }) =>
        element.getAttribute('role') === null &&
        element.getAttribute('aria-selected') === null &&
        element.id === '' &&
        (element.textContent?.trim() ?? '') === text
    );
  const selectionAttributesUnchanged =
    selection.length === before.selection.length &&
    selection.every(
      (option, index) =>
        option.id === before.selection[index].id &&
        option.text === before.selection[index].text &&
        option.selected === before.selection[index].selected
    );
  return {
    sameOwnedPopup,
    closed: !popup.isConnected || !visibility.visible,
    visibility,
    focusPreserved: document.activeElement === activeElement,
    triggerFocused: document.activeElement === trigger,
    ariaExpanded: trigger.getAttribute('aria-expanded'),
    descriptionRemoved: !(trigger.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .includes(before.popupId),
    selectionUnchanged:
      before.family !== 'select' ||
      (rootSelectionUnchanged &&
        triggerText === before.triggerText &&
        (retiredOptions ||
          optionViewWithdrawn ||
          (retainedOptions && selectionAttributesUnchanged))),
    retainedOptions,
    retiredOptions,
    optionViewWithdrawn,
    sameOwnedSelectRoot,
    rootSelection,
    rootSelectionUnchanged,
    selectionBasis:
      'Preserve the exact live owned Select Root public data-value/data-text-value across data-open closure and the committed Trigger display. Retained option facts must match; fully disconnected or fully withdrawn closed option views provide no secondary selection witness.',
    triggerText,
    selection,
  };
}

export async function establishContrastPopupEscapeBaseline({
  family,
  readBefore,
  pressEscape,
  waitForClosed,
  waitForFocus,
  waitForSettled = /** @type {() => Promise<void>} */ (
    async () => {
      throw new Error('Hover Card Escape requires input settling.');
    }
  ),
  readAfter,
  record,
}) {
  record.before = await readBefore();
  record.stage = 'before-escape';
  record.achieved = false;
  if (!record.before.achieved || record.before.family !== family)
    throw new Error(`${family}: Escape baseline lacks the exact visible owned popup.`);
  await pressEscape();
  if (family === 'hover-card') {
    record.stage = 'waiting-escape-retention';
    await waitForSettled();
    record.after = await readAfter();
    record.stage = 'after-escape';
    const after = record.after;
    record.achieved =
      after.sameOwnedPopup === true &&
      after.closed === false &&
      after.visibility.visible === true &&
      after.visibility.classification === 'source-model-visible' &&
      after.focusPreserved === true;
    if (!record.achieved)
      throw new Error('hover-card: Escape changed the exact painted owned popup or focus.');
    return record;
  }
  record.stage = 'waiting-escape-close';
  await waitForClosed();
  if (family !== 'tooltip') {
    record.stage = 'waiting-escape-focus';
    await waitForFocus();
  }
  record.after = await readAfter();
  record.stage = 'after-escape';
  const after = record.after;
  record.achieved =
    after.sameOwnedPopup === true &&
    after.closed === true &&
    (family === 'tooltip'
      ? after.focusPreserved === true && after.descriptionRemoved === true
      : after.triggerFocused === true && after.ariaExpanded === 'false') &&
    (family !== 'select' || after.selectionUnchanged === true);
  if (!record.achieved)
    throw new Error(
      `${family}: Escape did not establish the required closed focus/selection baseline.`
    );
  return record;
}
