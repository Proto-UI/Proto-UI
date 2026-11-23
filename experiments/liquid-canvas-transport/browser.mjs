import { createWebOpticalProgram } from '../../packages/adapters/base/src/material/program.ts';
import {
  prepareOpticalImage,
  inspectOpticalImageResources,
} from '../../packages/adapters/base/src/material/image-prepare.ts';
import { createCanvasSnapshotOwner, createNativeCanvasPort } from './owner.ts';
import {
  PROTOCOL,
  GEOMETRY,
  SOURCE,
  PIXEL_CASES,
  STAGE_CASES,
  LIFETIME_REQUIREMENTS,
  CONTROL_IDS,
} from './protocol.mjs';

const message = (error) => (error instanceof Error ? error.message : String(error));
const requireFact = (value, reason) => {
  if (!value) throw new Error(reason);
};
const delta = (after, before) =>
  Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - (before[key] ?? 0)]));
const equal = (a, b) =>
  !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        typeof value === 'string' ? new TextEncoder().encode(value) : value
      )
    ),
    (byte) => byte.toString(16).padStart(2, '0')
  ).join('');
const plane = (pixels, width, height) => {
  let binary = '';
  for (let at = 0; at < pixels.length; at += 8192)
    binary += String.fromCharCode(...pixels.subarray(at, at + 8192));
  return { width, height, base64: btoa(binary) };
};
const deadline = async (promise, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}-timeout`)), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export async function collectCanvasTransport(configuredDpr) {
  const report = {
    protocol: PROTOCOL,
    dpr: configuredDpr,
    environment: {
      devicePixelRatio,
      secureContext: isSecureContext,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
    },
    pixels: PIXEL_CASES.filter((item) => item.dpr === configuredDpr).map((item) => ({
      ...item,
      status: 'unattempted',
    })),
    stages:
      configuredDpr === 1 ? STAGE_CASES.map((item) => ({ ...item, status: 'unattempted' })) : [],
    lifetime:
      configuredDpr === 1
        ? Object.keys(LIFETIME_REQUIREMENTS).map((id) => ({ id, status: 'unattempted' }))
        : [],
    controls: configuredDpr === 1 ? CONTROL_IDS.map((id) => ({ id, status: 'unattempted' })) : [],
    errors: [],
    cleanup: {},
  };
  // The owned probe page can retain a partial receipt if evaluation is interrupted.
  globalThis.__puiOwnedCanvasTransportEvidence = report;
  const ownedCanvases = new Set(),
    oracleCanvases = new Set(),
    oracleImages = new Set(),
    releases = new Set();
  const bindings = [],
    sourceStates = [],
    sourcesByTheme = new Map(),
    sourceOwners = new WeakMap();
  const producer = document.createElement('canvas');
  const originalEncoder = producer.toDataURL;
  const originalDescriptor = Object.getOwnPropertyDescriptor(producer, 'toDataURL');
  let program = null,
    gl = null,
    producerEpoch = 0,
    activeFrame = null,
    sourceDraws = 0;
  const glResources = {},
    restoreGlObservers = [];
  const error = (stage, fault) => report.errors.push({ stage, message: message(fault) });
  const trackGl = (kind) => {
    const createName = `create${kind}`,
      deleteName = `delete${kind}`;
    const create = gl[createName],
      remove = gl[deleteName],
      live = new Set();
    const row = { created: 0, retired: 0, live: 0, doubleDeletes: 0 };
    glResources[kind] = row;
    gl[createName] = function (...args) {
      const resource = create.apply(this, args);
      if (resource) {
        live.add(resource);
        row.created++;
        row.live = live.size;
      }
      return resource;
    };
    gl[deleteName] = function (resource) {
      if (resource) {
        if (live.delete(resource)) row.retired++;
        else row.doubleDeletes++;
        row.live = live.size;
      }
      return remove.call(this, resource);
    };
    restoreGlObservers.push(() => {
      gl[createName] = create;
      gl[deleteName] = remove;
    });
  };
  function sourceState(theme, name = theme) {
    const scope = document.createElement('div'),
      canvas = document.createElement('canvas');
    scope.dataset.experimentSource = name;
    scope.style.cssText = `position:relative;width:${SOURCE.width}px;height:${SOURCE.height}px;margin:0;padding:0;border:0`;
    canvas.style.cssText = `display:block;width:${SOURCE.width}px;height:${SOURCE.height}px;margin:0;padding:0;border:0`;
    canvas.width = Math.ceil(SOURCE.width * devicePixelRatio);
    canvas.height = Math.ceil(SOURCE.height * devicePixelRatio);
    scope.append(canvas);
    document.body.append(scope);
    const context = canvas.getContext('2d', {
      alpha: false,
      colorSpace: 'srgb',
      willReadFrequently: true,
    });
    requireFact(
      context && context.getContextAttributes().colorSpace === 'srgb',
      'source-srgb-context-unavailable'
    );
    const state = { scope, canvas, context, revision: 0, frame: null };
    state.update = (phase) => {
      const width = canvas.width,
        height = canvas.height,
        data = new Uint8ClampedArray(width * height * 4);
      const base = theme === 'light' ? 192 : 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const at = (y * width + x) * 4;
          data[at] = base + ((Math.floor(x / devicePixelRatio) + phase) % 64);
          data[at + 1] = base + ((Math.floor(y / devicePixelRatio) + 3 * phase) % 64);
          data[at + 2] = base + ((Math.floor((x + y) / devicePixelRatio) + 5 * phase) % 64);
          data[at + 3] = 255;
        }
      context.putImageData(new ImageData(data, width, height, { colorSpace: 'srgb' }), 0, 0);
      const actual = context.getImageData(0, 0, width, height).data;
      requireFact(equal(actual, data), 'source-native-readback-differs');
      state.frame = Object.freeze({
        revision: ++state.revision,
        width,
        height,
        pixels: new Uint8Array(actual),
        canvas,
        scope,
      });
      sourceOwners.set(state.frame, state);
      sourceDraws++;
      return state.frame;
    };
    state.update(0);
    sourceStates.push(state);
    return state;
  }
  function binding(name) {
    const target = document.createElement('div');
    target.dataset.experimentOwner = name;
    document.body.append(target);
    const native = createNativeCanvasPort(document);
    const state = {
      target,
      live: true,
      frame: null,
      geometryRevision: 0,
      lastStorage: null,
      lastDraw: null,
      native,
      port: null,
      owner: null,
    };
    state.port = {
      ...native,
      create(width, height) {
        const resource = native.create(width, height);
        ownedCanvases.add(resource.canvas);
        state.lastStorage = resource;
        return resource;
      },
      copy(storage, source) {
        const started = performance.now();
        native.copy(storage, source);
        state.lastDraw = { started, finished: performance.now() };
      },
      retire(resource) {
        try {
          native.retire(resource);
        } finally {
          if (resource.canvas.width === 0 && resource.canvas.height === 0)
            ownedCanvases.delete(resource.canvas);
        }
      },
    };
    state.owner = createCanvasSnapshotOwner(target, state.port);
    bindings.push(state);
    return state;
  }
  function frameFor(owner, source, item = {}, size = GEOMETRY) {
    source.scope.append(owner.target);
    owner.target.style.cssText = `position:absolute;box-sizing:border-box;left:${SOURCE.left}px;top:${SOURCE.top}px;width:${size.width}px;height:${size.height}px;border:0;padding:0;margin:0;border-radius:${size.radius}px`;
    const box = owner.target.getBoundingClientRect(),
      sourceBox = source.canvas.getBoundingClientRect();
    const geometry = Object.freeze({
      width: box.width,
      height: box.height,
      radius: size.radius,
      paintOutset: size.paintOutset,
      dpr: devicePixelRatio,
      bounds: [
        (box.left - sourceBox.left) / sourceBox.width,
        (box.top - sourceBox.top) / sourceBox.height,
        box.width / sourceBox.width,
        box.height / sourceBox.height,
      ],
    });
    const dark = item.theme === 'dark',
      contact = item.state === 'contact';
    const frame = Object.freeze({
      source,
      geometry,
      pressed: contact,
      ...(contact ? { contact: { x: 0.5, y: 0.5, deltaX: 0.04, deltaY: -0.03, strength: 1 } } : {}),
      variant: item.profile === 'neutral-clear' ? 'clear' : 'regular',
      ...(item.profile === 'style-tint' ? { tint: 'style-fill' } : {}),
      fill: dark ? [0.08, 0.14, 0.2, 1] : [0.9, 0.8, 0.6, 1],
      foreground: dark ? [1, 1, 1, 1] : [0, 0, 0, 1],
    });
    owner.frame = frame;
    owner.geometryRevision++;
    return frame;
  }
  function render(frame, owner = null, order = 'before') {
    const epoch = ++producerEpoch;
    activeFrame = frame;
    const geometryRevision = owner?.geometryRevision;
    const source = frame.source,
      geometry = frame.geometry;
    const identity = Object.freeze({
      sourceRevision: source.revision,
      geometryRevision: geometryRevision ?? 0,
      producerEpoch: epoch,
      logicalWidth: geometry.width,
      logicalHeight: geometry.height,
      paintOutset: geometry.paintOutset ?? 0,
      dpr: geometry.dpr,
    });
    const guards = {
      ownerCurrent: () => {
        if (
          owner?.live !== true ||
          owner.frame !== frame ||
          owner.geometryRevision !== geometryRevision ||
          sourceOwners.get(source)?.frame !== source ||
          source.canvas.ownerDocument !== document ||
          source.canvas.parentElement !== source.scope ||
          !source.canvas.isConnected ||
          source.canvas.width !== source.width ||
          source.canvas.height !== source.height
        )
          return false;
        const box = owner.target.getBoundingClientRect(),
          sourceBox = source.canvas.getBoundingClientRect();
        return (
          box.width === geometry.width &&
          box.height === geometry.height &&
          (box.left - sourceBox.left) / sourceBox.width === geometry.bounds[0] &&
          (box.top - sourceBox.top) / sourceBox.height === geometry.bounds[1] &&
          box.width / sourceBox.width === geometry.bounds[2] &&
          box.height / sourceBox.height === geometry.bounds[3]
        );
      },
      producerCurrent: () => producerEpoch === epoch && activeFrame === frame,
    };
    const row = {
      encoderCalls: 0,
      copyCalls: 0,
      encoderArguments: null,
      encoderReturnMatchesProgram: false,
      timestamps: {},
      identity,
      geometry,
      targetRect: owner
        ? {
            width: owner.target.getBoundingClientRect().width,
            height: owner.target.getBoundingClientRect().height,
          }
        : null,
    };
    const descriptor = Object.getOwnPropertyDescriptor(producer, 'toDataURL');
    let encoded,
      png,
      ticket = null,
      candidatePixels = null,
      copyError = null;
    const beforeProgram = program.inspect();
    const copy = () => {
      if (!owner) return;
      row.copyCalls++;
      row.timestamps.copyStart = performance.now();
      try {
        ticket = owner.owner.capture(producer, identity, guards);
        row.timestamps.copySubmitted = performance.now();
        if (ticket) candidatePixels = ticket.readPixels();
        row.timestamps.copyReadbackEnd = performance.now();
        row.nativeDraw = owner.lastDraw;
      } catch (fault) {
        copyError = message(fault);
        row.timestamps.copyReadbackEnd = performance.now();
      }
    };
    Object.defineProperty(producer, 'toDataURL', {
      configurable: true,
      writable: true,
      value(...args) {
        if (order === 'before') copy();
        row.encoderCalls++;
        row.encoderArguments = args.slice();
        row.timestamps.encodeStart = performance.now();
        try {
          encoded = originalEncoder.apply(producer, args);
        } finally {
          row.timestamps.encodeEnd = performance.now();
        }
        if (order === 'after') copy();
        return encoded;
      },
    });
    row.timestamps.renderStart = performance.now();
    try {
      png = program.render(frame);
    } catch (fault) {
      row.renderError = message(fault);
    } finally {
      row.timestamps.renderEnd = performance.now();
      if (descriptor) Object.defineProperty(producer, 'toDataURL', descriptor);
      else delete producer.toDataURL;
    }
    row.programCounters = delta(program.inspect(), beforeProgram);
    row.width = producer.width;
    row.height = producer.height;
    row.encoderReturnMatchesProgram = typeof png === 'string' && png === encoded;
    if (copyError) row.copyError = copyError;
    if (owner?.lastStorage) row.copyContext = owner.lastStorage.context.getContextAttributes();
    return { ...row, png, ticket, candidatePixels, storage: owner?.lastStorage ?? null };
  }
  function oracleCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    oracleCanvases.add(canvas);
    const context = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: true,
    });
    requireFact(
      context?.getContextAttributes().alpha === true &&
        context.getContextAttributes().colorSpace === 'srgb',
      'oracle-srgb-alpha-unavailable'
    );
    return { canvas, context };
  }
  function retireOracle(canvas) {
    canvas.width = 0;
    canvas.height = 0;
    oracleCanvases.delete(canvas);
  }
  function oracleRead(source, width, height, background = null) {
    const { canvas, context } = oracleCanvas(width, height);
    try {
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
      }
      context.globalCompositeOperation = 'source-over';
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 0, 0);
      requireFact(!context.isContextLost(), 'oracle-context-lost');
      return {
        pixels: new Uint8ClampedArray(context.getImageData(0, 0, width, height).data),
        attributes: context.getContextAttributes(),
      };
    } finally {
      retireOracle(canvas);
    }
  }
  async function observedPixels(result, composites) {
    requireFact(!result.renderError && !result.copyError, result.renderError ?? result.copyError);
    requireFact(
      result.ticket && result.candidatePixels && result.png?.startsWith('data:image/png;base64,'),
      'same-render-snapshot-unavailable'
    );
    const beforeImages = inspectOpticalImageResources(document),
      timestamps = result.timestamps;
    let release, oracle;
    try {
      timestamps.decodeStart = performance.now();
      const ready = new Promise((resolve, reject) => {
        release = prepareOpticalImage(
          document,
          result.png,
          () => {
            timestamps.decodeReady = timestamps.callbackStart = performance.now();
            resolve();
            timestamps.callbackEnd = performance.now();
          },
          () => reject(new Error('production-image-decode-failed'))
        );
        releases.add(release);
      });
      await deadline(ready, 'production-image-decode');
      const afterImages = inspectOpticalImageResources(document);
      // This second, independent decode is an untimed oracle, not part of the
      // production decode wall sample and never a substitute for it.
      oracle = new Image();
      oracleImages.add(oracle);
      const oracleStarted = performance.now();
      oracle.src = result.png;
      await deadline(oracle.decode(), 'independent-png-decode');
      const oracleDecodeMs = performance.now() - oracleStarted;
      requireFact(
        oracle.complete &&
          oracle.naturalWidth === result.width &&
          oracle.naturalHeight === result.height,
        'independent-png-dimensions'
      );
      const reference = oracleRead(oracle, result.width, result.height);
      const planes = {
        candidateRaw: plane(result.candidatePixels, result.width, result.height),
        referenceRaw: plane(reference.pixels, result.width, result.height),
      };
      if (composites) {
        for (const [name, color] of [
          ['Black', '#000000'],
          ['White', '#ffffff'],
        ]) {
          planes[`candidate${name}`] = plane(
            oracleRead(result.storage.canvas, result.width, result.height, color).pixels,
            result.width,
            result.height
          );
          planes[`reference${name}`] = plane(
            oracleRead(oracle, result.width, result.height, color).pixels,
            result.width,
            result.height
          );
        }
      }
      const { png, ticket, candidatePixels, storage, ...serializable } = result;
      return {
        ...serializable,
        sourceRevision: result.identity.sourceRevision,
        planes,
        pngSha256: await digest(result.png),
        png: result.png,
        oracleContext: reference.attributes,
        oracleDecodeMs,
        imageCounters: delta(afterImages, beforeImages),
        referencePixels: reference.pixels,
      };
    } finally {
      if (oracle) {
        oracle.src = '';
        oracleImages.delete(oracle);
      }
      if (release) {
        release();
        releases.delete(release);
      }
    }
  }
  async function collectRow(row, owner, source, item, composites) {
    let result;
    try {
      row.status = 'failed';
      const frame = frameFor(owner, source, item);
      result = render(frame, owner, row.order);
      const data = await observedPixels(result, composites);
      const reference = data.referencePixels;
      delete data.referencePixels;
      Object.assign(row, data, { status: 'ok' });
      return {
        reference,
        candidate: result.candidatePixels.slice(),
        png: result.png,
        width: result.width,
        height: result.height,
      };
    } catch (fault) {
      if (result) {
        const { png, ticket, candidatePixels, storage, ...partial } = result;
        Object.assign(row, partial);
        if (png) {
          row.png = png;
          row.pngSha256 = await digest(png);
        }
      }
      row.status = 'failed';
      row.error = message(fault);
      return null;
    } finally {
      result?.ticket?.release();
    }
  }
  const lifetime = async (id, operation) => {
    const row = report.lifetime.find((row) => row.id === id);
    row.status = 'failed';
    try {
      row.actual = await operation(row);
      row.status = 'ok';
    } catch (fault) {
      row.error = message(fault);
    }
  };
  const take = (owner, source, item, size) => {
    const result = render(frameFor(owner, source, item, size), owner);
    requireFact(
      !result.renderError && !result.copyError && result.ticket && result.candidatePixels,
      result.renderError ?? result.copyError ?? 'lifetime-copy-unavailable'
    );
    return result;
  };
  let lightReference = null,
    darkReference = null,
    borrowedControl = null;
  try {
    requireFact(
      configuredDpr === devicePixelRatio && isSecureContext,
      'native-context-does-not-match-request'
    );
    gl = producer.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    requireFact(gl && !gl.isContextLost(), 'real-webgl-unavailable');
    report.environment.webglAttributes = gl.getContextAttributes();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    report.environment.webglRenderer = gl.getParameter(
      debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER
    );
    report.environment.webglVendor = gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR);
    for (const kind of ['Buffer', 'Framebuffer', 'Program', 'Shader', 'Texture']) trackGl(kind);
    program = createWebOpticalProgram(producer);
    for (const theme of ['light', 'dark']) sourcesByTheme.set(theme, sourceState(theme));
    const main = binding('pixel-and-stage-owner');
    for (const row of report.pixels) {
      const result = await collectRow(row, main, sourcesByTheme.get(row.theme).frame, row, true);
      if (row.profile === 'neutral-regular' && row.state === 'rest' && row.order === 'before') {
        if (row.theme === 'light') lightReference = result;
        else darkReference = result;
      }
    }
    if (configuredDpr === 1) {
      const dynamic = sourceState('light', 'dynamic-source');
      let phase = 0;
      for (const row of report.stages) {
        const source =
          row.workload === 'dynamic' ? dynamic.update(++phase) : sourcesByTheme.get('light').frame;
        await collectRow(
          row,
          main,
          source,
          { theme: 'light', profile: 'neutral-regular', state: 'contact' },
          false
        );
      }
      const light = () => sourcesByTheme.get('light').frame,
        dark = () => sourcesByTheme.get('dark').frame;
      await lifetime('shared-producer-a-b-a', (row) => {
        const a = binding('consumer-a'),
          b = binding('consumer-b');
        const first = take(a, light()),
          savedA = first.candidatePixels.slice();
        const second = take(b, dark(), { theme: 'dark' }),
          savedB = second.candidatePixels.slice();
        const borrowed = oracleRead(producer, second.width, second.height).pixels;
        borrowedControl = {
          candidate: plane(borrowed, second.width, second.height),
          reference: plane(savedA, first.width, first.height),
        };
        const afterB = first.ticket.readPixels();
        const aRetainedAfterB = equal(afterB, savedA),
          bDifferent = !equal(savedA, savedB);
        take(a, light(), { state: 'contact' });
        const afterA = second.ticket.readPixels();
        row.planes = {
          aOriginal: plane(savedA, first.width, first.height),
          aAfter: plane(afterB, first.width, first.height),
          bOriginal: plane(savedB, second.width, second.height),
          bAfter: plane(afterA, second.width, second.height),
        };
        const actual = {
          aRetainedAfterB,
          bDifferent,
          aOldRetired: first.ticket.readPixels() === null,
          bRetainedAfterA: equal(afterA, savedB),
        };
        a.owner.dispose();
        b.owner.dispose();
        return actual;
      });
      for (const kind of ['source', 'geometry'])
        await lifetime(`${kind}-supersession`, () => {
          const a = binding(`${kind}-supersession`),
            source = sourceState('light', `${kind}-supersession`),
            result = take(a, source.frame);
          if (kind === 'source') source.update(1);
          else a.target.style.width = `${GEOMETRY.width + 1}px`;
          const actual = {
            readable: result.ticket.readPixels() !== null,
            live: a.owner.inspect().live,
          };
          a.owner.dispose();
          return actual;
        });
      await lifetime('alternating-physical-sizes', () => {
        const a = binding('size-changes'),
          tickets = [];
        let exactDimensions = true;
        for (const size of [
          GEOMETRY,
          { width: 93.5, height: 26.25, radius: 10, paintOutset: 9 },
          GEOMETRY,
        ]) {
          const result = take(a, light(), {}, size);
          tickets.push(result.ticket);
          exactDimensions &&=
            result.ticket.width ===
              Math.ceil((result.geometry.width + 2 * size.paintOutset) * devicePixelRatio) &&
            result.ticket.height ===
              Math.ceil((result.geometry.height + 2 * size.paintOutset) * devicePixelRatio);
        }
        const actual = {
          sizes: tickets.length,
          exactDimensions,
          oldReadable: tickets.slice(0, -1).some((ticket) => ticket.readPixels() !== null),
          peakLive: a.owner.inspect().peakLive,
        };
        a.owner.dispose();
        return actual;
      });
      await lifetime('context-dpr-refusal-recovery', () => {
        const a = binding('dpr-binding'),
          frame = frameFor(a, light());
        render(frame);
        const epoch = producerEpoch;
        const identity = {
          sourceRevision: frame.source.revision,
          geometryRevision: a.geometryRevision,
          producerEpoch: epoch,
          logicalWidth: producer.width / 2,
          logicalHeight: producer.height / 2,
          paintOutset: 0,
          dpr: 2,
        };
        const wrong = a.owner.capture(producer, identity, {
          ownerCurrent: () => true,
          producerCurrent: () => producerEpoch === epoch,
        });
        const wrongAllocations = a.owner.inspect().created;
        const correct = take(a, light());
        const actual = {
          actualDpr: devicePixelRatio,
          wrongRefused: wrong === null,
          correctAccepted: !!correct.ticket,
          wrongAllocations,
        };
        a.owner.dispose();
        return actual;
      });
      await lifetime('stale-owner-before-copy', () => {
        const a = binding('stale-owner');
        a.live = false;
        const result = render(frameFor(a, light()), a);
        const actual = { refused: result.ticket === null, allocations: a.owner.inspect().created };
        a.owner.dispose();
        return actual;
      });
      await lifetime('invalidate-retire', () => {
        const a = binding('invalidate'),
          result = take(a, light());
        a.owner.invalidate();
        const actual = {
          readable: result.ticket.readPixels() !== null,
          live: a.owner.inspect().live,
        };
        a.owner.dispose();
        return actual;
      });
      await lifetime('dispose-no-successor', () => {
        const a = binding('terminal-dispose'),
          result = take(a, light());
        a.owner.dispose();
        const successor = render(frameFor(a, light()), a);
        return {
          readable: result.ticket.readPixels() !== null,
          successorRefused: successor.ticket === null,
          live: a.owner.inspect().live,
        };
      });
      await lifetime('detach', () => {
        const a = binding('detach'),
          result = take(a, light());
        a.target.remove();
        const detachedReadable = result.ticket.readPixels() !== null;
        document.body.append(a.target);
        const actual = {
          detachedReadable,
          reattachedReadable: result.ticket.readPixels() !== null,
          live: a.owner.inspect().live,
        };
        a.owner.dispose();
        return actual;
      });
      await lifetime('adopt', () => {
        const a = binding('adopt'),
          result = take(a, light()),
          other = document.implementation.createHTMLDocument('owned adoption control');
        other.adoptNode(a.target);
        other.body.append(a.target);
        const actual = {
          differentDocument: a.target.ownerDocument !== document,
          readable: result.ticket.readPixels() !== null,
          live: a.owner.inspect().live,
        };
        a.target.remove();
        a.owner.dispose();
        return actual;
      });
      await lifetime('same-revision-producer-reentry', () => {
        const a = binding('producer-reentry-a'),
          b = binding('producer-reentry-b');
        const frameA = frameFor(a, light()),
          frameB = frameFor(b, dark(), { theme: 'dark' });
        const copy = a.port.copy;
        let epochBefore, epochAfter;
        a.port.copy = (storage, source) => {
          epochBefore = producerEpoch;
          const nested = render(frameB);
          requireFact(!nested.renderError, nested.renderError);
          epochAfter = producerEpoch;
          copy(storage, source);
        };
        const result = render(frameA, a);
        const actual = {
          refused: result.ticket === null,
          sameSourceRevision: frameA.source.revision === frameB.source.revision,
          epochAdvanced: epochAfter > epochBefore,
          live: a.owner.inspect().live,
        };
        a.owner.dispose();
        b.owner.dispose();
        return actual;
      });
      await lifetime('failed-render-epoch', () => {
        const a = binding('failed-attempt'),
          frame = frameFor(a, light());
        const invalidPixels = frame.source.pixels.slice();
        invalidPixels[3] = 0;
        const invalid = { ...frame, source: { ...frame.source, pixels: invalidPixels } },
          copy = a.port.copy;
        let failedAttempt = false,
          epochBefore,
          epochAfter;
        a.port.copy = (storage, source) => {
          epochBefore = producerEpoch;
          failedAttempt = render(invalid).renderError === 'nonopaque-optical-source';
          epochAfter = producerEpoch;
          copy(storage, source);
        };
        const result = render(frame, a);
        const actual = {
          refused: result.ticket === null,
          failedAttempt,
          epochAdvanced: epochAfter > epochBefore,
          live: a.owner.inspect().live,
        };
        a.owner.dispose();
        return actual;
      });
      await lifetime('returned-buffer-isolation', (row) => {
        const a = binding('returned-a'),
          b = binding('returned-b'),
          first = take(a, light()),
          second = take(b, dark(), { theme: 'dark' });
        const beforeA = first.ticket.readPixels(),
          beforeB = second.ticket.readPixels();
        const escaped = first.ticket.readPixels();
        escaped.fill(37);
        const afterA = first.ticket.readPixels(),
          afterB = second.ticket.readPixels();
        row.planes = {
          aOriginal: plane(beforeA, first.width, first.height),
          aAfter: plane(afterA, first.width, first.height),
          bOriginal: plane(beforeB, second.width, second.height),
          bAfter: plane(afterB, second.width, second.height),
        };
        const actual = {
          retainedUnchanged: equal(afterA, beforeA),
          otherConsumerUnchanged: equal(afterB, beforeB),
        };
        a.owner.dispose();
        b.owner.dispose();
        return actual;
      });
      await lifetime('cancel-reference-decode', async () => {
        requireFact(lightReference?.png, 'cancellation-reference-unavailable');
        const before = inspectOpticalImageResources(document);
        let readyCallbacks = 0,
          failureCallbacks = 0;
        const release = prepareOpticalImage(
          document,
          lightReference.png,
          () => readyCallbacks++,
          () => failureCallbacks++
        );
        release();
        await nextFrame();
        await nextFrame();
        const after = inspectOpticalImageResources(document),
          change = delta(after, before);
        return {
          readyCallbacks,
          failureCallbacks,
          cancellations: change.imageDecodeCancellations,
          pending: after.pendingImages,
          decoded: after.decodedImages,
        };
      });
      await lifetime('allocation-dispose', () => {
        const a = binding('allocation-dispose'),
          create = a.port.create;
        a.port.create = (...args) => {
          const resource = create(...args);
          a.owner.dispose();
          return resource;
        };
        const result = render(frameFor(a, light()), a),
          counters = a.owner.inspect();
        return {
          refused: result.ticket === null,
          created: counters.created,
          retired: counters.retired,
          live: counters.live,
          physicalRetired: a.lastStorage.canvas.width === 0 && a.lastStorage.canvas.height === 0,
        };
      });
      await lifetime('same-owner-capture-reentry', () => {
        const a = binding('same-owner-reentry'),
          create = a.port.create;
        let inner = 'not-attempted';
        a.port.create = (...args) => {
          inner = a.owner.capture(
            producer,
            {
              sourceRevision: a.frame.source.revision,
              geometryRevision: a.geometryRevision,
              producerEpoch,
              logicalWidth: a.frame.geometry.width,
              logicalHeight: a.frame.geometry.height,
              paintOutset: a.frame.geometry.paintOutset,
              dpr: devicePixelRatio,
            },
            { ownerCurrent: () => true, producerCurrent: () => true }
          );
          return create(...args);
        };
        const result = render(frameFor(a, light()), a),
          counters = a.owner.inspect();
        const actual = {
          refused: result.ticket === null,
          innerRefused: inner === null,
          peakLive: counters.peakLive,
          live: counters.live,
        };
        a.owner.dispose();
        return actual;
      });
      for (const [id, invalidFrame] of [
        [
          'invalid-source-no-copy',
          (frame) => {
            const pixels = frame.source.pixels.slice();
            pixels[3] = 0;
            return { ...frame, source: { ...frame.source, pixels } };
          },
        ],
        ['unsafe-contrast-no-copy', (frame) => ({ ...frame, foreground: [0.5, 0.5, 0.5, 1] })],
      ])
        await lifetime(id, () => {
          const a = binding(id),
            frame = invalidFrame(frameFor(a, light())),
            result = render(frame, a);
          const actual = {
            rejected: !!result.renderError,
            encoderCalls: result.encoderCalls,
            copyCalls: result.copyCalls,
            error: result.renderError ?? null,
          };
          a.owner.dispose();
          return actual;
        });
      await lifetime('source-document-refusal', () => {
        const a = binding('foreign-producer'),
          frame = frameFor(a, light());
        render(frame);
        const other = document.implementation.createHTMLDocument('foreign producer');
        const canvas = other.createElement('canvas');
        canvas.width = producer.width;
        canvas.height = producer.height;
        let ticket = null,
          fault = null;
        try {
          ticket = a.owner.capture(
            canvas,
            {
              sourceRevision: 1,
              geometryRevision: 1,
              producerEpoch,
              logicalWidth: frame.geometry.width,
              logicalHeight: frame.geometry.height,
              paintOutset: frame.geometry.paintOutset,
              dpr: devicePixelRatio,
            },
            { ownerCurrent: () => true, producerCurrent: () => true }
          );
        } catch (caught) {
          fault = message(caught);
        }
        const actual = {
          refused: ticket === null,
          allocations: a.owner.inspect().created,
          error: fault,
        };
        canvas.width = 0;
        canvas.height = 0;
        a.owner.dispose();
        return actual;
      });
      for (const row of report.controls) {
        row.status = 'failed';
        try {
          requireFact(lightReference && darkReference, 'native-control-reference-unavailable');
          const { reference, width, height } = lightReference;
          const changed = reference.slice();
          let dimensions = { width, height };
          if (row.id === 'one-rgb-byte') {
            let at = 0;
            while (changed[at + 3] !== 255 && at + 4 < changed.length) at += 4;
            changed[at] = changed[at] === 255 ? 254 : changed[at] + 1;
          } else if (row.id === 'one-alpha-byte') {
            let at = 3;
            while (!(changed[at] > 0 && changed[at] < 255) && at + 4 < changed.length) at += 4;
            changed[at] = changed[at] === 255 ? 254 : changed[at] + 1;
          } else if (row.id === 'wrong-source') changed.set(darkReference.reference);
          else if (row.id === 'wrong-dimensions') dimensions = { width: height, height: width };
          else if (row.id === 'opaque-substitute')
            for (let at = 3; at < changed.length; at += 4) changed[at] = 255;
          if (row.id === 'borrowed-producer') {
            requireFact(borrowedControl, 'borrowed-producer-control-unavailable');
            row.planes = borrowedControl;
          } else
            row.planes = {
              candidate: plane(changed, dimensions.width, dimensions.height),
              reference: plane(reference, width, height),
            };
          row.status = 'ok';
        } catch (fault) {
          row.error = message(fault);
        }
      }
      await lifetime('producer-context-loss-rejection', async () => {
        const a = binding('lost-producer'),
          result = take(a, light()),
          extension = gl.getExtension('WEBGL_lose_context');
        requireFact(extension, 'native-context-loss-extension-unavailable');
        const lost = new Promise((resolve) =>
          producer.addEventListener('webglcontextlost', resolve, { once: true })
        );
        extension.loseContext();
        await deadline(lost, 'native-context-loss');
        a.live = false;
        const next = render(a.frame, a);
        const actual = {
          contextLost: gl.isContextLost(),
          rejected: !!next.renderError,
          encoderCalls: next.encoderCalls,
          copyCalls: next.copyCalls,
          readable: result.ticket.readPixels() !== null,
        };
        a.owner.dispose();
        return actual;
      });
    }
  } catch (fault) {
    error('collection', fault);
  } finally {
    report.programBeforeDispose = program?.inspect() ?? null;
    report.sourceDraws = sourceDraws;
    for (const release of releases) {
      try {
        release();
      } catch (fault) {
        error('production-image-retire', fault);
      }
    }
    releases.clear();
    for (const state of bindings) {
      try {
        state.owner.dispose();
      } catch (fault) {
        error('snapshot-owner-retire', fault);
      }
      state.target.remove();
    }
    for (const image of oracleImages) {
      try {
        image.src = '';
      } catch (fault) {
        error('oracle-image-retire', fault);
      }
    }
    oracleImages.clear();
    for (const canvas of [...oracleCanvases]) {
      try {
        retireOracle(canvas);
      } catch (fault) {
        error('oracle-canvas-retire', fault);
      }
    }
    try {
      program?.dispose();
    } catch (fault) {
      error('program-retire', fault);
    }
    producer.width = 0;
    producer.height = 0;
    for (const state of sourceStates) {
      state.canvas.width = 0;
      state.canvas.height = 0;
      state.scope.remove();
    }
    const cleanup = () => {
      const ownerCounters = bindings.map((state) => state.owner.inspect()),
        images = inspectOpticalImageResources(document),
        resources = Object.values(glResources),
        metrics = program?.inspect();
      return {
        ownersLive: ownerCounters.reduce((sum, row) => sum + row.live, 0),
        ownersBytes: ownerCounters.reduce((sum, row) => sum + row.bytes, 0),
        ownerCleanupFailures: ownerCounters.reduce((sum, row) => sum + row.cleanupFailures, 0),
        ownedPhysicalCanvases: ownedCanvases.size,
        oracleCanvases: oracleCanvases.size,
        oracleImages: oracleImages.size,
        sourceCanvases: sourceStates.filter(
          (state) => state.canvas.width !== 0 || state.canvas.height !== 0
        ).length,
        pendingImages: images.pendingImages,
        decodedImages: images.decodedImages,
        imageCounters: images,
        producerWidth: producer.width,
        producerHeight: producer.height,
        glLive: resources.reduce((sum, row) => sum + row.live, 0),
        glDoubleDeletes: resources.reduce((sum, row) => sum + row.doubleDeletes, 0),
        glResources,
        preparedEntries: metrics?.sourcePreparationCacheEntries ?? 0,
        preparedBytes: metrics?.sourcePreparationCacheBytes ?? 0,
        encoderRestored:
          producer.toDataURL === originalEncoder &&
          Object.getOwnPropertyDescriptor(producer, 'toDataURL') === originalDescriptor,
        ownerCounters,
      };
    };
    report.cleanup.immediate = cleanup();
    try {
      report.cleanup.rafTimestamps = [
        await deadline(nextFrame(), 'cleanup-first-raf'),
        await deadline(nextFrame(), 'cleanup-second-raf'),
      ];
    } catch (fault) {
      error('cleanup-frames', fault);
    }
    report.cleanup.afterTwoRaf = cleanup();
    for (const restore of restoreGlObservers) restore();
  }
  return report;
}
