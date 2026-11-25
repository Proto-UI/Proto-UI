import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { ComponentIR } from './component-ir.ts';
import { validateComponent } from './validate.ts';

const manifest = fileURLToPath(new URL('../../targets/gpui/Cargo.toml', import.meta.url));

/** Emit an ordinary Rust module. The generator binary belongs to the compiler
 * machine; generated applications never link the generator or receive its IR. */
export async function emitGpui(ir: ComponentIR, options: { generator?: string } = {}): Promise<string> {
  validateComponent(ir);
  const command = options.generator ?? 'cargo';
  const args = options.generator === undefined ? ['run', '--quiet', '--locked', '--manifest-path', manifest] : [];
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  const input = pipeline(Readable.from([JSON.stringify(ir)]), child.stdin);
  const [completion, output, diagnostic, written] = await Promise.allSettled([
    once(child, 'close'), text(child.stdout), text(child.stderr), input,
  ]);
  if (completion.status === 'rejected') throw completion.reason;
  if (diagnostic.status === 'rejected') throw diagnostic.reason;
  const [status, signal] = completion.value;
  if (status !== 0) {
    throw new Error(`GPUI generation failed (${signal ?? status}): ${diagnostic.value.trim()}`);
  }
  if (written.status === 'rejected') throw written.reason;
  if (output.status === 'rejected') throw output.reason;
  return output.value;
}
