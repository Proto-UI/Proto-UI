import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type QuickJSHandle,
} from 'quickjs-emscripten-core';
import { BROWSER_COMPILER_LIMITS } from './protocol';
import type { BrowserCompileRequest, BrowserCompileResult, BrowserCompilerBuild } from './protocol';

export interface BrowserCompiler {
  readonly build: BrowserCompilerBuild;
  compile(request: BrowserCompileRequest): BrowserCompileResult;
  dispose(): void;
}

function hostError(
  revision: string,
  code: Extract<BrowserCompileResult, { phase: 'host' }>['error']['code'],
  message: string
): BrowserCompileResult {
  return { ok: false, revision, phase: 'host', error: { code, message } };
}

function validateRequest(request: BrowserCompileRequest): string | null {
  if (
    !request ||
    request.format !== 1 ||
    typeof request.revision !== 'string' ||
    !request.revision ||
    request.revision.length > 128 ||
    typeof request.source !== 'string'
  )
    return 'Expected format 1, a nonempty revision and source text.';
  const options = request.options;
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    typeof options.fileName !== 'string' ||
    !options.fileName ||
    !(
      (typeof options.profile === 'string' && options.profile) ||
      (options.profile && typeof options.profile === 'object' && !Array.isArray(options.profile))
    )
  )
    return 'A virtual fileName and explicit target profile are required.';
  const keys = new Set(['fileName', 'profile', 'files', 'exportName', 'componentName']);
  if (Object.keys(options).some((key) => !keys.has(key)))
    return 'Host filesystem and unknown compiler options are unavailable.';
  if (
    (options.exportName !== undefined && typeof options.exportName !== 'string') ||
    (options.componentName !== undefined && typeof options.componentName !== 'string')
  )
    return 'Export and component names must be strings.';
  if (
    options.files !== undefined &&
    (!options.files ||
      typeof options.files !== 'object' ||
      Array.isArray(options.files) ||
      Object.values(options.files).some((value) => typeof value !== 'string'))
  )
    return 'The virtual source graph must contain only source text.';
  return null;
}

/** Only the trusted compiler bundle executes; request source is passed as a string argument. */
export async function createBrowserCompiler(
  bundle: string,
  build: BrowserCompilerBuild,
  options: { wasmLocation?: string } = {}
): Promise<BrowserCompiler> {
  const encoder = new TextEncoder();
  if (
    build.format !== 1 ||
    build.execution !== 'quickjs-wasm' ||
    bytesToHex(sha256(encoder.encode(bundle))) !== build.compilerSha256
  )
    throw new TypeError('Browser compiler bundle does not match its build identity.');
  const quickjs = await newQuickJSWASMModuleFromVariant(
    options.wasmLocation
      ? newVariant(RELEASE_SYNC, { wasmLocation: options.wasmLocation })
      : RELEASE_SYNC
  );
  const runtime = quickjs.newRuntime();
  runtime.setMemoryLimit(BROWSER_COMPILER_LIMITS.memoryBytes);
  runtime.setMaxStackSize(BROWSER_COMPILER_LIMITS.stackBytes);
  let deadline = performance.now() + BROWSER_COMPILER_LIMITS.initializationMs;
  runtime.setInterruptHandler(() => performance.now() >= deadline);
  const vm = runtime.newContext();
  const hashes = new Map<number, ReturnType<typeof sha256.create>>();
  let nextHash = 0;
  const bind = (name: string, callback: (...args: QuickJSHandle[]) => QuickJSHandle | void) => {
    const handle = vm.newFunction(name, callback);
    try {
      vm.setProp(vm.global, name, handle);
    } finally {
      handle.dispose();
    }
  };
  const clearHashes = () => {
    for (const hash of hashes.values()) hash.destroy();
    hashes.clear();
  };
  let callable: QuickJSHandle;
  try {
    bind('__puiHashCreate', () => {
      const id = ++nextHash;
      hashes.set(id, sha256.create());
      return vm.newNumber(id);
    });
    bind('__puiHashUpdate', (id, serialized) => {
      const hash = hashes.get(vm.getNumber(id));
      if (!hash) throw new TypeError('Unknown compiler digest handle.');
      hash.update(encoder.encode(JSON.parse(vm.getString(serialized))));
    });
    bind('__puiHashDigest', (id) => {
      const key = vm.getNumber(id),
        hash = hashes.get(key);
      if (!hash) throw new TypeError('Unknown compiler digest handle.');
      hashes.delete(key);
      return vm.newString(bytesToHex(hash.digest()));
    });
    vm.unwrapResult(vm.evalCode(bundle, 'trusted-compiler.js')).dispose();
    const namespace = vm.getProp(vm.global, '__puiCompiler');
    try {
      callable = vm.getProp(namespace, 'compileCanonicalRequest');
    } finally {
      namespace.dispose();
    }
  } catch (error) {
    clearHashes();
    vm.dispose();
    runtime.dispose();
    throw error;
  }
  let disposed = false;
  return {
    build: Object.freeze({ ...build }),
    compile(request) {
      const revision = typeof request?.revision === 'string' ? request.revision : '';
      if (disposed) return hostError(revision, 'disposed', 'Browser compiler has been disposed.');
      const problem = validateRequest(request);
      if (problem) return hostError(revision, 'invalid-request', problem);
      let serialized: string;
      try {
        serialized = JSON.stringify(request);
      } catch {
        return hostError(
          revision,
          'invalid-request',
          'Browser compiler requests must be JSON serializable.'
        );
      }
      if (encoder.encode(serialized).byteLength > BROWSER_COMPILER_LIMITS.inputBytes)
        return hostError(
          revision,
          'input-limit',
          'Closed compiler request exceeds the input byte limit.'
        );
      deadline = performance.now() + BROWSER_COMPILER_LIMITS.compilationMs;
      const input = vm.newString(serialized);
      try {
        const result = vm.callFunction(callable, vm.undefined, input);
        if (result.error) {
          let failure: { message?: string; name?: string };
          try {
            failure = vm.dump(result.error);
          } finally {
            result.error.dispose();
          }
          const message = failure?.message ?? String(failure);
          return hostError(
            revision,
            /interrupted|out of memory/i.test(message) ? 'execution-limit' : 'wasm-execution',
            message
          );
        }
        try {
          if ((vm.getLength(result.value) ?? 0) > BROWSER_COMPILER_LIMITS.outputCharacters)
            return hostError(
              revision,
              'execution-limit',
              'Compiler output exceeds the transfer limit.'
            );
          return JSON.parse(vm.getString(result.value)) as BrowserCompileResult;
        } finally {
          result.value.dispose();
        }
      } finally {
        input.dispose();
        clearHashes();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      callable.dispose();
      clearHashes();
      vm.dispose();
      runtime.dispose();
    },
  };
}
