import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const bounded = (n, max, label) =>
  assert.ok(Number.isSafeInteger(n) && n > 0 && n <= max, `Invalid ${label}`);

import { decodeResponsesSse } from './response-stream.mjs';

/** One attempt, no redirect/retry/tool loop. Credentials exist only in the trusted
 * caller and HTTP header, not request/evidence metadata. Provider raw bytes are
 * untrusted and potentially sensitive. This is NOT a live model runner/admission.
 * Plain HTTP is available only via explicit loopback test opt-in.
 */
export function responsesTransport({
  endpoint,
  token,
  archiveDir,
  maxResponseBytes = 1_000_000,
  requestTimeoutMs = 60000,
  allowLoopbackHttp = false,
  allowLegacyTerminalOnly = false,
}) {
  assert.equal(typeof allowLegacyTerminalOnly, 'boolean', 'Invalid legacy compatibility option');
  const url = new URL(endpoint);
  assert.ok(!url.username && !url.password && !url.search && !url.hash, 'Unsafe endpoint fields');
  const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname);
  assert.ok(
    url.protocol === 'https:' || (allowLoopbackHttp && loopback && url.protocol === 'http:'),
    'HTTPS required outside explicit loopback tests'
  );
  assert.ok(typeof token === 'string' && !/[\r\n]/.test(token), 'Invalid credential');
  assert.ok(token.length > 0 || (allowLoopbackHttp && loopback), 'Credential required');
  assert.ok(path.isAbsolute(archiveDir), 'Absolute archive directory required');
  bounded(maxResponseBytes, 4_000_000, 'response bound');
  bounded(requestTimeoutMs, 600000, 'request deadline');
  let used = false;
  let archiveStatus = 'not-started';
  const transport = async (body, signal) => {
    assert.ok(!used, 'Transport is single-use');
    used = true;
    assert.ok(signal instanceof AbortSignal, 'AbortSignal required');
    const streaming = body?.stream === true;
    const requestBytes = Buffer.from(JSON.stringify(body));
    assert.ok(requestBytes.length <= 1_000_000, 'Request exceeds 1MB');
    // Exclusive creation: never silently overwrite an earlier attempt.
    await mkdir(archiveDir);
    archiveStatus = 'writing';
    const metadata = {
      schemaVersion: 1,
      kind: 'proto-ui.bounded-http-attempt',
      origin: 'unclassified-http',
      admission: 'not-admitted',
      started: new Date().toISOString(),
      finished: null,
      endpoint: url.href,
      outcome: 'failed',
      status: null,
      rawBodyComplete: false,
      rawBodyBytes: 0,
      responseBytesObserved: 0,
      requestTimeoutMs,
      maxResponseBytes,
      error: null,
      files: [],
    };
    const chunks = [];
    let retainedBytes = 0;
    let terminalResponse;
    let assembledResponse;
    const save = async (name, data) => {
      await writeFile(path.join(archiveDir, name), data, { flag: 'wx' });
      metadata.files.push({ name, bytes: data.length, sha256: sha256(data) });
    };
    const failure = (message) => new Error(message);
    try {
      await save('request.json', requestBytes);
      await new Promise((resolve, reject) => {
        let settled = false;
        let response;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          if (error) {
            response?.destroy();
            request.destroy();
            reject(error);
          } else resolve();
        };
        const request = (url.protocol === 'https:' ? https : http).request(
          url,
          {
            method: 'POST',
            agent: false,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': requestBytes.length,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
          (res) => {
            response = res;
            metadata.status = res.statusCode;
            res.on('data', (chunk) => {
              if (settled) return;
              metadata.responseBytesObserved += chunk.length;
              const part = chunk.subarray(0, Math.max(0, maxResponseBytes - retainedBytes));
              chunks.push(part);
              retainedBytes += part.length;
              if (metadata.responseBytesObserved > maxResponseBytes)
                finish(failure('HTTP response byte bound exceeded'));
            });
            res.on('end', () => {
              if (settled) return;
              metadata.rawBodyComplete = true;
              finish();
            });
            res.on('error', () => finish(failure('HTTP response interrupted')));
          }
        );
        request.on('error', () => finish(failure('HTTP request failed')));
        const abort = () => finish(failure('HTTP attempt aborted'));
        const timer = setTimeout(
          () => finish(failure('HTTP attempt deadline exceeded')),
          requestTimeoutMs
        );
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        else request.end(requestBytes);
      });
      if (metadata.status >= 300 && metadata.status < 400) throw failure('HTTP redirect rejected');
      if (metadata.status < 200 || metadata.status >= 300) throw failure('HTTP non-success status');
      let response;
      if (streaming) {
        try {
          const decoded = decodeResponsesSse(Buffer.concat(chunks), { allowLegacyTerminalOnly });
          response = decoded.response;
          terminalResponse = decoded.terminalResponse;
          assembledResponse = response;
          metadata.assembly = decoded.provenance;
        } catch (error) {
          terminalResponse = error.terminalResponse;
          metadata.assembly = error.assembly;
          throw error;
        }
      } else {
        try {
          const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
          response = JSON.parse(raw);
        } catch {
          throw failure('HTTP body is not valid UTF-8 JSON');
        }
      }
      metadata.outcome = 'response-received';
      return response;
    } catch (error) {
      metadata.error = error.message;
      throw error;
    } finally {
      metadata.rawBodyBytes = retainedBytes;
      metadata.finished = new Date().toISOString();
      await save('response.raw', Buffer.concat(chunks));
      if (terminalResponse !== undefined)
        await save(
          'response.terminal.json',
          Buffer.from(JSON.stringify(terminalResponse, null, 2) + '\n')
        );
      if (assembledResponse !== undefined)
        await save(
          'response.assembled.json',
          Buffer.from(JSON.stringify(assembledResponse, null, 2) + '\n')
        );
      if (metadata.assembly)
        await save(
          'response.assembly.json',
          Buffer.from(JSON.stringify(metadata.assembly, null, 2) + '\n')
        );
      await writeFile(
        path.join(archiveDir, 'transport.json'),
        JSON.stringify(metadata, null, 2) + '\n',
        {
          flag: 'wx',
        }
      );
      archiveStatus = 'complete';
    }
  };
  transport.evidence = () => ({ archiveDir, status: archiveStatus });
  return transport;
}
