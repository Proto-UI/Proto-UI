import { compilePrototype } from '../memory';
import { createHash } from 'node:crypto';
import {
  assertPreviewAdmission,
  prepareBrowserPreview,
  previewStyleTokens,
} from './preview-artifact';
import type { BrowserCompileRequest, BrowserCompileResult } from './protocol';

/** Trusted bundle entry. Authored source is an argument to the AST compiler, never eval input. */
export function compileCanonicalRequest(serialized: string): string {
  const request = JSON.parse(serialized) as BrowserCompileRequest;
  const requestSha256 = createHash('sha256').update(serialized).digest('hex');
  const result = compilePrototype(request.source, request.options);
  if (result.ok && request.preview) assertPreviewAdmission(result.value.ir);
  const response: BrowserCompileResult = result.ok
    ? {
        ok: true,
        revision: request.revision,
        requestSha256,
        source: result.value.ir.source,
        output: result.value.output,
        ...(request.preview
          ? {
              preview: prepareBrowserPreview(
                result.value.output,
                result.value.ir.exposes
                  .filter((exposure) => exposure.kind === 'event')
                  .map((exposure) => exposure.name),
                previewStyleTokens(result.value.ir)
              ),
            }
          : {}),
      }
    : {
        ok: false,
        revision: request.revision,
        requestSha256,
        phase: 'compile',
        diagnostics: result.diagnostics,
      };
  return JSON.stringify(response);
}
