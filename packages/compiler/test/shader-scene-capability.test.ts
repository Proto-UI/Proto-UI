import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { tw, type ShaderPresentationDeclaration } from '@proto.ui/core';
import { createWebShaderPresentationSink } from '../../adapters/base/src/material/shader-webgl2';
import { createWebShaderPresenter } from '../../adapters/base/src/material/shader-webgl2-host';
import type {
  WebShaderHostOptions,
  WebShaderScenePresenter,
} from '../../adapters/base/src/material/shader-scene-host';
import { nativeShaderArtifacts } from '../src/native-shader';

// Execute the actual emitted owner with its real physical presenter. Only its
// ordinary import binding is supplied by this test; no lifecycle branch changes.
const ownerSource = nativeShaderArtifacts(['copy-rgba8-v1'], true).find((file) =>
  file.path.endsWith('owner-web-v1.ts')
)!.contents;
const compiled = ts
  .transpileModule(ownerSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  .outputText.replace(/^import .*;\n/gm, '')
  .replace('export function createNativeShader', 'function createNativeShader');
const createNativeShader = new Function(
  'createWebShaderPresenter',
  compiled + '\nreturn createNativeShader;'
)(createWebShaderPresenter);
const declaration: ShaderPresentationDeclaration = {
  version: 1,
  source: { kind: 'owned-scene', slot: 'scene' },
  passes: [{ id: 'copy', input: '$source', kernel: 'copy-rgba8-v1' }],
  output: 'copy',
  fallback: [0, 0, 0, 1],
};
const capability = () => ({
  commit: vi.fn(),
  release: vi.fn(),
  dispose: vi.fn(),
  diagnostics: () => [],
});
function owner(kind: 'runtime' | 'generated', host: WebShaderHostOptions) {
  const root = document.createElement('div');
  document.body.append(root);
  let view = 1,
    revision = 0;
  if (kind === 'runtime') {
    const sink = createWebShaderPresentationSink(
      () => root,
      { queueStyle() {}, requestFlush() {} },
      host
    );
    const refresh = () => sink.commit({ view, revision: ++revision, declaration, style: tw('') });
    return {
      root,
      start: refresh,
      refresh,
      detach: () => sink.release(view),
      dispose: () => sink.release(view),
      restart: () => {
        view++;
        revision = 0;
        refresh();
      },
    };
  }
  const native = createNativeShader({
    setup() {},
    alive: () => true,
    root: () => root,
    prepare() {},
    host,
  });
  native.declareScene('scene', 2, 'copy', [0, 0, 0, 1], () => {
    throw new Error('Custom host must not execute the pass in this lifecycle test');
  });
  return {
    root,
    start: () => native.mount(),
    refresh: () => native.refresh(),
    detach: () => native.detach(),
    dispose: () => native.dispose(),
    restart: () => native.mount(),
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
for (const kind of ['runtime', 'generated'] as const) {
  it.each(['release', 'dispose'] as const)(
    `${kind}: retires a scene capability acquired after synchronous %s`,
    (action) => {
      const returned = capability();
      let active: ReturnType<typeof owner>;
      active = owner(kind, {
        createScenePresenter() {
          if (action === 'release') active.detach();
          else active.dispose();
          return returned;
        },
      });
      active.start();
      expect(returned.commit).not.toHaveBeenCalled();
      expect(returned.dispose).toHaveBeenCalledOnce();
      active.dispose();
      expect(returned.dispose).toHaveBeenCalledOnce();
    }
  );
  it(`${kind}: a reentrant acquisition cannot overwrite or dispose its replacement`, () => {
    const old = capability(),
      current = capability();
    let first = true,
      active: ReturnType<typeof owner>;
    active = owner(kind, {
      createScenePresenter() {
        if (first) {
          first = false;
          active.refresh();
          return old;
        }
        return current;
      },
    });
    active.start();
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(old.commit).not.toHaveBeenCalled();
    expect(current.commit).toHaveBeenCalledOnce();
    expect(current.dispose).not.toHaveBeenCalled();
    active.dispose();
  });
  it(`${kind}: an acquisition getter that retires its owner is covered by the same generation`, () => {
    const returned = capability();
    let active: ReturnType<typeof owner>;
    active = owner(kind, {
      get createScenePresenter() {
        active.detach();
        return () => returned;
      },
    });
    active.start();
    expect(returned.commit).not.toHaveBeenCalled();
    expect(returned.dispose).toHaveBeenCalledOnce();
  });
  it(`${kind}: factory failure keeps opaque fallback without attempting GPU allocation`, () => {
    const gpu = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const active = owner(kind, {
      createScenePresenter() {
        throw new Error('factory failure');
      },
    });
    expect(() => active.start()).not.toThrow();
    expect(active.root.style.backgroundImage).toBe('none');
    expect(gpu).not.toHaveBeenCalled();
    active.dispose();
  });
  it(`${kind}: recovery from a failed scene factory retires its fallback paint before publication`, () => {
    let attempts = 0;
    let active: ReturnType<typeof owner>;
    active = owner(kind, {
      createScenePresenter(options) {
        if (++attempts === 1) throw new Error('temporary scene factory failure');
        const physical = createWebShaderPresenter(options);
        const recovered: WebShaderScenePresenter = {
          commit(frame, _program, prepare) {
            expect(active.root.style.backgroundImage).toBe(original);
            physical.commit(frame, null, prepare);
          },
          release: (view) => physical.release(view),
          dispose: () => physical.dispose(),
          diagnostics: () => physical.diagnostics(),
        };
        return recovered;
      },
    });
    active.root.style.backgroundImage = 'linear-gradient(red, blue)';
    const original = active.root.style.backgroundImage;
    try {
      active.start();
      expect(active.root.style.backgroundImage).toBe('none');
      active.refresh();
      expect(attempts).toBe(2);
      expect(active.root.style.backgroundImage).toBe('none');
    } finally {
      active.dispose();
    }
    expect(active.root.style.backgroundImage).toBe(original);
  });
  it(`${kind}: physical fallback cleanup reentry cannot overwrite the current scene paint`, () => {
    let attempts = 0;
    let active: ReturnType<typeof owner>;
    active = owner(kind, {
      createScenePresenter(options) {
        if (++attempts === 1) throw new Error('temporary scene factory failure');
        const physical = createWebShaderPresenter(options);
        const recovered: WebShaderScenePresenter = {
          commit(frame, _program, prepare) {
            physical.commit(frame, null, prepare);
          },
          release: (view) => physical.release(view),
          dispose: () => physical.dispose(),
          diagnostics: () => physical.diagnostics(),
        };
        return recovered;
      },
    });
    active.root.style.backgroundImage = 'linear-gradient(red, blue)';
    const original = active.root.style.backgroundImage;
    const style = active.root.style;
    const removeProperty = style.removeProperty.bind(style);
    let armed = false;
    let reentered = false;
    let currentPaint: string | undefined;
    const cleanup = vi.spyOn(style, 'removeProperty').mockImplementation((property) => {
      const value = removeProperty(property);
      if (armed && property === 'background-color') {
        armed = false;
        reentered = true;
        active.refresh();
      }
      return value;
    });
    try {
      active.start();
      expect(active.root.style.backgroundImage).toBe('none');
      armed = true;
      active.refresh();
      currentPaint = active.root.style.backgroundImage;
    } finally {
      armed = false;
      try {
        active.dispose();
      } finally {
        cleanup.mockRestore();
      }
    }
    expect({ reentered, currentPaint, restoredPaint: active.root.style.backgroundImage }).toEqual({
      reentered: true,
      currentPaint: 'none',
      restoredPaint: original,
    });
  });
  it(`${kind}: an unselected owner never calls the source capability factory`, () => {
    const createScenePresenter = vi.fn((): WebShaderScenePresenter => capability());
    const active = owner(kind, { createScenePresenter });
    active.dispose();
    expect(createScenePresenter).not.toHaveBeenCalled();
  });
}

const pixels: ShaderPresentationDeclaration = {
  ...declaration,
  source: {
    kind: 'owned-pixels',
    width: 1,
    height: 1,
    pixels: [0, 0, 0, 255],
    colorSpace: 'linear-srgb',
    alpha: 'premultiplied',
    origin: 'top-left',
  },
};
it.each([1, 2])(
  'runtime: a newer owned-pixels view %i retires a reentrant scene acquisition',
  (nextView) => {
    const returned = capability(),
      root = vi.fn(() => null),
      queueStyle = vi.fn();
    const sink = createWebShaderPresentationSink(
      root,
      { queueStyle, requestFlush() {} },
      {
        createScenePresenter() {
          sink.commit({ view: nextView, revision: 2, declaration: pixels, style: tw('') });
          return returned;
        },
      }
    );
    sink.commit({ view: 1, revision: 1, declaration, style: tw('') });
    expect(root).toHaveBeenCalledOnce();
    expect(queueStyle).toHaveBeenCalledOnce();
    expect(returned.commit).not.toHaveBeenCalled();
    expect(returned.dispose).toHaveBeenCalledOnce();
  }
);
it.each(['invalid', 'stale'] as const)(
  'runtime: a %s owned-pixels frame cannot retire an accepted scene acquisition',
  (kind) => {
    const returned = capability();
    const sink = createWebShaderPresentationSink(
      () => null,
      { queueStyle() {}, requestFlush() {} },
      {
        createScenePresenter() {
          const attempt = () =>
            sink.commit({
              view: kind === 'invalid' ? 2 : 0,
              revision: kind === 'invalid' ? Infinity : 1,
              declaration: pixels,
              style: tw(''),
            });
          if (kind === 'invalid') expect(attempt).toThrow('shader-invalid-frame');
          else attempt();
          return returned;
        },
      }
    );
    sink.commit({ view: 1, revision: 1, declaration, style: tw('') });
    expect(returned.commit).toHaveBeenCalledOnce();
    expect(returned.dispose).not.toHaveBeenCalled();
    if (kind === 'stale') expect(sink.diagnostics?.()).toContain('shader-stale-frame');
  }
);
it('runtime: changing a valid source kind retires its old publisher before the replacement prepares', () => {
  const root = document.createElement('div');
  root.style.backgroundImage = 'linear-gradient(red, blue)';
  document.body.append(root);
  const initial = root.style.backgroundImage;
  const first = capability(),
    second = capability();
  const createScenePresenter = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const sink = createWebShaderPresentationSink(
    () => root,
    { queueStyle() {}, requestFlush() {} },
    { createScenePresenter }
  );
  sink.commit({ view: 1, revision: 1, declaration: pixels, style: tw('') });
  expect(root.style.backgroundImage).toBe('none');
  first.commit.mockImplementation(() => expect(root.style.backgroundImage).toBe(initial));
  sink.commit({ view: 1, revision: 2, declaration, style: tw('') });
  expect(first.commit).toHaveBeenCalledOnce();
  sink.commit({ view: 1, revision: 3, declaration: pixels, style: tw('') });
  expect(first.dispose).toHaveBeenCalledOnce();
  expect(root.style.backgroundImage).toBe('none');
  second.commit.mockImplementation(() => expect(root.style.backgroundImage).toBe(initial));
  sink.commit({ view: 1, revision: 4, declaration, style: tw('') });
  expect(second.commit).toHaveBeenCalledOnce();
  expect(createScenePresenter).toHaveBeenCalledTimes(2);
  sink.release(1);
});
it('runtime: source-kind cleanup reentry cannot retire or prepare over the replacement', () => {
  const old = capability(),
    current = capability(),
    queueStyle = vi.fn();
  const createScenePresenter = vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(current);
  const sink = createWebShaderPresentationSink(
    () => null,
    { queueStyle, requestFlush() {} },
    { createScenePresenter }
  );
  sink.commit({ view: 1, revision: 1, declaration, style: tw('') });
  old.dispose.mockImplementation(() =>
    sink.commit({ view: 1, revision: 3, declaration, style: tw('') })
  );
  sink.commit({ view: 1, revision: 2, declaration: pixels, style: tw('') });
  expect(old.dispose).toHaveBeenCalledOnce();
  expect(current.commit).toHaveBeenCalledOnce();
  expect(current.dispose).not.toHaveBeenCalled();
  expect(queueStyle).not.toHaveBeenCalled();
});
it('runtime: a failing old scene cleanup still leaves the new pixel publisher available', () => {
  const old = capability(),
    queueStyle = vi.fn();
  const sink = createWebShaderPresentationSink(
    () => null,
    { queueStyle, requestFlush() {} },
    { createScenePresenter: () => old }
  );
  sink.commit({ view: 1, revision: 1, declaration, style: tw('') });
  old.dispose.mockImplementation(() => {
    throw new Error('old scene cleanup');
  });
  sink.commit({ view: 1, revision: 2, declaration: pixels, style: tw('') });
  expect(queueStyle).toHaveBeenCalledOnce();
  expect(sink.diagnostics?.()).toContain('shader-scene-cleanup-failed');
});
it.each(['frame', 'declaration'] as const)(
  'owned-pixels: rejected %s cannot poison a later valid frame',
  (invalid) => {
    const root = vi.fn(() => null),
      queueStyle = vi.fn();
    const sink = createWebShaderPresentationSink(root, { queueStyle, requestFlush() {} });
    const frame = { view: 1, revision: 1, declaration: pixels, style: tw('') };
    expect(() =>
      sink.commit(
        invalid === 'frame'
          ? { ...frame, revision: Infinity }
          : {
              ...frame,
              view: 2,
              declaration: {
                ...pixels,
                source: { ...pixels.source, width: 0 },
              } as ShaderPresentationDeclaration,
            }
      )
    ).toThrow();
    expect(queueStyle).not.toHaveBeenCalled();
    sink.commit(frame);
    expect(root).toHaveBeenCalledOnce();
    expect(queueStyle).toHaveBeenCalledOnce();
  }
);
it('owned-pixels: a stale valid frame retains its original diagnostic and performs no preparation', () => {
  const root = vi.fn(() => null),
    queueStyle = vi.fn();
  const sink = createWebShaderPresentationSink(root, { queueStyle, requestFlush() {} });
  sink.commit({ view: 2, revision: 1, declaration: pixels, style: tw('') });
  sink.commit({ view: 1, revision: 1, declaration: pixels, style: tw('') });
  expect(root).toHaveBeenCalledOnce();
  expect(queueStyle).toHaveBeenCalledOnce();
  expect(sink.diagnostics?.()).toContain('shader-stale-frame');
});
it('owned-scene: a rejected frame cannot advance the factory acquisition boundary', () => {
  const returned = capability(),
    createScenePresenter = vi.fn(() => returned);
  const sink = createWebShaderPresentationSink(
    () => null,
    { queueStyle() {}, requestFlush() {} },
    { createScenePresenter }
  );
  expect(() => sink.commit({ view: 1, revision: Infinity, declaration, style: tw('') })).toThrow(
    'shader-invalid-frame'
  );
  expect(createScenePresenter).not.toHaveBeenCalled();
  sink.commit({ view: 1, revision: 1, declaration, style: tw('') });
  expect(createScenePresenter).toHaveBeenCalledOnce();
  expect(returned.commit).toHaveBeenCalledOnce();
});
