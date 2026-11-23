import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvasSnapshotOwner, createNativeCanvasPort } from './owner.ts';

// A controlled byte store tests ownership only. Native fidelity uses real Canvas2D.
function fixture() {
  const document = { dpr: 1 };
  const target = { ownerDocument: document, isConnected: true };
  const resources = [];
  const source = {
    width: 2,
    height: 1,
    pixels: new Uint8ClampedArray([2, 3, 4, 255, 9, 8, 7, 128]),
  };
  let producerEpoch = 1,
    producerFrame = {};
  const identity = {
    sourceRevision: 1,
    geometryRevision: 1,
    producerEpoch: 1,
    logicalWidth: 2,
    logicalHeight: 1,
    paintOutset: 0,
    dpr: 1,
  };
  const port = {
    devicePixelRatio: (doc) => doc.dpr,
    dimensions: (input) => ({ width: input.width, height: input.height }),
    create(width, height) {
      const resource = { width, height, pixels: new Uint8ClampedArray(width * height * 4) };
      resources.push(resource);
      return resource;
    },
    copy(resource, input) {
      resource.pixels.set(input.pixels);
    },
    read: (resource) => resource.pixels,
    retire(resource) {
      resource.width = 0;
      resource.height = 0;
      resource.pixels = new Uint8ClampedArray();
    },
  };
  const owner = createCanvasSnapshotOwner(target, port);
  const guards = () => {
    const epoch = producerEpoch,
      frame = producerFrame;
    return {
      ownerCurrent: () => true,
      producerCurrent: () => producerEpoch === epoch && producerFrame === frame,
    };
  };
  return {
    document,
    target,
    resources,
    source,
    identity,
    port,
    owner,
    guards,
    attempt() {
      producerEpoch++;
      producerFrame = {};
    },
    capture: (facts = identity, current = guards()) => owner.capture(source, facts, current),
  };
}

test('completed copies survive shared producer reuse without exposing mutable bytes', () => {
  const f = fixture();
  const original = f.source.pixels.slice();
  const ticket = f.capture();
  f.attempt();
  f.source.pixels.fill(17);
  assert.equal(ticket.current(), true);
  const returned = ticket.readPixels();
  assert.deepEqual(returned, original);
  returned.fill(99);
  assert.deepEqual(ticket.readPixels(), original);
  f.owner.dispose();
  assert.equal(ticket.readPixels(), null);
  assert.equal(ticket.current(), false);
  assert.equal(f.owner.inspect().live, 0);
});

test('source/geometry identity is copied and old tickets cannot read replacement output', () => {
  const f = fixture();
  const a = f.capture();
  f.identity.sourceRevision = 50;
  assert.equal(a.identity.sourceRevision, 1);
  f.source.pixels.fill(51);
  const b = f.capture();
  assert.equal(a.current(), false);
  assert.equal(a.readPixels(), null);
  assert.deepEqual(b.readPixels(), f.source.pixels);
  assert.equal(f.owner.inspect().peakLive, 2);
  f.owner.dispose();
  assert.equal(f.owner.inspect().created, f.owner.inspect().retired);
});

test('structural identity extras cannot retain a frame or target after retirement', () => {
  const f = fixture(),
    frame = { target: f.target, pixels: f.source.pixels };
  const ticket = f.capture({ ...f.identity, frame });
  f.owner.dispose();
  assert.equal(Object.hasOwn(ticket.identity, 'frame'), false);
  assert.deepEqual(Object.keys(ticket.identity).sort(), Object.keys(f.identity).sort());
  assert.ok(Object.values(ticket.identity).every((value) => typeof value === 'number'));
  assert.equal(ticket.current(), false);
});

test('actual context DPR and independently derived physical dimensions are mandatory', () => {
  const f = fixture();
  assert.equal(f.capture({ ...f.identity, dpr: 2 }), null);
  f.source.width = 3;
  assert.equal(f.capture(), null);
  assert.equal(f.resources.length, 0);
  f.document.dpr = 1.5;
  f.source.width = 6;
  f.source.height = 5;
  f.source.pixels = new Uint8ClampedArray(6 * 5 * 4);
  const ticket = f.capture({
    ...f.identity,
    logicalWidth: 3,
    logicalHeight: 2,
    paintOutset: 0.5,
    dpr: 1.5,
  });
  assert.equal(ticket.width, 6);
  assert.equal(ticket.height, 5);
  f.document.dpr = 2;
  assert.equal(ticket.readPixels(), null);
  assert.equal(f.owner.inspect().live, 0);
});

for (const mode of ['same-revision-new-frame', 'failed-render-attempt']) {
  test(`producer ${mode} during copy rejects the unfinished capture`, () => {
    const f = fixture(),
      copy = f.port.copy;
    f.port.copy = (resource, source) => {
      f.attempt();
      if (mode === 'same-revision-new-frame') source.pixels.fill(41);
      copy(resource, source);
    };
    assert.equal(f.capture(), null);
    assert.equal(f.owner.inspect().captures, 0);
    assert.equal(f.owner.inspect().live, 0);
    assert.equal(f.resources[0].width, 0);
  });
}

test('owner/source invalidation around copy cannot publish a new ticket', () => {
  const f = fixture();
  let allowed = true;
  const copy = f.port.copy;
  f.port.copy = (...args) => {
    copy(...args);
    allowed = false;
  };
  assert.equal(f.capture(f.identity, { ...f.guards(), ownerCurrent: () => allowed }), null);
  assert.equal(f.owner.inspect().live, 0);
});

for (const transition of ['detach', 'adopt']) {
  test(`${transition} revokes reads and retires the exact owned copy`, () => {
    const f = fixture(),
      ticket = f.capture();
    if (transition === 'detach') f.target.isConnected = false;
    else f.target.ownerDocument = { dpr: 1 };
    assert.equal(ticket.current(), false);
    assert.equal(f.owner.inspect().live, 0);
    assert.equal(f.capture(), null);
    f.owner.dispose();
  });
}

test('invalidation detaches its cohort before cleanup reentry creates a successor', () => {
  let successor,
    entered = false;
  const g = fixture();
  const realRetire = g.port.retire;
  g.port.retire = (resource) => {
    realRetire(resource);
    if (!entered) {
      entered = true;
      successor = g.capture();
    }
  };
  const old = g.capture();
  g.owner.invalidate();
  assert.equal(old.current(), false);
  assert.equal(successor.current(), true);
  assert.equal(g.owner.inspect().live, 1);
  g.owner.dispose();
  assert.equal(g.owner.inspect().live, 0);
});

test('terminal disposal refuses requests made by cleanup', () => {
  const f = fixture(),
    retire = f.port.retire;
  let successor = 'not-attempted';
  f.port.retire = (resource) => {
    retire(resource);
    successor = f.capture();
  };
  const ticket = f.capture();
  f.owner.dispose();
  assert.equal(successor, null);
  assert.equal(ticket.current(), false);
  assert.equal(f.owner.inspect().live, 0);
});

test('copy failure retains its first error even when owned cleanup fails', () => {
  const f = fixture(),
    copyFault = new Error('copy-fault');
  f.port.copy = () => {
    throw copyFault;
  };
  f.port.retire = () => {
    throw new Error('cleanup-fault');
  };
  assert.throws(
    () => f.capture(),
    (error) => error === copyFault
  );
  assert.equal(f.owner.inspect().live, 0);
  assert.equal(f.owner.inspect().cleanupFailures, 1);
});

test('replacement cleanup failure retires the unreturned successor as well', () => {
  const f = fixture(),
    retire = f.port.retire;
  let calls = 0;
  f.port.retire = (resource) => {
    retire(resource);
    if (++calls === 1) throw new Error('old-cleanup');
  };
  const old = f.capture();
  assert.throws(() => f.capture(), /old-cleanup/);
  assert.equal(old.current(), false);
  assert.equal(f.owner.inspect().live, 0);
  assert.equal(f.owner.inspect().created, 2);
  assert.equal(f.owner.inspect().retired, 2);
});

test('same-owner allocation reentry is refused and invalidates the outer attempt', () => {
  const f = fixture(),
    create = f.port.create;
  let nested;
  f.port.create = (...args) => {
    nested = f.capture();
    return create(...args);
  };
  assert.equal(f.capture(), null);
  assert.equal(nested, null);
  assert.equal(f.owner.inspect().peakLive, 1);
  assert.equal(f.owner.inspect().live, 0);
});

test('a storage object returned after synchronous disposal is still retired once', () => {
  const f = fixture(),
    create = f.port.create;
  f.port.create = (...args) => {
    f.owner.dispose();
    return create(...args);
  };
  assert.equal(f.capture(), null);
  assert.equal(f.owner.inspect().created, 1);
  assert.equal(f.owner.inspect().retired, 1);
  assert.equal(f.resources[0].width, 0);
});

test('cleanup capability is captured before resource construction', () => {
  const f = fixture();
  Object.defineProperty(f.port, 'retire', {
    get() {
      throw new Error('retire-getter');
    },
  });
  assert.throws(() => f.capture(), /retire-getter/);
  assert.equal(f.resources.length, 0);
  assert.equal(f.owner.inspect().live, 0);
});

test('read capability reentry cannot use the disposed resource', () => {
  const f = fixture(),
    ticket = f.capture();
  let reads = 0;
  Object.defineProperty(f.port, 'read', {
    get() {
      f.owner.dispose();
      return () => {
        reads++;
        return new Uint8ClampedArray(8);
      };
    },
  });
  assert.equal(ticket.readPixels(), null);
  assert.equal(reads, 0);
  assert.equal(f.owner.inspect().live, 0);
});

test('bad readback cannot silently return missing pixels or retain current ownership', () => {
  const f = fixture(),
    ticket = f.capture();
  f.port.read = () => new Uint8ClampedArray(4);
  assert.throws(() => ticket.readPixels(), /snapshot-readback-unavailable/);
  assert.equal(f.owner.inspect().live, 0);
});

test('malformed and over-budget identities allocate no canvas', () => {
  const f = fixture();
  for (const change of [
    { dpr: NaN },
    { logicalWidth: 0 },
    { producerEpoch: -1 },
    { logicalWidth: 2048, logicalHeight: 2048 },
  ])
    assert.throws(() => f.capture({ ...f.identity, ...change }), /snapshot-/);
  assert.equal(f.resources.length, 0);
});

test('a length getter that disposes the owner cannot publish copied pixels', () => {
  const f = fixture(),
    ticket = f.capture();
  f.port.read = (resource) => {
    const pixels = resource.pixels.slice();
    Object.defineProperty(pixels, 'length', {
      get() {
        f.owner.dispose();
        return 8;
      },
    });
    return pixels;
  };
  assert.equal(ticket.readPixels(), null);
  assert.equal(ticket.current(), false);
  assert.equal(f.owner.inspect().live, 0);
});

for (const boundary of ['width', 'height', 'context']) {
  test(`native construction rolls back both dimensions after a ${boundary} fault`, () => {
    const first = new Error(`${boundary}-construction-fault`),
      writes = [];
    let width = 300,
      height = 150,
      faulted = false;
    const canvas = {
      get width() {
        return width;
      },
      set width(value) {
        writes.push(['width', value]);
        if (boundary === 'width' && !faulted) {
          faulted = true;
          throw first;
        }
        width = value;
      },
      get height() {
        return height;
      },
      set height(value) {
        writes.push(['height', value]);
        if (boundary === 'height' && !faulted) {
          faulted = true;
          throw first;
        }
        height = value;
      },
      getContext() {
        throw first;
      },
    };
    const port = createNativeCanvasPort({ createElement: () => canvas });
    assert.throws(
      () => port.create(2, 1),
      (error) => error === first
    );
    assert.deepEqual(writes.slice(-2), [
      ['width', 0],
      ['height', 0],
    ]);
    assert.equal(width, 0);
    assert.equal(height, 0);
  });
}

test('construction rollback attempts the second dimension even if the first cleanup throws', () => {
  const original = new Error('height-construction-fault'),
    writes = [];
  const canvas = {
    set width(value) {
      writes.push(['width', value]);
      if (value === 0) throw new Error('cleanup-width-fault');
    },
    set height(value) {
      writes.push(['height', value]);
      if (value !== 0) throw original;
    },
  };
  const port = createNativeCanvasPort({ createElement: () => canvas });
  assert.throws(
    () => port.create(2, 1),
    (error) => error === original
  );
  assert.deepEqual(writes.slice(-2), [
    ['width', 0],
    ['height', 0],
  ]);
});
