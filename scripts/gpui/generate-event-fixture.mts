/**
 * Emits the event-type fixture that keeps the Rust event layer honest against
 * the TypeScript one.
 *
 * Two sources, on purpose:
 *
 *   - `packages/types/src/event.ts` declares the type vocabulary. It is the
 *     authority, and the Rust mirror is generated from it rather than
 *     transcribed.
 *   - `packages/spec/fixtures/src/event/type-payload.ts` carries the spec's
 *     own accepted/rejected examples. Recording those means the Rust
 *     validator is checked against the conformance data the Web adapters are
 *     checked against, not against a second opinion about what the rules are.
 *
 * `packages/modules/event/src/impl.ts` keeps its own copy of the two arrays.
 * They are module-private, so this script reads them out of the source text
 * and fails if they have drifted from the exported authority. Generating a
 * Rust mirror against a stale copy is precisely the failure this whole
 * fixture approach exists to prevent, and that duplicate is where it would
 * come from.
 *
 *   pnpm gpui:event-fixture            # write
 *   pnpm check:gpui-event-fixture      # verify it is current
 *
 * `--fixture <path>` and `--impl <path>` target different files, which lets a
 * test prove that a stale fixture and a drifted copy actually fail instead of
 * asserting that they would.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CORE_EVENT_TYPES, OPTIONAL_EVENT_TYPES } from '../../packages/types/src/event';
import {
  EVENT_TYPE_PAYLOAD_CASES,
  type EventTypePayloadCase,
} from '../../packages/spec/fixtures/src/event/type-payload';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUT = path.join(ROOT, 'native/gpui/fixtures/event-types.json');
const DEFAULT_IMPL = path.join(ROOT, 'packages/modules/event/src/impl.ts');

/** The prefix an extension event type must carry, and must exceed. */
const EXTENSION_PREFIX = 'host:';

/**
 * The fields that cross the boundary on a portable payload.
 *
 * Deliberately short: no coordinates, no pointer id, no button number. A host
 * that needs those uses a `host:*` event or the Move Gesture channel, both of
 * which are host-local by contract.
 */
const PORTABLE_FIELDS = ['key', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat'] as const;

/** Reads one `const NAME = [ ... ] as const;` string array out of a source file. */
function readLiteralArray(source: string, name: string, where: string): string[] {
  const match = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(source);
  if (!match) throw new Error(`${name} not found in ${path.relative(ROOT, where)}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

/** Fails when the module's private copy has drifted from the exported one. */
function assertImplCopyAgrees(where: string): void {
  const source = readFileSync(where, 'utf8');
  const pairs: [string, readonly string[]][] = [
    ['CORE_EVENT_TYPES', CORE_EVENT_TYPES],
    ['OPTIONAL_EVENT_TYPES', OPTIONAL_EVENT_TYPES],
  ];
  for (const [name, authority] of pairs) {
    const copy = readLiteralArray(source, name, where);
    if (copy.join('\u0000') === [...authority].join('\u0000')) continue;
    throw new Error(
      `${name} in ${path.relative(ROOT, where)} has drifted from packages/types/src/event.ts:\n` +
        `  authority: ${authority.join(', ')}\n` +
        `  copy:      ${copy.join(', ')}`
    );
  }
}

/** The accepted and rejected type examples the spec fixture carries. */
function conformanceTypes(): { accepted: string[]; rejected: string[] } {
  const accepted = new Set<string>();
  const rejected = new Set<string>();
  // Widened to the declared case type: the tuple is `as const`, and only some
  // of its members carry `rejectedTypes`.
  const cases: readonly EventTypePayloadCase[] = EVENT_TYPE_PAYLOAD_CASES;
  for (const testCase of cases) {
    for (const type of testCase.acceptedTypes) accepted.add(type);
    for (const type of testCase.rejectedTypes ?? []) rejected.add(type);
  }
  return { accepted: [...accepted].sort(), rejected: [...rejected].sort() };
}

function optionPath(argv: readonly string[], flag: string, fallback: string): string {
  const at = argv.indexOf(flag);
  if (at === -1) return fallback;
  const value = argv[at + 1];
  if (!value) throw new Error(`${flag} needs a path`);
  return path.resolve(ROOT, value);
}

function compare(label: string, target: string, expected: string): boolean {
  let actual: string;
  try {
    actual = readFileSync(target, 'utf8');
  } catch {
    console.error(`[gpui:event-fixture] ${path.relative(ROOT, target)} is missing`);
    return false;
  }
  if (actual === expected) {
    console.log(`[gpui:event-fixture] ${path.relative(ROOT, target)} is current (${label})`);
    return true;
  }
  console.error(
    `[gpui:event-fixture] ${path.relative(ROOT, target)} is stale; run \`pnpm gpui:event-fixture\``
  );
  return false;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  assertImplCopyAgrees(optionPath(argv, '--impl', DEFAULT_IMPL));

  const { accepted, rejected } = conformanceTypes();
  const fixture = {
    note:
      'Generated by scripts/gpui/generate-event-fixture.mts. Do not edit. ' +
      'The vocabulary comes from packages/types/src/event.ts and the accepted/rejected ' +
      'examples from the spec fixture the Web adapters are checked against.',
    source: {
      vocabulary: 'packages/types/src/event.ts',
      conformance: 'packages/spec/fixtures/src/event/type-payload.ts',
    },
    /** An extension type is this prefix followed by at least one character. */
    extensionPrefix: EXTENSION_PREFIX,
    core: [...CORE_EVENT_TYPES],
    optional: [...OPTIONAL_EVENT_TYPES],
    portableFields: [...PORTABLE_FIELDS],
    /** Types a validator must accept, drawn from the spec's own cases. */
    accepted,
    /**
     * Types a validator must reject. `host:` on its own is here because the
     * prefix must be exceeded, not merely matched, and `native:` and
     * `host.click` because no layer other than `host:` exists.
     */
    rejected,
    counts: {
      core: CORE_EVENT_TYPES.length,
      optional: OPTIONAL_EVENT_TYPES.length,
      accepted: accepted.length,
      rejected: rejected.length,
    },
  };

  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  const out = optionPath(argv, '--fixture', DEFAULT_OUT);

  if (argv.includes('--check')) {
    const label = `${fixture.counts.core} core, ${fixture.counts.optional} optional`;
    if (!compare(label, out, serialized)) process.exitCode = 1;
    return;
  }

  writeFileSync(out, serialized);
  console.log(
    `[gpui:event-fixture] wrote ${path.relative(ROOT, out)}: ` +
      `${fixture.counts.core} core, ${fixture.counts.optional} optional, ` +
      `${fixture.counts.accepted} accepted, ${fixture.counts.rejected} rejected`
  );
}

// Only run when executed directly; a test imports `main` instead.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
