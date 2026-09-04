#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { findProtoPackages } from './version-utils.mjs';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const BOOTSTRAP_VERSION = /^0\.0\.0-bootstrap(?:[.-]|$)/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bootstrapReadinessViolation(metadata) {
  if (!isRecord(metadata) || !isRecord(metadata['dist-tags']) || !isRecord(metadata.versions)) {
    return 'registry metadata is missing dist-tags or versions';
  }

  const distTags = metadata['dist-tags'];
  const versions = metadata.versions;
  if (typeof distTags.bootstrap === 'string') return 'bootstrap dist-tag must be removed';

  if (typeof distTags.next === 'string' && BOOTSTRAP_VERSION.test(distTags.next)) {
    return `next must not point to bootstrap version ${distTags.next}`;
  }

  if (typeof distTags.latest === 'string' && BOOTSTRAP_VERSION.test(distTags.latest)) {
    const latestMetadata = versions[distTags.latest];
    const isSoleVersion = Object.keys(versions).length === 1;
    const isDeprecated =
      isRecord(latestMetadata) &&
      typeof latestMetadata.deprecated === 'string' &&
      latestMetadata.deprecated.trim().length > 0;
    if (!isSoleVersion || !isDeprecated) {
      return 'latest may retain bootstrap version only when it is the sole deprecated version';
    }
  }

  return null;
}

export async function checkRegistryReadiness(
  packageNames,
  {
    registry = process.env.npm_config_registry ?? DEFAULT_REGISTRY,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15_000,
  } = {}
) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const registryBase = `${registry.replace(/\/+$/, '')}/`;
  const checks = await Promise.all(
    [...new Set(packageNames)].sort().map(async (name) => {
      const url = new URL(encodeURIComponent(name), registryBase);
      try {
        const response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
        });
        if (response.status === 200) {
          let metadata;
          try {
            metadata = await response.json();
          } catch (error) {
            return {
              name,
              state: 'error',
              detail: `invalid registry metadata: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
          const violation = bootstrapReadinessViolation(metadata);
          if (violation) return { name, state: 'error', detail: violation };
          return { name, state: 'ready' };
        }
        if (response.status === 404) return { name, state: 'missing' };

        const detail = (await response.text()).trim().replace(/\s+/g, ' ').slice(0, 240);
        return {
          name,
          state: 'error',
          detail: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${
            detail ? `: ${detail}` : ''
          }`,
        };
      } catch (error) {
        return {
          name,
          state: 'error',
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  return {
    ready: checks.filter((check) => check.state === 'ready').map((check) => check.name),
    missing: checks.filter((check) => check.state === 'missing').map((check) => check.name),
    errors: checks
      .filter((check) => check.state === 'error')
      .map(({ name, detail }) => ({ name, detail })),
  };
}

export function parseRegistryReadinessArgs(argv) {
  const args = {
    registry: process.env.npm_config_registry ?? DEFAULT_REGISTRY,
    timeoutMs: 15_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--registry') args.registry = argv[++index];
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++index]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.registry) throw new Error('--registry requires a value');
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  return args;
}

async function main() {
  const args = parseRegistryReadinessArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node scripts/release/check-registry-readiness.mjs [--registry <url>] [--timeout-ms <ms>]'
    );
    return;
  }

  const packageNames = findProtoPackages().map(({ manifest }) => manifest.name);
  const report = await checkRegistryReadiness(packageNames, args);
  if (report.missing.length === 0 && report.errors.length === 0) {
    console.log(`check-registry-readiness: ${report.ready.length} package identities ready`);
    return;
  }

  console.error(
    `check-registry-readiness: ${report.missing.length} missing package identity, ${report.errors.length} registry error(s)`
  );
  for (const name of report.missing) console.error(`- missing: ${name}`);
  for (const { name, detail } of report.errors)
    console.error(`- registry error: ${name}: ${detail}`);
  if (report.missing.length > 0) {
    console.error('');
    console.error(
      'Create each missing public package with a non-release bootstrap version, then configure its Trusted Publisher before publish-all.'
    );
    console.error(
      'This public registry check proves package identity readiness only; it cannot inspect private Trusted Publisher settings.'
    );
  }
  process.exitCode = 1;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPath === import.meta.url) await main();
