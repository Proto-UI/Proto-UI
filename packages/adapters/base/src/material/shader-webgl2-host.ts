/**
 * First-party atomic WebGL2 resources and physical paint leases.
 * This module has no Proto, Runtime, Adapter or graph evaluator dependency. Its
 * exact source is also delivered with compiled native consumers. Keep all
 * component state, pass selection and graph traversal outside this host atom.
 */
export type NativeShaderSource = Readonly<{
  width: number;
  height: number;
  pixels: readonly number[];
}>;
export type NativeShaderResource = Readonly<object>;
export type NativeShaderTint = readonly [number, number, number, number];
export interface WebShaderDevice {
  upload(source: NativeShaderSource): NativeShaderResource;
  copy(input: NativeShaderResource): NativeShaderResource;
  tint(input: NativeShaderResource, multiplier: NativeShaderTint): NativeShaderResource;
  image(input: NativeShaderResource): string;
  /** Host diagnostic readback: linear premultiplied RGBA8 in logical top-left order. */
  read(input: NativeShaderResource): Uint8Array;
  dispose(): void;
}

// Immutable first-party kernels. Generated output records each exact UTF-8 digest.
export const SHADER_VERTEX_V1 = `#version 300 es
precision highp float;
void main() {
  vec2 point = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
}`;
export const SHADER_COPY_RGBA8_V1 = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D inputTexture;
out vec4 color;
void main() { color = texelFetch(inputTexture, ivec2(gl_FragCoord.xy), 0); }`;
export const SHADER_TINT_RGBA8_V1 = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D inputTexture;
uniform vec4 tint;
out vec4 color;
void main() {
  vec4 inputColor = texelFetch(inputTexture, ivec2(gl_FragCoord.xy), 0);
  color = vec4(inputColor.rgb * tint.rgb * tint.a, inputColor.a * tint.a);
}`;
export const SHADER_PUBLISH_SRGB_V1 = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D inputTexture;
out vec4 color;
vec3 encodeSrgb(vec3 linear) {
  return mix(1.055 * pow(max(linear, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
             12.92 * linear, lessThanEqual(linear, vec3(0.0031308)));
}
void main() {
  ivec2 size = textureSize(inputTexture, 0);
  ivec2 point = ivec2(int(gl_FragCoord.x), size.y - 1 - int(gl_FragCoord.y));
  vec4 inputColor = texelFetch(inputTexture, point, 0);
  vec3 straight = inputColor.a > 0.0 ? inputColor.rgb / inputColor.a : vec3(0.0);
  color = vec4(clamp(encodeSrgb(straight), 0.0, 1.0), inputColor.a);
}`;

export function createWebShaderDevice(
  document: Document,
  contextLost: () => void
): WebShaderDevice {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!context) throw new Error('shader-webgl2-unavailable');
  const gl: WebGL2RenderingContext = context;
  type Resource = {
    texture: WebGLTexture;
    framebuffer: WebGLFramebuffer;
    width: number;
    height: number;
  };
  const resources = new WeakMap<NativeShaderResource, Resource>();
  const cleanup: (() => void)[] = [];
  const programs = new Map<
    string,
    { program: WebGLProgram; input: WebGLUniformLocation; tint?: WebGLUniformLocation }
  >();
  let disposed = false,
    lost = false;
  const live = () => {
    if (disposed || lost || gl.isContextLost()) throw new Error('shader-context-unavailable');
  };
  const check = () => {
    live();
    if (gl.getError() !== gl.NO_ERROR) throw new Error('shader-gl-operation-failed');
  };
  const own = <T>(value: T | null, release: (value: T) => void, reason: string): T => {
    if (!value) throw new Error(reason);
    if (disposed || lost) {
      try {
        release(value);
      } finally {
        throw new Error('shader-context-unavailable');
      }
    }
    let released = false;
    cleanup.push(() => {
      if (released) return;
      released = true;
      release(value);
    });
    return value;
  };
  const onLoss = (event: Event) => {
    event.preventDefault();
    if (disposed || lost) return;
    lost = true;
    contextLost();
  };
  canvas.addEventListener('webglcontextlost', onLoss);
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', onLoss);
    let first: unknown;
    for (const release of cleanup.splice(0).reverse())
      try {
        release();
      } catch (error) {
        first ??= error;
      }
    programs.clear();
    canvas.width = 0;
    canvas.height = 0;
    if (first) throw first;
  }
  function program(fragment: string) {
    const cached = programs.get(fragment);
    if (cached) return cached;
    const shaders = [SHADER_VERTEX_V1, fragment].map((source, index) => {
      const shader = own(
        gl.createShader(index === 0 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER),
        (value) => gl.deleteShader(value),
        'shader-allocation-failed'
      );
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error('shader-compile-failed');
      return shader;
    });
    const linked = own(
      gl.createProgram(),
      (value) => gl.deleteProgram(value),
      'shader-program-allocation-failed'
    );
    for (const shader of shaders) gl.attachShader(linked, shader);
    gl.linkProgram(linked);
    if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw new Error('shader-link-failed');
    const input = gl.getUniformLocation(linked, 'inputTexture');
    const tint =
      fragment === SHADER_TINT_RGBA8_V1 ? gl.getUniformLocation(linked, 'tint') : undefined;
    if (input === null || tint === null) throw new Error('shader-interface-unavailable');
    const result = { program: linked, input, tint };
    programs.set(fragment, result);
    return result;
  }
  function resource(
    width: number,
    height: number,
    pixels: Uint8Array | null
  ): NativeShaderResource {
    live();
    const texture = own(
      gl.createTexture(),
      (value) => gl.deleteTexture(value),
      'shader-texture-allocation-failed'
    );
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const framebuffer = own(
      gl.createFramebuffer(),
      (value) => gl.deleteFramebuffer(value),
      'shader-framebuffer-allocation-failed'
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error('shader-framebuffer-incomplete');
    check();
    const handle = Object.freeze({});
    resources.set(handle, { texture, framebuffer, width, height });
    return handle;
  }
  function requireResource(handle: NativeShaderResource): Resource {
    live();
    const found = resources.get(handle);
    if (!found) throw new Error('shader-foreign-resource');
    return found;
  }
  function draw(
    input: Resource,
    framebuffer: WebGLFramebuffer | null,
    fragment: string,
    multiplier?: NativeShaderTint
  ) {
    const compiled = program(fragment);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, input.width, input.height);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DITHER);
    gl.colorMask(true, true, true, true);
    gl.useProgram(compiled.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input.texture);
    gl.uniform1i(compiled.input, 0);
    if (multiplier) gl.uniform4fv(compiled.tint!, new Float32Array(multiplier));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    check();
  }
  try {
    const vao = own(
      gl.createVertexArray(),
      (value) => gl.deleteVertexArray(value),
      'shader-vertex-array-allocation-failed'
    );
    gl.bindVertexArray(vao);
    check();
  } catch (error) {
    try {
      dispose();
    } catch {}
    throw error;
  }
  return {
    upload(source) {
      live();
      if (
        !Number.isSafeInteger(source.width) ||
        !Number.isSafeInteger(source.height) ||
        source.width < 1 ||
        source.height < 1 ||
        source.width * source.height > 262144 ||
        source.width > 1024 ||
        source.height > 1024 ||
        source.pixels.length !== source.width * source.height * 4
      )
        throw new Error('shader-source-budget');
      return resource(source.width, source.height, new Uint8Array(source.pixels));
    },
    copy(handle) {
      const input = requireResource(handle),
        output = resource(input.width, input.height, null);
      draw(input, requireResource(output).framebuffer, SHADER_COPY_RGBA8_V1);
      return output;
    },
    tint(handle, multiplier) {
      if (
        multiplier.length !== 4 ||
        !multiplier.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      )
        throw new Error('shader-invalid-tint');
      const input = requireResource(handle),
        output = resource(input.width, input.height, null);
      draw(input, requireResource(output).framebuffer, SHADER_TINT_RGBA8_V1, multiplier);
      return output;
    },
    image(handle) {
      const input = requireResource(handle);
      canvas.width = input.width;
      canvas.height = input.height;
      draw(input, null, SHADER_PUBLISH_SRGB_V1);
      const url = canvas.toDataURL('image/png');
      if (!url.startsWith('data:image/png;base64,')) throw new Error('shader-output-unavailable');
      return url;
    },
    read(handle) {
      const input = requireResource(handle),
        pixels = new Uint8Array(input.width * input.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, input.framebuffer);
      gl.readPixels(0, 0, input.width, input.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      check();
      return pixels;
    },
    dispose,
  };
}

export type WebShaderProgram = (device: WebShaderDevice) => NativeShaderResource;
export type WebShaderPublication = Readonly<{
  view: number;
  revision: number;
  key: string;
  fallback: readonly [number, number, number, number];
}>;

/** Physical lease only. The caller supplies already-selected direct GPU work. */
export function createWebShaderPresenter(options: { root(): HTMLElement | null; prepare(): void }) {
  type Write = { value: string; priority: string };
  type Lease = {
    frame: WebShaderPublication;
    root: HTMLElement;
    document: Document;
    baseline: Map<string, Write>;
    owned: Map<string, Write>;
    device: WebShaderDevice | null;
    image: HTMLImageElement | null;
    observer: MutationObserver | null;
    retired: boolean;
    pending: boolean;
    ownershipLost: boolean;
  };
  const reasons = new Set<string>();
  let active: Lease | null = null,
    last: WebShaderPublication | null = null;
  let releasedView = -1,
    serial = 0,
    failed = false,
    disposed = false;
  const blocked = new WeakMap<HTMLElement, number>();
  const diagnose = (reason: string) => {
    reasons.add(reason);
  };
  const current = (lease: Lease) =>
    !disposed &&
    active === lease &&
    !lease.retired &&
    lease.root.isConnected &&
    lease.root === options.root() &&
    lease.root.ownerDocument === lease.document;
  const owns = (lease: Lease, key: string, value: Write) =>
    lease.root.style.getPropertyValue(key) === value.value &&
    lease.root.style.getPropertyPriority(key) === value.priority;
  function loseOwnership(lease: Lease) {
    lease.ownershipLost = true;
    blocked.set(lease.root, Math.max(blocked.get(lease.root) ?? -1, lease.frame.view));
    diagnose('shader-paint-ownership-lost');
  }
  function releaseDevice(lease: Lease) {
    const previous = lease.device;
    lease.device = null;
    if (previous)
      try {
        previous.dispose();
      } catch {
        diagnose('shader-cleanup-failed');
      }
  }
  function restore(lease: Lease) {
    const entries = [...lease.owned].map(([key, write]) => ({
      key,
      write,
      baseline: lease.baseline.get(key)!,
    }));
    lease.owned.clear();
    lease.baseline.clear();
    for (const entry of entries) {
      // A cleanup callback may already have published a replacement on this same root.
      if (active && active !== lease && active.root === lease.root && active.owned.has(entry.key))
        continue;
      if (!owns(lease, entry.key, entry.write)) {
        loseOwnership(lease);
        continue;
      }
      try {
        if (entry.baseline.value)
          lease.root.style.setProperty(entry.key, entry.baseline.value, entry.baseline.priority);
        else lease.root.style.removeProperty(entry.key);
      } catch {
        diagnose('shader-paint-cleanup-failed');
      }
    }
  }
  function retire(lease: Lease | null) {
    if (!lease || lease.retired) return;
    lease.retired = true;
    lease.pending = false;
    if (active === lease) active = null;
    const image = lease.image,
      observer = lease.observer;
    lease.image = null;
    lease.observer = null;
    // Detach all old state before invoking deletion/DOM hooks. They can reenter commit.
    observer?.disconnect();
    restore(lease);
    if (image)
      try {
        image.src = '';
      } catch {}
    releaseDevice(lease);
  }
  function leaseCurrent(lease: Lease): boolean {
    if (lease.ownershipLost) return false;
    for (const [key, write] of lease.owned)
      if (!owns(lease, key, write)) {
        lease.owned.delete(key);
        lease.baseline.delete(key);
        loseOwnership(lease);
        return false;
      }
    return true;
  }
  function write(lease: Lease, key: string, value: string): boolean {
    if (!current(lease) || !leaseCurrent(lease)) return false;
    const original = {
      value: lease.root.style.getPropertyValue(key),
      priority: lease.root.style.getPropertyPriority(key),
    };
    if (!lease.baseline.has(key)) lease.baseline.set(key, original);
    lease.root.style.setProperty(key, value);
    const applied = {
      value: lease.root.style.getPropertyValue(key),
      priority: lease.root.style.getPropertyPriority(key),
    };
    if (!current(lease)) {
      // Restore only an orphaned old write, never a newer lease on the same property.
      if (!(active?.root === lease.root && active.owned.has(key)) && owns(lease, key, applied)) {
        if (original.value) lease.root.style.setProperty(key, original.value, original.priority);
        else lease.root.style.removeProperty(key);
      }
      return false;
    }
    if (!applied.value) throw new Error('shader-paint-rejected');
    lease.owned.set(key, applied);
    return true;
  }
  function fallback(lease: Lease): boolean {
    if (!current(lease) || !leaseCurrent(lease)) return false;
    const rgba = lease.frame.fallback;
    return (
      write(lease, 'background-color', `rgb(${rgba[0] * 255} ${rgba[1] * 255} ${rgba[2] * 255})`) &&
      write(lease, 'background-image', 'none') &&
      write(lease, 'background-size', '100% 100%') &&
      write(lease, 'background-repeat', 'no-repeat')
    );
  }
  function failure(reason: string, lease: Lease) {
    if (!current(lease)) return;
    failed = true;
    lease.pending = false;
    diagnose(reason);
    try {
      if (!fallback(lease)) restore(lease);
    } catch {
      diagnose('shader-fallback-failed');
    }
    releaseDevice(lease);
  }
  function commit(
    next: WebShaderPublication,
    program: WebShaderProgram,
    prepare = options.prepare
  ) {
    if (disposed) return;
    if (
      !Number.isSafeInteger(next.view) ||
      next.view < 0 ||
      !Number.isSafeInteger(next.revision) ||
      next.revision < 0
    )
      throw new Error('shader-invalid-frame');
    if (
      next.view <= releasedView ||
      (last &&
        (next.view < last.view || (next.view === last.view && next.revision < last.revision)))
    ) {
      diagnose('shader-stale-frame');
      return;
    }
    if (
      last &&
      next.view === last.view &&
      next.revision === last.revision &&
      !failed &&
      active &&
      current(active)
    )
      return;
    const accepted = Object.freeze({
      ...next,
      fallback: Object.freeze([...next.fallback]) as unknown as WebShaderPublication['fallback'],
    });
    const turn = ++serial;
    last = accepted;
    failed = false;
    // A failed or reentrant semantic preparation cannot leave an older decode publishable.
    retire(active);
    if (disposed || turn !== serial) return;
    let preparationFailed = false;
    try {
      prepare();
    } catch {
      preparationFailed = true;
      if (turn === serial) {
        failed = true;
        diagnose('shader-semantic-style-failed');
      }
    }
    if (disposed || turn !== serial) return;
    const root = options.root();
    if (!root?.isConnected) {
      failed = true;
      diagnose('shader-root-unavailable');
      return;
    }
    if (blocked.get(root) === accepted.view) {
      failed = true;
      diagnose('shader-paint-ownership-lost');
      return;
    }
    const lease: Lease = {
      frame: accepted,
      root,
      document: root.ownerDocument,
      baseline: new Map(),
      owned: new Map(),
      device: null,
      image: null,
      observer: null,
      retired: false,
      pending: false,
      ownershipLost: false,
    };
    active = lease;
    try {
      if (!fallback(lease)) {
        failure('shader-paint-ownership-lost', lease);
        return;
      }
      if (preparationFailed) return;
      const Observer = lease.document.defaultView?.MutationObserver;
      if (Observer) {
        lease.observer = new Observer(() => {
          if (active === lease && !lease.retired && !current(lease))
            commit(accepted, program, prepare);
        });
        lease.observer.observe(lease.document, { childList: true, subtree: true });
      }
      const created = createWebShaderDevice(lease.document, () =>
        failure('shader-context-lost', lease)
      );
      if (!current(lease)) {
        created.dispose();
        return;
      }
      lease.device = created;
      const output = program(created);
      if (!current(lease)) {
        releaseDevice(lease);
        return;
      }
      const url = created.image(output);
      if (!current(lease)) {
        releaseDevice(lease);
        return;
      }
      const image = lease.document.createElement('img');
      lease.image = image;
      lease.pending = true;
      image.src = url;
      if (typeof image.decode !== 'function') {
        failure('shader-decode-unavailable', lease);
        return;
      }
      image.decode().then(
        () => {
          if (!current(lease) || lease.image !== image || !lease.pending) return;
          lease.pending = false;
          try {
            if (!write(lease, 'background-image', 'url("' + url + '")'))
              failure('shader-paint-ownership-lost', lease);
          } catch {
            failure('shader-publication-failed', lease);
          }
        },
        () => {
          if (current(lease) && lease.image === image) failure('shader-decode-failed', lease);
        }
      );
    } catch (error) {
      failure(
        error instanceof Error && /^shader-[a-z0-9-]+$/.test(error.message)
          ? error.message
          : 'shader-preparation-failed',
        lease
      );
    }
  }
  return {
    commit,
    release(view: number) {
      if (!last || view !== last.view) return;
      releasedView = Math.max(releasedView, view);
      serial++;
      retire(active);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      serial++;
      retire(active);
    },
    diagnostics(): readonly string[] {
      return Object.freeze([...reasons]);
    },
  };
}
