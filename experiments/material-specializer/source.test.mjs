import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import button from './button.proto.ts';
import { compileMaterialDeclarations, DECLARATION_ID } from './compile.mjs';
import { executeWithHost } from '@proto.ui/runtime';
import { FINAL_STYLE_SINK_CAP } from '../../packages/modules/feedback/src/material/final-style-sink.ts';
import { MATERIAL_BINDING_FACTORY_CAP } from '../../packages/modules/feedback/src/material/runtime-cap.ts';
import { createOwnedMaterialBinding } from '../../packages/modules/feedback/src/material/owned-slot.ts';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';

const compile = (declarations = button.modules, target = 'webgl-es100') =>
  compileMaterialDeclarations(declarations, target);
const copy = () => button.modules.map((d) => ({ id: d.id, config: structuredClone(d.config) }));
const frame = () => ({
  viewport: [172, 60],
  textureSize: [760, 560],
  bounds: [0.1, 0.2, 0.3, 0.2],
  subpixel: [0, 0],
  boxSize: [172, 60],
  dpr: 1,
  radius: 24,
  pressed: false,
  disabled: false,
});

test('the real Prototype carries a finite declaration with no host object or callback', () => {
  assert.equal(button.modules.length, 1);
  assert.equal(button.modules[0].id, DECLARATION_ID);
  assert.deepEqual(JSON.parse(JSON.stringify(button.modules[0].config)), button.modules[0].config);
  assert(Object.isFrozen(button.modules[0].config.sampling));
  assert(
    !/liquidgl|webgl|glsl|uniform|texture|binding|pipeline/i.test(
      JSON.stringify(button.modules[0].config)
    ),
    'Prototype stays at material/sampling/shape/interaction semantics'
  );
  const result = compile();
  assert.equal(result.kind, 'generated');
  assert.equal(result.execution, 'not-admitted');
  assert.equal(result.diagnostics[0].code, 'host-commit-unimplemented');
});
test('the declaration has explicit rejection on generic and unimplemented targets', () => {
  for (const target of [
    'generic-wc',
    'webgpu',
    'vulkan',
    'gles',
    'gpui',
    'flutter',
    'qt',
    'unknown',
  ]) {
    const result = compile(button.modules, target);
    assert.equal(result.kind, 'unsupported');
    assert(!result.files);
  }
  for (const declarations of [
    [],
    [null],
    [{ id: 'unknown-module' }],
    [...button.modules, ...button.modules],
  ]) {
    assert.equal(compile(declarations).kind, 'unsupported');
  }
});
test('source kinds do not silently substitute for the requested owned texture', () => {
  for (const kind of ['host-compositor-backdrop', 'reconstructed-scene', 'video-frame']) {
    const declarations = copy();
    declarations[0].config.sampling.kind = kind;
    assert.equal(compile(declarations).diagnostics[0].code, 'source-kind-mismatch');
  }
});
test('unsupported author escapes and nonfinite geometry are rejected', () => {
  for (const value of [NaN, Infinity, -1, 129]) {
    const d = copy();
    d[0].config.shape.radius = value;
    assert.equal(compile(d).kind, 'invalid');
  }
  for (const name of ['shaderSource', 'callback', 'gpuDevice', 'extra']) {
    const d = copy();
    d[0].config[name] = 'not accepted';
    assert.equal(compile(d).kind, 'invalid');
  }
  const d = copy();
  d[0].config.interaction.kind = 'invented';
  assert.equal(compile(d).kind, 'invalid');
});
test('fallback remains completely authored and opaque', () => {
  for (const color of [[0, 0, 0, 0.5], [0, 0, 0], [0, 0, NaN, 1], new Array(4)]) {
    const d = copy();
    d[0].config.fallback.fill = color;
    assert.equal(compile(d).kind, 'invalid');
  }
  assert.deepEqual(compile().resourcePlan.fallback.rgba, [0.94, 0.94, 0.96, 1]);
});
test('exact upstream shader literal hashes and all uniforms survive generation', async () => {
  const result = compile();
  const modules = JSON.parse(await readFile(new URL('modules.json', import.meta.url), 'utf8'));
  for (const [i, name] of ['lens.vert', 'lens.frag'].entries())
    assert.equal(
      createHash('sha256').update(result.files[name]).digest('hex'),
      modules[i].sourceLiteralSha256
    );
  assert.equal(result.uniformABI.length, 27);
  assert.equal(result.uniformABI.find((u) => u.name === 'u_specular').method, 'uniform1i');
  assert.equal(result.uniformABI.find((u) => u.name === 'u_revealType').method, 'uniform1i');
  assert.equal(result.uniformABI.find((u) => u.name === 'u_shadow').method, 'uniform1i');
  assert(!result.files['uniforms.mjs'].includes('compileMaterialDeclarations'));
  assert(!result.files['uniforms.mjs'].includes('queueStyle'));
});
test('every emitted bundle carries full MIT terms, exclusion and source modification record', async () => {
  const result = compile();
  assert.equal(
    result.files.LICENSE,
    await readFile(new URL('kernels/LICENSE', import.meta.url), 'utf8')
  );
  assert.match(result.files.LICENSE, /Exclusion of Assets/);
  assert.match(result.files.NOTICE, /Copyright \(c\) NaughtyDuk/);
  assert.match(result.files.NOTICE, /88f681ab7035fd55b04f63edff1841e32c4199e9/);
  assert.match(result.files.NOTICE, /no shader changes/);
});
test('generated direct writer executes own JavaScript against a spy, never a GPU', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pui-material-writer-'));
  try {
    const file = join(dir, 'uniforms.mjs');
    await writeFile(file, compile().files['uniforms.mjs']);
    const { writeFrame } = await import(pathToFileURL(file).href);
    const calls = [];
    const gl = Object.fromEntries(
      ['uniform1i', 'uniform1f', 'uniform2fv', 'uniform4fv'].map((method) => [
        method,
        (location, value) => calls.push({ method, location, value }),
      ])
    );
    const locations = Object.fromEntries(compile().uniformABI.map(({ name }) => [name, name]));
    const values = frame();
    writeFrame(gl, locations, values);
    assert.equal(calls.length, 27);
    assert.equal(calls.find((c) => c.location === 'u_bevelDepth').value, 0.06);
    calls.length = 0;
    values.pressed = true;
    writeFrame(gl, locations, values);
    assert.equal(calls.find((c) => c.location === 'u_bevelDepth').value, 0.12);
    calls.length = 0;
    values.disabled = true;
    writeFrame(gl, locations, values);
    assert.equal(calls.find((c) => c.location === 'u_bevelDepth').value, 0.06);
    assert.deepEqual(calls.find((c) => c.location === 'u_shadowMapping').value, [0, 0, 0, 0]);
    assert.equal(calls.find((c) => c.location === 'u_radius').value, 24);
    calls.length = 0;
    values.textureSize = [2048, 2048];
    assert.throws(() => writeFrame(gl, locations, values), /texel budget/);
    assert.equal(calls.length, 0);
    values.textureSize = [760, 560];
    values.pressed = 1;
    assert.throws(() => writeFrame(gl, locations, values), /state or DPR/);
    assert.equal(calls.length, 0);
    values.pressed = false;
    values.bounds = [0.9, 0.2, 0.3, 0.2];
    assert.throws(() => writeFrame(gl, locations, values), /bounds/);
    assert.equal(calls.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('real Runtime publishes Base Button material state through Feedback and disposes ownership', async () => {
  const root = new EventTarget(),
    global = new EventTarget();
  const visualFrames = [];
  const releases = [];
  const host = {
    prototypeName: button.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(fn) {
      fn();
    },
    onRuntimeReady(wiring) {
      wiring.attach('feedback', [
        [MATERIAL_BINDING_FACTORY_CAP, createOwnedMaterialBinding],
        [
          FINAL_STYLE_SINK_CAP,
          {
            commit(frame) {
              visualFrames.push(frame);
            },
            release(view) {
              releases.push(view);
            },
          },
        ],
      ]);
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => global],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
    },
  };
  const { caps, controller, invokeUnmounted } = executeWithHost(button, host);
  const exposed = caps.getPort('expose-state');
  const pressed = exposed.get('pressed'),
    disabled = exposed.get('disabled');
  assert.equal(pressed.get(), false);
  root.dispatchEvent(new CustomEvent('pointer.down'));
  assert.equal(pressed.get(), true);
  assert.equal(visualFrames.at(-1).material.pressed, true);
  assert.equal(visualFrames.at(-1).material.bindingsReady, true);
  assert(Object.isFrozen(visualFrames.at(-1).material.config.fallback.fill));
  root.dispatchEvent(new CustomEvent('pointer.cancel'));
  assert.equal(pressed.get(), false);
  root.dispatchEvent(new CustomEvent('pointer.down'));
  controller.applyRawProps({ disabled: true });
  assert.equal(disabled.get(), true);
  assert.equal(pressed.get(), false);
  assert.equal(visualFrames.at(-1).material.disabled, true);
  assert.equal(visualFrames.at(-1).material.pressed, false);
  assert(!controller.getRuleStyleTokens().some((t) => /^(bg-|backdrop-)/.test(t)));
  await invokeUnmounted();
  assert(releases.length > 0);
  assert.throws(() => pressed.get(), /disposed/);
  assert.equal(
    compile(button.modules, 'generic-wc').kind,
    'unsupported',
    'An unconsumed module is not enhanced material support'
  );
});

test('deterministic owned-source preparation preserves constants, opacity and ownership', async () => {
  const { prepareSource } = await import('./source-prefilter.mjs');
  const constant = new Uint8Array(9 * 7 * 4);
  for (let i = 0; i < constant.length; i += 4) constant.set([80, 130, 210, 255], i);
  const copy = constant.slice();
  assert.deepEqual(prepareSource(constant, 9, 7), copy);
  assert.deepEqual(constant, copy);
  const stripes = constant.slice();
  for (let i = 0; i < stripes.length; i += 4) stripes[i] = ((i / 4) % 2) * 255;
  const first = prepareSource(stripes, 9, 7);
  assert.deepEqual(first, prepareSource(stripes, 9, 7));
  assert(first.every((v, i) => i % 4 !== 3 || v === 255));
  assert(first[4 * (3 * 9 + 4)] > 80 && first[4 * (3 * 9 + 4)] < 175);
  assert.throws(() => prepareSource(stripes, 0, 7), /invalid-prefilter-source/);
  stripes[3] = 0;
  assert.throws(() => prepareSource(stripes, 9, 7), /opaque/);
});
