import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { emitGpui } from '@proto.ui/compiler/targets/gpui';
import { controlledSelection, readonlyBadge } from './fixtures/backend-programs.ts';
import { authoredBadgeSource, authoredContextSource, authoredKeyedTaskSource, authoredSource, authoredSyncRetirementSource } from './fixtures/authoring-source.mjs';

const sdkRepository = 'https://github.com/zed-industries/zed';
const sdkRevision = '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8';
const sdkSource = `git+${sdkRepository}?rev=${sdkRevision}#${sdkRevision}`;
const consumerSource = new URL('./consumers/gpui/', import.meta.url);
const support = fileURLToPath(new URL('../support/gpui/', import.meta.url));
const seedLock = new URL('../../../native/gpui/Cargo.lock', import.meta.url);

function manifest(packageName) {
  return `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
name = "generated_gpui_consumer"

[workspace]
resolver = "2"

[workspace.dependencies]
gpui = { git = "${sdkRepository}", rev = "${sdkRevision}", default-features = false }

[dependencies]
gpui.workspace = true
proto-ui-gpui-support = { path = ${JSON.stringify(support)} }

[dev-dependencies]
gpui = { workspace = true, features = ["test-support"] }
`;
}

// Cargo writes one [[package]] table per resolved package, including the local root.
function packageTables(lock) {
  return lock.split(/^\[\[/m).filter((table) => table.startsWith('package]]'));
}

function packageSources(tables, name) {
  return tables
    .filter((table) => /^name = "([^"\r\n]+)"\r?$/m.exec(table)?.[1] === name)
    .map((table) => /^source = "([^"\r\n]+)"\r?$/m.exec(table)?.[1] ?? '(path)');
}

test('Rust host name diagnostics preserve the source binding for a target caller', async () => {
  const ir = readonlyBadge();
  ir.name = 'not-a-rust-identifier';
  const generator = process.env.PROTO_UI_GPUI_GENERATOR;
  await assert.rejects(emitGpui(ir, generator ? { generator } : undefined), (error) => {
    assert.equal(error.category, 'backend-missing');
    assert.equal(error.code, 'host-name');
    assert.deepEqual(error.source, ir.source);
    assert.deepEqual(error.bindings, [ir.id]);
    assert.ok(error.message.includes(ir.name), 'the diagnostic must identify the rejected public spelling');
    return true;
  });
});

// Node 24: node --test packages/compiler/test/gpui-target.node-test.mjs
// Set PROTO_UI_GPUI_GENERATOR to use a prebuilt generator. Set PROTO_UI_GPUI_CONSUMER_DIR
// to retain the generated crate after success. Cargo inherits the caller's cache and network policy.
test('external Rust consumer renders and interacts with generated views in headless GPUI TestAppContext', async (t) => {
  const retainedRoot = process.env.PROTO_UI_GPUI_CONSUMER_DIR;
  const scratch = resolve(retainedRoot || tmpdir());
  mkdirSync(scratch, { recursive: true });
  const packageName = `proto-gpui-consumer-${randomUUID()}`;
  const crate = join(scratch, packageName);
  mkdirSync(crate);
  t.diagnostic(`Generated consumer: ${crate}`);

  cpSync(consumerSource, crate, { recursive: true });
  cpSync(new URL('./fixtures/authoring-sync-retirement/owner.proto.ts.txt', import.meta.url), join(crate, 'sync-retirement.proto.ts.txt'));
  const cargoToml = join(crate, 'Cargo.toml');
  const cargoLock = join(crate, 'Cargo.lock');
  writeFileSync(cargoToml, manifest(packageName), { flag: 'wx' });
  if (existsSync(seedLock)) {
    const lock = readFileSync(seedLock, 'utf8');
    const sources = packageSources(packageTables(lock), 'gpui');
    if (sources.length === 1 && sources[0] === sdkSource)
      writeFileSync(cargoLock, lock, { flag: 'wx' });
  }

  const generator = process.env.PROTO_UI_GPUI_GENERATOR;
  const options = generator ? { generator } : undefined;
  const authoredInput = authoredBadgeSource();
  const toggle = authoredSource('controlled-toggle.proto.ts.txt', 'ControlledToggle');
  assert.equal(toggle.status, 'produced', JSON.stringify(toggle.diagnostics));
  const contextOwner = authoredContextSource();
  assert.equal(contextOwner.status, 'produced', JSON.stringify(contextOwner.diagnostics));
  const keyedOwner = authoredKeyedTaskSource();
  assert.equal(keyedOwner.status, 'produced', JSON.stringify(keyedOwner.diagnostics));
  const syncTree = authoredSyncRetirementSource();
  assert.equal(syncTree.status, 'produced', JSON.stringify(syncTree.diagnostics));
  const tabsFile = 'context-owned-async-tabs.proto.ts.txt';
  const tabsOwner = authoredSource(tabsFile, 'AsyncTabsOwner', 'default');
  const tabsPanel = authoredSource(tabsFile, 'AsyncTabPanel', 'AsyncTabPanel');
  for (const input of [tabsOwner, tabsPanel]) {
    assert.equal(input.status, 'produced', JSON.stringify(input.diagnostics));
    const unit = input.component;
    const declaration = unit.externs.find((item) => item.name === 'authoring.load-tab');
    const panel = [unit, ...unit.components].find((body) => body.name === 'AsyncTabPanel');
    const load = panel.behaviors.find((fn) => panel.tasks.some((task) => task.fn === fn.binding.id));
    const boundary = load.blocks.map((block) => block.end).find((end) => end.kind === 'await' && end.extern === declaration.binding.id);
    assert.ok(boundary, 'the original task must reach the declared loader');
    await assert.rejects(emitGpui(unit, options), (error) => {
      assert.equal(error.code, 'extern-unbound');
      assert.ok(error.bindings.includes(panel.id));
      assert.ok(error.bindings.includes(load.binding.id));
      assert.equal(error.bindings.at(-1), declaration.binding.id);
      assert.deepEqual(error.source, boundary.source);
      return true;
    });
  }
  if (retainedRoot) {
    writeFileSync(join(crate, 'authored-source.json'), JSON.stringify(authoredInput));
    writeFileSync(join(crate, 'controlled-source.json'), JSON.stringify(toggle));
    writeFileSync(join(crate, 'context-source.json'), JSON.stringify(contextOwner));
    writeFileSync(join(crate, 'keyed-task-source.json'), JSON.stringify(keyedOwner));
    writeFileSync(join(crate, 'sync-retirement-source.json'), JSON.stringify(syncTree));
    writeFileSync(join(crate, 'tabs-owner-source.json'), JSON.stringify(tabsOwner));
    writeFileSync(join(crate, 'tabs-panel-source.json'), JSON.stringify(tabsPanel));
  }
  const programs = [
    ['delivery_badge', readonlyBadge()],
    ['selection_control', controlledSelection()],
    ['authoring_badge', authoredInput.component],
    ['controlled_toggle', toggle.component],
    ['context_owner', contextOwner.component],
    ['keyed_task_owner', keyedOwner.component, { 'fixture.load-keyed-item': { path: 'crate::keyed_loader::load_keyed_item' } }],
    ['sync_tree', syncTree.component],
    ['tabs_owner', tabsOwner.component, { 'authoring.load-tab': { path: 'crate::tabs_loader::load_owner_tab' } }],
    ['async_tab_panel', tabsPanel.component, { 'authoring.load-tab': { path: 'crate::tabs_loader::load_panel_tab' } }],
  ];
  for (const [module, program, bindings] of programs) {
    const rust = await emitGpui(program, { generator, bindings });
    writeFileSync(join(crate, 'src', `${module}.rs`), rust, { flag: 'wx' });
  }

  const result = spawnSync(
    'cargo',
    [
      'test',
      '--manifest-path',
      cargoToml,
      '--test',
      'native',
      '--',
      '--format',
      'pretty',
      '--color',
      'never',
    ],
    {
      cwd: crate,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );
  if (result.stdout) t.diagnostic(result.stdout.trimEnd());
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `cargo test failed (${result.signal ?? result.status}) in ${crate}`
  );
  const summary =
    /^test result: ok\. (\d+) passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;/m.exec(
      result.stdout
    );
  assert.ok(summary, 'Cargo must execute the native tests without ignored or filtered cases');
  assert.match(result.stdout, /^test controlled_source::uncontrolled_pointer_commit_survives_default_changes_and_reattachment \.\.\. ok\r?$/m);
  assert.match(
    result.stdout,
    /^test authoring_badge::retained_authoring_badge_paints_its_label_chip_and_nested_dot_as_inputs_change \.\.\. ok\r?$/m
  );
  for (const passedCase of [
    /^test sync_retirement::host_drop::independent_leaf_release_drops_host_resources_while_another_owner_is_live \.\.\. ok\r?$/m,
    /^test sync_retirement::host_drop::host_appearance_on_an_unstyled_reader_releases_after_the_window_drops_it \.\.\. ok\r?$/m,
    /^test sync_retirement::host_drop::key_removal_releases_host_captures_after_logical_withdrawal \.\.\. ok\r?$/m,
    /^test sync_retirement::host_drop::live_replacement_releases_old_appearance_and_resolver_captures \.\.\. ok\r?$/m,
    /^test sync_retirement::removing_a_synchronous_keyed_branch_retires_actions_and_descendant_observers \.\.\. ok\r?$/m,
    /^test sync_retirement::withdrawn_style_binding_rejects_mount_and_rebind_before_mutation \.\.\. ok\r?$/m,
    /^test keyed_task_source::reorder_removal_and_physical_move_preserve_the_correct_owned_task \.\.\. ok\r?$/m,
    /^test context_source::authored_owner_keeps_the_keyed_reader_and_supplies_a_reader_in_another_window \.\.\. ok\r?$/m,
    /^test context_source::required_reader_rejects_absence_and_the_other_key_with_the_same_label \.\.\. ok\r?$/m,
    /^test context_source::equal_replacement_withdraws_the_old_provider_and_a_physical_move_retains_the_reader \.\.\. ok\r?$/m,
    /^test tabs_source::default_owner_keeps_its_pending_panel_through_select_and_physical_reattachment \.\.\. ok\r?$/m,
    /^test tabs_source::ready_file_and_business_error_publish_after_the_loading_commit \.\.\. ok\r?$/m,
    /^test tabs_source::pending_panel_reads_the_current_provider_after_an_equal_rebind \.\.\. ok\r?$/m,
    /^test tabs_source::latest_reload_and_explicit_cancel_have_distinct_terminal_outcomes \.\.\. ok\r?$/m,
    /^test tabs_source::released_panel_cannot_submit_a_late_file_result_to_its_replacement \.\.\. ok\r?$/m,
  ]) {
    assert.match(result.stdout, passedCase);
  }
  const resolved = packageTables(readFileSync(cargoLock, 'utf8'));
  assert.deepEqual(
    packageSources(resolved, packageName),
    ['(path)'],
    'Cargo must resolve this unique consumer'
  );
  assert.deepEqual(packageSources(resolved, 'gpui'), [sdkSource]);
  t.diagnostic(`Resolved GPUI: ${sdkSource}`);
  if (!retainedRoot) rmSync(crate, { recursive: true });
});
