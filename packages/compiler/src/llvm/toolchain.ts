import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnostic, err, ok, type CompileResult } from '../diagnostics';

export interface LlvmToolchainInfo {
  readonly available: boolean;
  readonly version?: string;
  readonly opt?: string;
  readonly llc?: string;
  readonly llvmAs?: string;
  readonly wasmLd?: string;
}

export interface LlvmOptimizeResult {
  readonly ir: string;
  readonly passes: string;
  readonly linesBefore: number;
  readonly linesAfter: number;
}

function findBinary(name: string): string | undefined {
  const res = spawnSync('which', [name], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout.trim()) return res.stdout.trim();
  return undefined;
}

let cachedToolchain: LlvmToolchainInfo | undefined;

/** Detect installed LLVM binaries (`opt`, `llc`, `llvm-as`, `wasm-ld`). Cached per process. */
export function detectLlvmToolchain(forceRefresh = false): LlvmToolchainInfo {
  if (cachedToolchain && !forceRefresh) return cachedToolchain;
  const opt = findBinary('opt');
  const llc = findBinary('llc');
  const llvmAs = findBinary('llvm-as');
  const wasmLd = findBinary('wasm-ld');
  const llvmConfig = findBinary('llvm-config');
  let version: string | undefined;
  if (llvmConfig) {
    const v = spawnSync(llvmConfig, ['--version'], { encoding: 'utf8' });
    if (v.status === 0) version = v.stdout.trim();
  } else if (opt) {
    const v = spawnSync(opt, ['--version'], { encoding: 'utf8' });
    const m = v.stdout.match(/LLVM version\s+([^\s]+)/);
    if (m) version = m[1];
  }
  cachedToolchain = {
    available: Boolean(opt),
    version,
    opt,
    llc,
    llvmAs,
    wasmLd,
  };
  return cachedToolchain;
}

/** Verify textual LLVM IR with real LLVM `opt -passes=verify -disable-output`. */
export function verifyLlvmIr(ll: string): CompileResult<{ verified: true; version?: string }> {
  const tc = detectLlvmToolchain();
  if (!tc.opt) {
    return err([
      diagnostic(
        'PUI_LLVM001',
        'llvm',
        'LLVM `opt` binary not found on PATH; cannot verify LLVM IR.'
      ),
    ]);
  }
  const res = spawnSync(tc.opt, ['-passes=verify', '-disable-output'], {
    input: ll,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    return err([
      diagnostic(
        'PUI_LLVM002',
        'llvm',
        `LLVM IR verification failed:\n${(res.stderr || res.stdout).trim()}`
      ),
    ]);
  }
  return ok({ verified: true, version: tc.version });
}

/** Optimize textual LLVM IR via real LLVM `opt` (defaults to `verify,default<O2>`). */
export function optimizeLlvmIr(
  ll: string,
  options: { level?: 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz'; passes?: string } = {}
): CompileResult<LlvmOptimizeResult> {
  const tc = detectLlvmToolchain();
  if (!tc.opt) {
    return err([
      diagnostic(
        'PUI_LLVM001',
        'llvm',
        'LLVM `opt` binary not found on PATH; cannot optimize LLVM IR.'
      ),
    ]);
  }
  const passes = options.passes ?? `verify,default<${options.level ?? 'O2'}>`;
  const res = spawnSync(tc.opt, ['-S', `-passes=${passes}`], {
    input: ll,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    return err([
      diagnostic(
        'PUI_LLVM003',
        'llvm',
        `LLVM opt (${passes}) failed:\n${(res.stderr || res.stdout).trim()}`
      ),
    ]);
  }
  const out = res.stdout;
  return ok({
    ir: out,
    passes,
    linesBefore: ll.split('\n').length,
    linesAfter: out.split('\n').length,
  });
}

/** Assemble textual LLVM IR into binary LLVM bitcode (`.bc`) via `llvm-as`. */
export function assembleLlvmBitcode(ll: string): CompileResult<Uint8Array> {
  const tc = detectLlvmToolchain();
  if (!tc.llvmAs) {
    return err([diagnostic('PUI_LLVM001', 'llvm', 'LLVM `llvm-as` binary not found on PATH.')]);
  }
  const res = spawnSync(tc.llvmAs, ['-o', '-'], {
    input: Buffer.from(ll, 'utf8'),
  });
  if (res.status !== 0) {
    return err([
      diagnostic('PUI_LLVM004', 'llvm', `llvm-as failed:\n${res.stderr.toString('utf8').trim()}`),
    ]);
  }
  return ok(new Uint8Array(res.stdout));
}

/** Lower LLVM IR to target assembly text (`.s`) via `llc`. */
export function compileLlvmToAssembly(
  ll: string,
  options: { targetTriple?: string; optLevel?: '0' | '1' | '2' | '3' } = {}
): CompileResult<string> {
  const tc = detectLlvmToolchain();
  if (!tc.llc) {
    return err([diagnostic('PUI_LLVM001', 'llvm', 'LLVM `llc` binary not found on PATH.')]);
  }
  const args = ['-filetype=asm', `-O${options.optLevel ?? '2'}`];
  if (options.targetTriple) args.push(`-mtriple=${options.targetTriple}`);
  const res = spawnSync(tc.llc, args, { input: ll, encoding: 'utf8' });
  if (res.status !== 0) {
    return err([
      diagnostic('PUI_LLVM005', 'llvm', `llc assembly emission failed:\n${res.stderr.trim()}`),
    ]);
  }
  return ok(res.stdout);
}

/** Lower LLVM IR to a target relocatable object file (`.o`) via `llc`. */
export function compileLlvmToObject(
  ll: string,
  options: { targetTriple?: string; optLevel?: '0' | '1' | '2' | '3' } = {}
): CompileResult<Uint8Array> {
  const tc = detectLlvmToolchain();
  if (!tc.llc) {
    return err([diagnostic('PUI_LLVM001', 'llvm', 'LLVM `llc` binary not found on PATH.')]);
  }
  const args = ['-filetype=obj', `-O${options.optLevel ?? '2'}`];
  if (options.targetTriple) args.push(`-mtriple=${options.targetTriple}`);
  const res = spawnSync(tc.llc, args, { input: Buffer.from(ll, 'utf8') });
  if (res.status !== 0) {
    return err([
      diagnostic(
        'PUI_LLVM006',
        'llvm',
        `llc object emission failed:\n${res.stderr.toString('utf8').trim()}`
      ),
    ]);
  }
  return ok(new Uint8Array(res.stdout));
}

/**
 * Compile LLVM IR end-to-end into a real executable WebAssembly module (`.wasm`):
 *   LLVM IR (.ll) -> `opt -passes=verify,default<O2>` -> `llc -mtriple=wasm32-unknown-unknown -filetype=obj`
 *   -> `wasm-ld --no-entry --export-all --allow-undefined` -> executable Uint8Array (.wasm)
 */
export function compileLlvmToWasm(
  ll: string,
  options: { level?: 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz' } = {}
): CompileResult<{ wasm: Uint8Array; optimizedIr: string }> {
  const tc = detectLlvmToolchain();
  if (!tc.opt || !tc.llc || !tc.wasmLd) {
    return err([
      diagnostic(
        'PUI_LLVM001',
        'llvm',
        'Compiling to WebAssembly requires LLVM `opt`, `llc`, and `wasm-ld` on PATH.'
      ),
    ]);
  }

  const optRes = optimizeLlvmIr(ll, { level: options.level ?? 'O2' });
  if (!optRes.ok) return optRes;

  const objRes = compileLlvmToObject(optRes.value.ir, {
    targetTriple: 'wasm32-unknown-unknown',
    optLevel: '2',
  });
  if (!objRes.ok) return objRes;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-llvm-wasm-'));
  try {
    const objPath = path.join(tmpDir, 'module.o');
    const wasmPath = path.join(tmpDir, 'module.wasm');
    fs.writeFileSync(objPath, objRes.value);
    const link = spawnSync(
      tc.wasmLd,
      ['--no-entry', '--export-all', '--allow-undefined', '-o', wasmPath, objPath],
      { encoding: 'utf8' }
    );
    if (link.status !== 0) {
      return err([
        diagnostic(
          'PUI_LLVM007',
          'llvm',
          `wasm-ld link failed:\n${(link.stderr || link.stdout).trim()}`
        ),
      ]);
    }
    const wasm = new Uint8Array(fs.readFileSync(wasmPath));
    return ok({ wasm, optimizedIr: optRes.value.ir });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
