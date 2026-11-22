import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { schemaResult } from './schema.mjs';
import { applyMessage, projectSurface } from './mapping.mjs';

const fixture = () => JSON.parse(fs.readFileSync(new URL('fixtures/settings.json', import.meta.url), 'utf8'))[0];

test('both paths consume an officially schema-valid literal fixture', () => {
  const message = fixture();
  assert.deepEqual(schemaResult(message), { valid: true, errors: [] });
  const model = projectSurface(applyMessage(null, message));
  assert.deepEqual(model.tabs.map((tab) => tab.value), ['general', 'privacy', 'notifications']);
});
test('schema validity and accessibility sufficiency are different observations', () => {
  const message = fixture();
  delete message.createSurface.components[0]['@accessibility'];
  assert.equal(schemaResult(message).valid, true);
  assert.equal(projectSurface(message.createSurface).label, undefined);
});
test('valid external binding is rejected explicitly by the common literal subset', () => {
  const message = fixture();
  message.createSurface.components[0].tabs[0].title = { '@path': '/label' };
  assert.equal(schemaResult(message).valid, true);
  assert.throws(() => projectSurface(message.createSurface), /Unsupported dynamic tab title/);
});
test('malformed external input does not get a schema-valid label', () => {
  const message = fixture();
  message.createSurface.components[0].tabs[0].child = 42;
  assert.equal(schemaResult(message).valid, false);
});
test('external function RPC is explicit application work, not a Tabs operation', () => {
  const message = JSON.parse(fs.readFileSync(new URL('fixtures/function-rpc.json', import.meta.url), 'utf8'));
  assert.equal(schemaResult(message).valid, true);
  assert.throws(() => applyMessage(null, message), /Unsupported message/);
});
test('unconsumed catalog features fail explicitly rather than silently disappear', () => {
  const message = fixture();
  message.createSurface.components[0]['@accessibility'].description = 'Extra description';
  assert.equal(schemaResult(message).valid, true);
  assert.throws(() => projectSurface(message.createSurface), /Unsupported accessibility field/);
});
test('surface retirement rejects stale update and duplicate owner creation', () => {
  const retired = new Set();
  const current = applyMessage(null, fixture(), retired);
  assert.throws(() => applyMessage(current, fixture(), retired), /delete the current owner/);
  const deletion = { version: '1.0', deleteSurface: { surfaceId: current.surfaceId } };
  assert.equal(schemaResult(deletion).valid, true);
  assert.equal(applyMessage(current, deletion, retired), null);
  assert.throws(() => applyMessage(null, fixture(), retired), /fresh surface ID/);
  assert.throws(() => applyMessage(null, { version: '1.0', updateComponents: { surfaceId: current.surfaceId, components: [] } }), /Unknown surface update/);
});
