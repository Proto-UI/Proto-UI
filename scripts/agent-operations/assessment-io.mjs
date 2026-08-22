import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function parseNamedArgs(argv, allowed) {
  const normalized = argv[0] === '--' ? argv.slice(1) : argv;
  const args = new Map();
  for (let index = 0; index < normalized.length; index += 2) {
    const name = normalized[index];
    const value = normalized[index + 1];
    if (!allowed.has(name) || value === undefined) {
      throw new Error(`Unknown or incomplete argument: ${name}`);
    }
    args.set(name, value);
  }
  return args;
}

export function readJsonInput(path, label) {
  if (!path) throw new Error(`${label} input is required`);
  const source = path === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(path), 'utf8');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

export function readAssessmentInputs(args, requiredKeys) {
  const bundlePath = args.get('--bundle');
  if (bundlePath) {
    for (const key of requiredKeys) {
      if (args.has(`--${key}`)) throw new Error('--bundle cannot be combined with separate inputs');
    }
    const bundle = readJsonInput(bundlePath, 'assessment bundle');
    for (const key of requiredKeys) {
      if (!Object.hasOwn(bundle, key)) throw new Error(`assessment bundle.${key} is required`);
    }
    return Object.fromEntries(requiredKeys.map((key) => [key, bundle[key]]));
  }
  return Object.fromEntries(
    requiredKeys.map((key) => [key, readJsonInput(args.get(`--${key}`), key)])
  );
}
