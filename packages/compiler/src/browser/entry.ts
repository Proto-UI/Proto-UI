import { compilePrototype } from '../memory';
import type { BrowserCompileRequest, BrowserCompileResult } from './protocol';

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

/** Trusted bundle entry. Authored source is an argument to the AST compiler, never eval input. */
export function compileCanonicalRequest(serialized: string): string {
  const request = JSON.parse(serialized) as BrowserCompileRequest;
  // Validate the wire DTO once, before the Node API can supply implicit defaults.
  const problem = validateRequest(request);
  if (problem) {
    const response: BrowserCompileResult = {
      ok: false,
      revision: typeof request?.revision === 'string' ? request.revision : '',
      phase: 'host',
      error: { code: 'invalid-request', message: problem },
    };
    return JSON.stringify(response);
  }
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
