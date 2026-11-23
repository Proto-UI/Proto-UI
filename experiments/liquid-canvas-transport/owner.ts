/** Experiment-only ownership. No production package or carrier imports this. */
export type SnapshotIdentity = Readonly<{
  sourceRevision: number;
  geometryRevision: number;
  producerEpoch: number;
  logicalWidth: number;
  logicalHeight: number;
  paintOutset: number;
  dpr: number;
}>;

export type SnapshotPort<Source, Storage> = {
  devicePixelRatio(document: Document): number;
  dimensions(source: Source): { width: number; height: number };
  create(width: number, height: number): Storage;
  copy(storage: Storage, source: Source): void;
  read(storage: Storage, width: number, height: number): Uint8ClampedArray;
  retire(storage: Storage): void;
};
type Target = Pick<HTMLElement, 'ownerDocument' | 'isConnected'>;
type Guards = { ownerCurrent(): boolean; producerCurrent(): boolean };
type Resource<Storage> = {
  storage: Storage;
  retire(storage: Storage): void;
  bytes: number;
};
type Entry<Storage> = {
  identity: SnapshotIdentity;
  width: number;
  height: number;
  ownerCurrent: (() => boolean) | null;
  resource: Resource<Storage> | null;
  retired: boolean;
  access: {
    current(entry: Entry<Storage>): boolean;
    read(entry: Entry<Storage>): Uint8ClampedArray | null;
    release(entry: Entry<Storage>): void;
  } | null;
};

export type SnapshotTicket = Readonly<{
  identity: SnapshotIdentity;
  width: number;
  height: number;
  current(): boolean;
  readPixels(): Uint8ClampedArray | null;
  release(): void;
}>;
// A retired ticket retains scalars only: no port, target, frame or resource.
function ticketFor<Storage>(entry: Entry<Storage>): SnapshotTicket {
  return Object.freeze({
    identity: entry.identity,
    width: entry.width,
    height: entry.height,
    current: () => entry.access?.current(entry) ?? false,
    readPixels: () => entry.access?.read(entry) ?? null,
    release: () => entry.access?.release(entry),
  });
}

function facts(identity: SnapshotIdentity) {
  const {
    sourceRevision,
    geometryRevision,
    producerEpoch,
    logicalWidth,
    logicalHeight,
    paintOutset,
    dpr,
  } = identity;
  // TypeScript structural callers may carry an extra frame/resource. Retained
  // identity deliberately copies only the declared scalar facts.
  const copy = Object.freeze({
    sourceRevision,
    geometryRevision,
    producerEpoch,
    logicalWidth,
    logicalHeight,
    paintOutset,
    dpr,
  });
  if (
    ![sourceRevision, geometryRevision, producerEpoch].every(
      (n) => Number.isSafeInteger(n) && n >= 0
    ) ||
    ![logicalWidth, logicalHeight, paintOutset, dpr].every(Number.isFinite) ||
    logicalWidth <= 0 ||
    logicalHeight <= 0 ||
    paintOutset < 0 ||
    paintOutset > 165 ||
    dpr < 0.5 ||
    dpr > 3
  )
    throw new Error('snapshot-identity-unavailable');
  const width = Math.ceil((logicalWidth + 2 * paintOutset) * dpr);
  const height = Math.ceil((logicalHeight + 2 * paintOutset) * dpr);
  if (width > 2048 || height > 2048 || width * height > 1048576)
    throw new Error('snapshot-output-budget');
  return { identity: copy, width, height };
}

export function createCanvasSnapshotOwner<Source, Storage>(
  target: Target,
  port: SnapshotPort<Source, Storage>
) {
  let host: Target | null = target;
  let document: Document | null = target.ownerDocument;
  let transport: SnapshotPort<Source, Storage> | null = port;
  let disposed = false,
    capturing = false,
    operation = 0;
  let current: Entry<Storage> | null = null;
  const owned = new Set<Entry<Storage>>();
  const counters = {
    created: 0,
    retired: 0,
    live: 0,
    bytes: 0,
    peakLive: 0,
    peakBytes: 0,
    captures: 0,
    refusals: 0,
    readbacks: 0,
    cleanupFailures: 0,
  };
  const logical = (entry: Entry<Storage>) => !disposed && !entry.retired && owned.has(entry);
  function detach(entries: Iterable<Entry<Storage>>) {
    const resources: Resource<Storage>[] = [];
    for (const entry of entries) {
      if (entry.retired) continue;
      entry.retired = true;
      owned.delete(entry);
      if (current === entry) current = null;
      entry.ownerCurrent = null;
      entry.access = null;
      if (entry.resource) {
        resources.push(entry.resource);
        counters.retired++;
        counters.live--;
        counters.bytes -= entry.resource.bytes;
        entry.resource = null;
      }
    }
    return resources;
  }
  function clean(resources: Resource<Storage>[]) {
    let failed = false,
      first: unknown;
    for (const resource of resources) {
      try {
        resource.retire(resource.storage);
      } catch (error) {
        counters.cleanupFailures++;
        if (!failed) {
          failed = true;
          first = error;
        }
      }
    }
    if (failed) throw first;
  }
  function release(entry: Entry<Storage>) {
    clean(detach([entry]));
  }
  function valid(entry: Entry<Storage>) {
    if (!logical(entry) || !host || !document || !transport) return false;
    const sameDocument = host.ownerDocument === document;
    if (!logical(entry) || !sameDocument) return false;
    const connected = host.isConnected;
    if (!logical(entry) || !connected) return false;
    const dpr = transport.devicePixelRatio(document);
    if (!logical(entry) || dpr !== entry.identity.dpr) return false;
    const accepted = entry.ownerCurrent?.() === true;
    return logical(entry) && accepted;
  }
  function checkCurrent(entry: Entry<Storage>) {
    try {
      if (current === entry && valid(entry)) return true;
    } catch (error) {
      try {
        release(entry);
      } catch {}
      throw error;
    }
    release(entry);
    return false;
  }
  const access = {
    current: checkCurrent,
    read(entry: Entry<Storage>) {
      if (!checkCurrent(entry)) return null;
      const resource = entry.resource!;
      try {
        const read = transport!.read;
        if (!checkCurrent(entry)) return null;
        const pixels = read.call(transport, resource.storage, entry.width, entry.height);
        counters.readbacks++;
        if (!checkCurrent(entry)) return null;
        if (
          !(pixels instanceof Uint8ClampedArray) ||
          pixels.length !== entry.width * entry.height * 4
        )
          throw new Error('snapshot-readback-unavailable');
        // Even an injected port returning internal storage cannot expose it.
        const result = new Uint8ClampedArray(pixels);
        // Length/iteration can be user-defined on an injected typed array.
        // A final copy must not escape after those host-visible reads retire it.
        return checkCurrent(entry) ? result : null;
      } catch (error) {
        try {
          release(entry);
        } catch {}
        throw error;
      }
    },
    release,
  };
  return {
    capture(source: Source, identity: SnapshotIdentity, guards: Guards): SnapshotTicket | null {
      const turn = ++operation;
      if (disposed || capturing) {
        counters.refusals++;
        return null;
      }
      const resolved = facts(identity);
      if (disposed || turn !== operation || !transport) {
        counters.refusals++;
        return null;
      }
      const selectedPort = transport;
      const entry: Entry<Storage> = {
        ...resolved,
        ownerCurrent: guards.ownerCurrent,
        resource: null,
        retired: false,
        access,
      };
      owned.add(entry);
      capturing = true;
      const isCaptureCurrent = () => {
        if (turn !== operation || !valid(entry)) return false;
        const accepted = guards.producerCurrent() === true;
        return turn === operation && logical(entry) && accepted;
      };
      let committed = false,
        primaryFailure = false;
      try {
        if (!isCaptureCurrent()) return null;
        const dimensions = selectedPort.dimensions(source);
        if (
          !isCaptureCurrent() ||
          dimensions.width !== entry.width ||
          dimensions.height !== entry.height
        )
          return null;
        const create = selectedPort.create;
        if (!isCaptureCurrent()) return null;
        const retire = selectedPort.retire;
        if (!isCaptureCurrent()) return null;
        const storage = create.call(selectedPort, entry.width, entry.height);
        const resource = {
          storage,
          retire: (value: Storage) => retire.call(selectedPort, value),
          bytes: entry.width * entry.height * 4,
        };
        counters.created++;
        counters.live++;
        counters.bytes += resource.bytes;
        counters.peakLive = Math.max(counters.peakLive, counters.live);
        counters.peakBytes = Math.max(counters.peakBytes, counters.bytes);
        // A native constructor may reenter invalidate/dispose before returning.
        // The returned resource is still retired, even if its entry was detached.
        if (entry.retired) {
          counters.retired++;
          counters.live--;
          counters.bytes -= resource.bytes;
          clean([resource]);
          return null;
        }
        entry.resource = resource;
        if (!isCaptureCurrent()) return null;
        const copy = selectedPort.copy;
        if (!isCaptureCurrent()) return null;
        copy.call(selectedPort, storage, source);
        if (!isCaptureCurrent()) return null;
        const after = selectedPort.dimensions(source);
        if (!isCaptureCurrent() || after.width !== entry.width || after.height !== entry.height)
          return null;
        const previous = current;
        current = entry;
        committed = true;
        counters.captures++;
        const retired = previous ? detach([previous]) : [];
        // Host cleanup may create a successor; detach before permitting it.
        capturing = false;
        try {
          clean(retired);
        } catch (error) {
          try {
            release(entry);
          } catch {}
          throw error;
        }
        if (!checkCurrent(entry)) return null;
        return ticketFor(entry);
      } catch (error) {
        primaryFailure = true;
        throw error;
      } finally {
        capturing = false;
        if (!committed) {
          counters.refusals++;
          try {
            release(entry);
          } catch (error) {
            if (!primaryFailure) throw error;
          }
        }
      }
    },
    invalidate() {
      operation++;
      clean(detach([...owned]));
    },
    dispose() {
      operation++;
      disposed = true;
      const retired = detach([...owned]);
      host = null;
      document = null;
      transport = null;
      clean(retired);
    },
    inspect: () => ({ ...counters, disposed, capturing }),
  };
}

export function createNativeCanvasPort(document: Document): SnapshotPort<
  HTMLCanvasElement,
  {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
  }
> {
  return {
    devicePixelRatio: (owner) => owner.defaultView?.devicePixelRatio ?? NaN,
    dimensions(source) {
      if (source.ownerDocument !== document) throw new Error('snapshot-producer-document-mismatch');
      return { width: source.width, height: source.height };
    },
    create(width, height) {
      const canvas = document.createElement('canvas');
      try {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', {
          alpha: true,
          colorSpace: 'srgb',
          willReadFrequently: true,
        });
        const attributes = context?.getContextAttributes();
        if (!context || attributes?.alpha !== true || attributes.colorSpace !== 'srgb')
          throw new Error('snapshot-srgb-alpha-context-unavailable');
        return { canvas, context };
      } catch (error) {
        try {
          canvas.width = 0;
        } catch {}
        try {
          canvas.height = 0;
        } catch {}
        throw error;
      }
    },
    copy({ canvas, context }, source) {
      if (context.isContextLost()) throw new Error('snapshot-context-lost');
      context.globalCompositeOperation = 'copy';
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 0, 0);
      if (
        context.isContextLost() ||
        canvas.width !== source.width ||
        canvas.height !== source.height
      )
        throw new Error('snapshot-copy-unavailable');
    },
    read({ canvas, context }, width, height) {
      if (context.isContextLost() || canvas.width !== width || canvas.height !== height)
        throw new Error('snapshot-readback-unavailable');
      return context.getImageData(0, 0, width, height).data;
    },
    retire({ canvas }) {
      let failed = false,
        first: unknown;
      try {
        canvas.width = 0;
      } catch (error) {
        failed = true;
        first = error;
      }
      try {
        canvas.height = 0;
      } catch (error) {
        if (!failed) {
          failed = true;
          first = error;
        }
      }
      if (failed) throw first;
    },
  };
}
