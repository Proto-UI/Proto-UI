import { compilePrototype } from '../memory';
import type { BrowserCompileRequest, BrowserCompileResult } from './protocol';

/** Trusted bundle entry. Authored source is an argument to the AST compiler, never eval input. */
export function compileCanonicalRequest(serialized: string): string {
  const request = JSON.parse(serialized) as BrowserCompileRequest;
  const result = compilePrototype(request.source, request.options);
  const response: BrowserCompileResult = result.ok
    ? {
        ok: true,
        revision: request.revision,
        source: result.value.ir.source,
        output: result.value.output,
      }
    : { ok: false, revision: request.revision, phase: 'compile', diagnostics: result.diagnostics };
  return JSON.stringify(response);
}
