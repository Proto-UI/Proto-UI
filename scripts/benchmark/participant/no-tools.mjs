import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const bytes = (text) => Buffer.byteLength(text, 'utf8');
function exactKeys(value, allowed, name) {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `${name} must be an object`
  );
  assert.deepEqual(Object.keys(value).sort(), allowed.toSorted(), `${name} has unapproved fields`);
}
/** Serialize only approved prompt/material. No repository, evaluator, conversation,
 * auth, MCP, tools, system config or prior response is loaded by this module.
 * Transport/auth lives in the trusted coordinator, not the remote participant.
 */
export function participantRequest({ packet, model, maxOutputTokens, stream = false }) {
  exactKeys(packet, ['prompt', 'materials'], 'packet');
  assert.equal(typeof packet.prompt, 'string');
  assert.ok(packet.prompt.length > 0 && bytes(packet.prompt) <= 65536);
  assert.ok(Array.isArray(packet.materials) && packet.materials.length <= 8);
  assert.equal(typeof model, 'string');
  assert.ok(model.length > 0 && model.length <= 120);
  assert.ok(Number.isInteger(maxOutputTokens) && maxOutputTokens >= 1 && maxOutputTokens <= 32768);
  assert.equal(typeof stream, 'boolean', 'Invalid stream mode');
  let total = bytes(packet.prompt);
  const messages = [{ role: 'user', content: [{ type: 'input_text', text: packet.prompt }] }];
  for (const material of packet.materials) {
    exactKeys(material, ['name', 'text', 'sha256'], 'material');
    assert.equal(typeof material.name, 'string');
    assert.match(material.name, /^[a-z][a-z0-9-]{0,63}$/);
    assert.equal(typeof material.text, 'string');
    assert.equal(
      digest(material.text),
      material.sha256,
      'Material bytes differ from approved digest'
    );
    total += bytes(material.text);
    messages.push({
      role: 'user',
      content: [
        { type: 'input_text', text: `Authorized material: ${material.name}\n${material.text}` },
      ],
    });
  }
  assert.ok(total <= 131072, 'Participant input exceeds 128KiB');
  return {
    model,
    input: messages,
    tools: [],
    tool_choice: 'none',
    max_output_tokens: maxOutputTokens,
    store: false,
    stream,
  };
}

/** Parse text only. Tool/function/computer calls are never dispatched, even if a
 * provider ignores tool_choice. Unknown output types fail closed and retain raw.
 */
export function participantText(response) {
  assert.ok(response && typeof response === 'object');
  assert.equal(response.status, 'completed', `Provider status is ${response.status ?? 'missing'}`);
  assert.ok(Array.isArray(response.output), 'Provider omitted output array');
  const parts = [];
  for (const item of response.output) {
    if (item.type === 'reasoning') continue; // Retained raw, not part of deliverable.
    assert.equal(item.type, 'message', `Unsupported output item: ${item.type}`);
    assert.equal(item.role, 'assistant');
    assert.ok(Array.isArray(item.content));
    for (const content of item.content) {
      assert.equal(content.type, 'output_text', `Unsupported message content: ${content.type}`);
      assert.equal(typeof content.text, 'string');
      parts.push(content.text);
    }
  }
  const text = parts.join('\n');
  assert.ok(text.length > 0, 'Empty participant text');
  assert.ok(bytes(text) <= 1_000_000, 'Participant output exceeds 1MiB');
  return text;
}

/** One fresh stateless bounded request, no automatic retries, no feedback.
 * This module never selects or authorizes a paid/live route.
 * Caller supplies a transport taking exactly body and AbortSignal; no tool loop.
 * This proves client-side capability exclusion, not provider internals, absence
 * of pretraining contamination, or isolation of arbitrary tool-using agents.
 */
export async function exchange({
  packet,
  model,
  maxOutputTokens,
  stream = false,
  wallMs,
  transport,
}) {
  assert.ok(Number.isInteger(wallMs) && wallMs > 0 && wallMs <= 600000);
  assert.equal(typeof transport, 'function');
  const body = participantRequest({ packet, model, maxOutputTokens, stream });
  const started = new Date().toISOString();
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.no-tools-development-exchange',
    oracleAdmission: 'not-admitted',
    origin: 'unclassified-transport',
    requestedModel: model,
    returnedModel: null,
    modelSnapshot: null,
    controls: {
      tools: [],
      toolChoice: 'none',
      store: false,
      stream,
      maxOutputTokens,
      wallMs,
      seed: { status: 'unavailable' },
      temperature: { status: 'provider-default-unverified' },
    },
    requestSha256: digest(JSON.stringify(body)),
    started,
    finished: null,
    outcome: 'failed',
    response: null,
    text: null,
    error: null,
    usage: { status: 'unavailable' },
    cost: { status: 'unavailable', reason: 'No verified rate/billing receipt' },
  };
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Participant wall deadline exceeded'));
    }, wallMs);
  });
  try {
    const response = await Promise.race([transport(body, controller.signal), deadline]);
    receipt.response = response;
    receipt.returnedModel = typeof response?.model === 'string' ? response.model : null;
    // Echoed model strings do not establish immutable model snapshots.
    if (response?.usage != null)
      receipt.usage = { status: 'provider-reported-unverified', value: response.usage };
    receipt.text = participantText(response);
    receipt.outcome = 'completed';
  } catch (e) {
    receipt.error = e.message;
    receipt.outcome = controller.signal.aborted ? 'aborted' : 'failed';
  } finally {
    clearTimeout(timer);
    receipt.finished = new Date().toISOString();
    receipt.transportEvidence =
      typeof transport.evidence === 'function' ? transport.evidence() : null;
  }
  return { request: body, receipt };
}
