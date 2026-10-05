/**
 * Self-contained, read-only page.evaluate observer. Reuse this exact function on
 * an external reference without attributing that page to the candidate Git SHA.
 * No CSS/DOM writes, clicks, fetching, runtime selection or browser zoom changes.
 */
export async function collectReadingReference() {
  const errors = [];
  // One immutable observation: memoize expensive remote DOM reads without
  // caching across captures or changing the measured fields.
  const paths = new Map();
  const styles = new Map();
  const boxes = new Map();
  const backgrounds = new Map();
  const records = new Map();
  const proseNodes = new Map();
  const allNodes = new Map();
  const normalize = (text) => text.replace(/\s+/gu, ' ').trim();
  const nodePath = (element) => {
    if (paths.has(element)) return paths.get(element);
    const parts = [];
    for (let node = element; node; node = node.parentElement) {
      const peers = node.parentElement
        ? Array.from(node.parentElement.children).filter(
            (sibling) => sibling.localName === node.localName
          )
        : [node];
      parts.unshift(`${node.localName}:nth-of-type(${peers.indexOf(node) + 1})`);
    }
    const result = parts.join(' > ');
    paths.set(element, result);
    return result;
  };
  const rect = (value) => ({
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    left: value.left,
  });
  const style = (element) => {
    if (styles.has(element)) return styles.get(element);
    const value = getComputedStyle(element);
    const result = Object.fromEntries(
      [
        'color',
        'backgroundColor',
        'backgroundImage',
        'fontFamily',
        'fontWeight',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'wordSpacing',
        'textIndent',
        'textAlign',
        'textTransform',
        'textDecoration',
        'textRendering',
        'whiteSpace',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'gap',
        'rowGap',
        'columnGap',
        'width',
        'maxWidth',
        'minWidth',
        'height',
        'boxSizing',
        'border',
        'borderRadius',
        'boxShadow',
        'outline',
        'scrollbarGutter',
        'display',
        'visibility',
        'opacity',
        'overflowX',
        'overflowY',
        'position',
        'transform',
        'zoom',
        'pointerEvents',
        'filter',
        'backdropFilter',
        'mixBlendMode',
        'isolation',
      ].map((key) => [key, value[key] ?? null])
    );
    styles.set(element, result);
    return result;
  };
  const backgroundChain = (element) => {
    if (backgrounds.has(element)) return backgrounds.get(element);
    const chain = [];
    for (let node = element; node; node = node.parentElement) {
      const computed = style(node);
      chain.push({
        path: nodePath(node),
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        backgroundImage: computed.backgroundImage,
        opacity: computed.opacity,
        filter: computed.filter,
        backdropFilter: computed.backdropFilter,
        mixBlendMode: computed.mixBlendMode,
      });
    }
    backgrounds.set(element, chain);
    return chain;
  };
  const box = (element) => {
    if (boxes.has(element)) return boxes.get(element);
    const bounds = element.getBoundingClientRect();
    let left = Math.max(0, bounds.left),
      top = Math.max(0, bounds.top);
    let right = Math.min(innerWidth, bounds.right),
      bottom = Math.min(innerHeight, bounds.bottom);
    let hiddenBy = null;
    const clippingAncestors = [];
    for (let node = element; node; node = node.parentElement) {
      const computed = style(node);
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        computed.visibility === 'collapse' ||
        computed.opacity === '0'
      )
        hiddenBy ??= nodePath(node);
      if (
        node !== element &&
        /(hidden|clip|scroll|auto)/.test(`${computed.overflowX} ${computed.overflowY}`)
      ) {
        const clip = node.getBoundingClientRect();
        clippingAncestors.push({
          path: nodePath(node),
          box: rect(clip),
          overflowX: computed.overflowX,
          overflowY: computed.overflowY,
        });
        if (/(hidden|clip|scroll|auto)/.test(computed.overflowX)) {
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
        }
        if (/(hidden|clip|scroll|auto)/.test(computed.overflowY)) {
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
      }
    }
    const result = {
      viewport: rect(bounds),
      document: {
        x: bounds.x + scrollX,
        y: bounds.y + scrollY,
        width: bounds.width,
        height: bounds.height,
      },
      clientRects:
        typeof element.getClientRects === 'function'
          ? Array.from(element.getClientRects(), rect)
          : null,
      clientRectsStatus:
        typeof element.getClientRects === 'function' ? 'available' : 'unavailable-in-observer',
      visiblePaintCandidateBox:
        hiddenBy || right <= left || bottom <= top
          ? null
          : { x: left, y: top, width: right - left, height: bottom - top },
      hiddenBy,
      clippingAncestors,
      limitation:
        'CSS border/client geometry and viewport/overflow clipping only; not pixel segmentation, occlusion verification or clicked hit-testing.',
    };
    boxes.set(element, result);
    return result;
  };
  const elementRecord = (element) => {
    if (records.has(element)) return records.get(element);
    const result = {
      path: nodePath(element),
      tag: element.localName,
      id: element.id || null,
      attributes: Object.fromEntries(
        Array.from(element.attributes)
          .filter(({ name }) => /^(data-|role$|aria-|href$|hidden$|tabindex$)/.test(name))
          .map(({ name, value }) => [name, value])
      ),
      style: style(element),
      box: box(element),
      backgroundAncestorChain: backgroundChain(element),
      lightDOM: element.getRootNode() === document,
    };
    records.set(element, result);
    return result;
  };
  const interactive =
    '[data-previewer-id],[data-code-example],.expressive-code,pre,[data-code-toolbar],.pui-projection-controls,.pagination-links,starlight-toc,nav';
  const excluded = 'script,style,template';
  const proseOnlyExcluded = '[aria-hidden="true"],.sl-anchor-link';
  const semantic = 'p,li,h1,h2,h3,h4,figcaption,caption';
  const textNodes = (owner, prose = false) => {
    const cache = prose ? proseNodes : allNodes;
    if (cache.has(owner)) return cache.get(owner);
    const nodes = [];
    const visit = (node) => {
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (!parent || !node.textContent || parent.closest(excluded)) return;
        if (prose && (parent.closest(interactive) || parent.closest(proseOnlyExcluded))) return;
        nodes.push(node);
        return;
      }
      for (const child of Array.from(node.childNodes)) visit(child);
    };
    visit(owner);
    cache.set(owner, nodes);
    return nodes;
  };
  const leaves = async (owner, prose = false) => {
    const nodes = textNodes(owner, prose);
    const parents = [
      ...new Set(
        nodes.filter((node) => normalize(node.textContent ?? '')).map((node) => node.parentElement)
      ),
    ];
    return Promise.all(
      parents.map(async (parent) => {
        const owned = nodes.filter((node) => node.parentElement === parent);
        const text = owned.map((node) => node.textContent).join('');
        return {
          ...elementRecord(parent),
          ariaHiddenAncestor: parent.closest('[aria-hidden="true"]')
            ? nodePath(parent.closest('[aria-hidden="true"]'))
            : null,
          text,
          normalizedText: normalize(text),
          textNodeRanges: owned.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return {
              childNodeIndex: Array.from(parent.childNodes).indexOf(node),
              text: node.textContent,
              clientRects: Array.from(range.getClientRects(), rect),
            };
          }),
          textSurface: parent.closest(
            '[data-typography-prototype],[data-projection-prototype$="text-root"]'
          )
            ? elementRecord(
                parent.closest(
                  '[data-typography-prototype],[data-projection-prototype$="text-root"]'
                )
              )
            : null,
        };
      })
    );
  };
  const sample = async (owner, prose = false) => {
    // aria-hidden can still paint. Always inventory its actual text/style;
    // exclude decoration only from the separately labelled authored-prose hash.
    const actualTextLeaves = await leaves(owner);
    const sourceText = textNodes(owner, prose)
      .map((node) => node.textContent)
      .join('');
    if (!actualTextLeaves.length)
      errors.push(`Existing text role has zero actual text leaves: ${nodePath(owner)}`);
    return {
      container: elementRecord(owner),
      sourceText,
      authoredProseMembership: owner.closest(proseOnlyExcluded)
        ? 'excluded-aria-hidden-or-decoration; visual-text-retained'
        : 'included',
      normalizedText: normalize(sourceText),
      actualTextLeaves,
      status: actualTextLeaves.length ? 'observed' : 'failed-empty-text',
    };
  };
  const mainMatches = [...document.querySelectorAll('main[data-pagefind-body]')];
  const main = mainMatches[0] ?? null;
  if (mainMatches.length !== 1)
    errors.push(`Expected exactly one main[data-pagefind-body], observed ${mainMatches.length}`);
  const roleDefinitions = [
    ['p', 'p', true],
    ['li', 'li', false],
    ['h1', 'h1', true],
    ['h2', 'h2', false],
    ['h3', 'h3', false],
    ['h4', 'h4', false],
    ['caption', 'figcaption,caption,[data-site-typography="caption"]', false],
  ];
  const roles = {};
  for (const [role, selector, required] of roleDefinitions) {
    const candidates = main ? [...main.querySelectorAll(selector)] : [];
    const owners = candidates.filter(
      (element) => !element.closest(interactive) && !element.closest(excluded)
    );
    const excludedOwners = candidates
      .filter((element) => !owners.includes(element))
      .map((element) => ({
        path: nodePath(element),
        reason: element.closest(interactive)
          ? 'interactive-source-owned-separately'
          : 'non-content-script-style-template',
      }));
    if (required && !owners.length) errors.push(`Required prose role ${role} absent`);
    roles[role] = {
      selector,
      required,
      count: owners.length,
      excludedOwners,
      status: owners.length ? 'observed' : required ? 'failed-absent' : 'absent-role',
      samples: await Promise.all(owners.map((owner) => sample(owner, true))),
    };
  }
  // Each source text node contributes once, under its nearest native semantic
  // owner. Carrier paths and interactive labels do not enter the prose hash.
  const proseBlocks = [];
  if (main) {
    const grouped = new Map();
    for (const node of textNodes(main, true)) {
      const owner = node.parentElement.closest(semantic);
      if (!owner || !main.contains(owner)) continue;
      if (!grouped.has(owner)) grouped.set(owner, []);
      grouped.get(owner).push(node.textContent);
    }
    for (const [owner, pieces] of grouped) {
      const text = pieces.join('');
      if (!normalize(text)) continue;
      proseBlocks.push({
        role: owner.localName,
        path: nodePath(owner),
        id: owner.id || null,
        text,
        normalizedText: normalize(text),
      });
    }
  }
  const surfaceDefinitions = {
    header: 'header',
    sidebar: '.sidebar-pane',
    toc: 'starlight-toc,.right-sidebar-panel',
    pagination: '.pagination-links',
    runtimeToolbar: '.pui-projection-controls,[data-code-toolbar]',
    demo: '[data-previewer-id]',
  };
  const surfaces = {};
  const controlsSelector =
    'button,a[href],input,select,summary,[role="button"],[role="combobox"],[role="tab"],[role="radio"]';
  for (const [name, selector] of Object.entries(surfaceDefinitions)) {
    const owners = [...document.querySelectorAll(selector)];
    const entries = [];
    for (const owner of owners) {
      const controls = [];
      for (const control of owner.querySelectorAll(controlsSelector)) {
        const actualTextLeaves = await leaves(control);
        controls.push({
          target: elementRecord(control),
          hitboxGeometry: box(control),
          hitTesting: 'not-performed',
          visiblePaint: {
            textLeaves: actualTextLeaves,
            glyphs: [...control.querySelectorAll('svg,img')].map(elementRecord),
            ownBox: box(control),
            pixelVerification: 'requires-inspecting-corresponding-PNG',
          },
        });
      }
      entries.push({
        container: elementRecord(owner),
        actualTextLeaves: await leaves(owner),
        controls,
      });
    }
    surfaces[name] = {
      selector,
      count: owners.length,
      status: owners.length ? 'observed' : 'absent-role',
      entries,
    };
  }
  roles.pagination = { ...surfaces.pagination, required: false };
  const interactiveText = [];
  for (const owner of document.querySelectorAll('[data-previewer-id],[data-code-example]')) {
    const text = textNodes(owner)
      .map((node) => node.textContent)
      .join('');
    interactiveText.push({ path: nodePath(owner), text, normalizedText: normalize(text) });
  }
  const projections = [
    ...document.querySelectorAll(
      '[data-projection-scope],[data-previewer-id],[data-typography-owner],header [data-site-select-root],header [data-theme-toggle]'
    ),
  ].map((element) => ({
    path: nodePath(element),
    tag: element.localName,
    attributes: Object.fromEntries(
      Array.from(element.attributes)
        .filter(({ name }) => name.startsWith('data-'))
        .map(({ name, value }) => [name, value])
    ),
    lightDOM: element.getRootNode() === document,
    openShadowRoot: Boolean(element.shadowRoot),
    descendantPuiRoots: element.querySelectorAll('[data-pui-root]').length,
  }));
  const fontSet = document.fonts;
  const fontFaces = fontSet && typeof fontSet[Symbol.iterator] === 'function' ? [...fontSet] : null;
  const navigatorInfo = typeof navigator === 'undefined' || !navigator ? null : navigator;
  return {
    schemaVersion: 1,
    observedAtUTC: new Date().toISOString(),
    url: location.href,
    documentLastModified: document.lastModified,
    scope:
      'Read-only reading-reference observation; capture is not design acceptance or interaction conformance.',
    viewport: {
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      devicePixelRatio,
      scrollX,
      scrollY,
      visualViewport:
        typeof visualViewport !== 'undefined' && visualViewport
          ? {
              width: visualViewport.width,
              height: visualViewport.height,
              scale: visualViewport.scale,
              offsetLeft: visualViewport.offsetLeft,
              offsetTop: visualViewport.offsetTop,
            }
          : null,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      documentClientWidth: document.documentElement.clientWidth,
      documentClientHeight: document.documentElement.clientHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      bodyClientWidth: document.body.clientWidth,
      bodyClientHeight: document.body.clientHeight,
      rootZoom: getComputedStyle(document.documentElement).zoom,
      bodyZoom: getComputedStyle(document.body).zoom,
    },
    browser: {
      navigatorStatus: navigatorInfo ? 'available' : 'unavailable-in-observer',
      userAgent: navigatorInfo?.userAgent ?? null,
      platform: navigatorInfo?.platform ?? null,
      language: navigatorInfo?.language ?? null,
      languages: navigatorInfo?.languages ? Array.from(navigatorInfo.languages) : null,
      hardwareConcurrency: navigatorInfo?.hardwareConcurrency ?? null,
      colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    },
    root: elementRecord(document.documentElement),
    body: elementRecord(document.body),
    main: main ? elementRecord(main) : null,
    fonts: fontSet
      ? {
          status: fontSet.status,
          faceEnumeration: fontFaces ? 'available' : 'unavailable-in-observer',
          faces:
            fontFaces?.map((font) => ({
              family: font.family,
              status: font.status,
              style: font.style,
              weight: font.weight,
              stretch: font.stretch,
              unicodeRange: font.unicodeRange,
            })) ?? null,
          note: 'FontFaceSet and computed stacks are observed; these do not prove which platform font painted each glyph.',
        }
      : { status: 'unavailable', faces: [] },
    roles,
    prose: {
      normalization:
        'Whitespace collapsed per nearest native p/li/h1-h4/figcaption/caption; interactive/code/navigation/aria-hidden text excluded. DOM paths excluded from content hash.',
      blocks: proseBlocks,
    },
    interactiveText,
    surfaces,
    projections,
    overlays: [
      ...document.querySelectorAll(
        '[role="dialog"],[role="listbox"],[popover],[data-state="open"]'
      ),
    ].map((element) => ({
      ...elementRecord(element),
      visibility: box(element).visiblePaintCandidateBox
        ? 'visible-geometry'
        : 'not-visible-geometry',
    })),
    isolationObservation: {
      mainInDocumentLightDOM: main?.getRootNode() === document,
      openShadowHosts: [...document.querySelectorAll('*')]
        .filter((element) => element.shadowRoot)
        .map((element) => ({ path: nodePath(element), tag: element.localName })),
      note: 'Observed attributes and open shadow roots only; closed shadow roots and unmarked runtime identity cannot be inferred.',
    },
    contentHashStatus: 'requires-host-sha256-postprocessing',
    errors,
  };
}
