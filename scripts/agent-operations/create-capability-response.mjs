import { createCapabilityResponseTemplate } from './assessment-runtime.mjs';
import { parseNamedArgs, readJsonInput } from './assessment-io.mjs';

const args = parseNamedArgs(process.argv.slice(2), new Set(['--challenge']));
const challenge = readJsonInput(args.get('--challenge'), 'challenge');
const template = createCapabilityResponseTemplate(challenge);
process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
