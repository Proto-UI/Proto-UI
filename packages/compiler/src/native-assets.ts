import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The pinned Node bundle defines this path relative to its emitted index.js.
// Source execution resolves from this module, never from a caller's cwd.
declare const __PUI_COMPILER_NATIVE_ASSET_BASE__: string | undefined;

export type CompilerNativeAsset = 'llvm-builder.cpp' | 'rust-builder';

export function resolveCompilerNativeAsset(asset: CompilerNativeAsset): string {
  const relativeBase =
    typeof __PUI_COMPILER_NATIVE_ASSET_BASE__ === 'undefined'
      ? '../native/'
      : __PUI_COMPILER_NATIVE_ASSET_BASE__;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativeBase, asset);
}
