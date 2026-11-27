import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { ComponentIR } from './component-ir.ts';
import { ComponentIRDiagnostic, validateComponent } from './validate.ts';
import { requireExternBinding, type GpuiExternBindings } from './extern-bindings.ts';
export type { GpuiExternBindings } from './extern-bindings.ts';

const manifest = fileURLToPath(new URL('../../targets/gpui/Cargo.toml', import.meta.url));

function generatorError(status: number | string | null, diagnostic: string): Error {
  const raw = diagnostic.trim();
  const failure = new Error(`GPUI generation failed (${status}): ${raw}`);
  if (!raw.startsWith('{')) return failure;
  let record;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return failure;
    throw error;
  }
  if (
    (record?.code !== 'host-name' && record?.code !== 'extern-unbound') ||
    record.category !== (record.code === 'extern-unbound' ? 'extern-unbound' : 'backend-missing') ||
    typeof record.message !== 'string'
  )
    return failure;
  const { source, bindings } = record;
  if (
    !source ||
    typeof source.file !== 'string' ||
    !Number.isSafeInteger(source.start) ||
    source.start < 0 ||
    !Number.isSafeInteger(source.end) ||
    source.end < source.start ||
    !Array.isArray(bindings) ||
    !bindings.every((binding: unknown) => typeof binding === 'string')
  )
    return failure;
  return new ComponentIRDiagnostic(record.code, source, record.message, bindings);
}

/** Emit an ordinary Rust module. The generator binary belongs to the compiler
 * machine; generated applications never link the generator or receive its IR. */
export async function emitGpui(
  ir: ComponentIR,
  options: { generator?: string; bindings?: GpuiExternBindings } = {}
): Promise<string> {
  const reached = validateComponent(ir);
  const registrations: string[] = [];
  const registered = new Set<string>();
  for (const { extern, source, callPath } of reached) {
    const binding = requireExternBinding(extern, 'gpui', options.bindings, source, callPath);
    if (binding.path.includes('\0') || extern.name.includes('\0')) {
      throw new ComponentIRDiagnostic('host-name', source, 'A Rust generator argument cannot contain a null character.', callPath);
    }
    if (!registered.has(extern.name)) {
      registrations.push('--extern', extern.name, binding.path);
      registered.add(extern.name);
    }
  }
  const command = options.generator ?? 'cargo';
  const args =
    options.generator === undefined
      ? ['run', '--quiet', '--locked', '--manifest-path', manifest, ...(registrations.length ? ['--', ...registrations] : [])]
      : registrations;
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  const input = pipeline(Readable.from([JSON.stringify(ir)]), child.stdin);
  const [completion, output, diagnostic, written] = await Promise.allSettled([
    once(child, 'close'),
    text(child.stdout),
    text(child.stderr),
    input,
  ]);
  if (completion.status === 'rejected') throw completion.reason;
  if (diagnostic.status === 'rejected') throw diagnostic.reason;
  const [status, signal] = completion.value;
  if (status !== 0) {
    throw generatorError(signal ?? status, diagnostic.value);
  }
  if (written.status === 'rejected') throw written.reason;
  if (output.status === 'rejected') throw output.reason;
  return output.value;
}
