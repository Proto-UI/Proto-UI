import fs from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

const here = new URL('./', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(`upstream/${name}`, here), 'utf8'));
const envelope = read('agent_to_renderer.json');
const common = read('common_types.json');
const catalog = read('catalog.json');
// The protocol deliberately leaves catalog.json swappable. Register its exact
// selected contents at that placeholder; the retained upstream bytes stay intact.
const catalogSlot = new URL('catalog.json', envelope.$id).href;
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema(common);
ajv.addSchema({ ...catalog, $id: catalogSlot });
export const validateMessage = ajv.compile(envelope);
export function schemaResult(message) {
  const valid = validateMessage(message);
  return { valid, errors: valid ? [] : structuredClone(validateMessage.errors) };
}
export function upstreamIdentity() {
  return Object.fromEntries(['catalog.json', 'common_types.json', 'agent_to_renderer.json', 'LICENSE'].map((file) => {
    const bytes = fs.readFileSync(new URL(`upstream/${file}`, here));
    return [file, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  }));
}
