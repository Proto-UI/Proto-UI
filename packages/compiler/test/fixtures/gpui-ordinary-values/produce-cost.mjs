// A reproducible measurement fixture. Never patches emitted Rust or SDK sources.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFile } from '../../../src/compile.ts';

const fixture = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(fixture, '../../../../..');
const output = process.argv[2];
if (!output || !path.isAbsolute(output) || existsSync(output))
  throw new Error('Provide a fresh absolute output directory.');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const write = (file, value) => {
  const target = path.join(output, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
};
const revision = '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8';
const receipt = {
  schemaVersion: 1,
  kind: 'native-three-tree-cost-inputs',
  baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
    encoding: 'utf8',
  }).trim(),
  stagedTree: execFileSync('git', ['write-tree'], { cwd: repository, encoding: 'utf8' }).trim(),
  gpuiRevision: revision,
  node: process.version,
  compilerInputs: [],
  modules: [],
  cases: [],
  files: [],
  limits: [
    'No budget is accepted by this fixture.',
    'Thread-local System allocation requests during construction exclude the preexisting App/Window, other threads, later paint, OS and GPU allocations.',
    'The optimized artifact is a default-feature native cdylib with retained mount/drop symbols; it is not a complete platform application.',
    'The construction consumer uses GPUI test-support separately. Its binary is not the production size measurement.',
    'Resource registrations and live-owner counts are not allocator or retained-memory measurements.',
  ],
};
for (const dir of ['packages/compiler/src', 'packages/core/src', 'packages/hooks/src']) {
  const visit = (relative) => {
    for (const entry of readdirSync(path.join(repository, relative), { withFileTypes: true })) {
      const file = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        const data = readFileSync(path.join(repository, file));
        receipt.compilerInputs.push({ path: file, bytes: data.length, sha256: sha(data) });
      }
    }
  };
  visit(dir);
}
const generated = {};
for (const [name, entry] of [
  ['empty', path.join(fixture, 'cost-empty.proto.ts')],
  ['base_button', path.join(repository, 'packages/prototypes/base/src/button/button.proto.ts')],
]) {
  const compiled = await compileFile(entry, {
    root: repository,
    profile: 'gpui-source-v1',
    ...(name === 'empty' ? {} : { nativeSdkPath: '../empty/.proto-ui/gpui-native' }),
  });
  if (!compiled.ok) throw new Error(`${name}: ${JSON.stringify(compiled.diagnostics)}`);
  const artifacts = [
    { path: 'Component.rs', contents: compiled.value.output.code },
    ...(compiled.value.output.supportingFiles ?? []),
  ];
  for (const artifact of artifacts) write(`modules/${name}/${artifact.path}`, artifact.contents);
  write(`modules/${name}/checked-ir.json`, JSON.stringify(compiled.value.ir, null, 2));
  const source = readFileSync(entry, 'utf8');
  write(`modules/${name}/authored.proto.ts`, source);
  const manifest = artifacts.find((file) => file.path === 'Cargo.toml').contents;
  const packageName = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
  if (!packageName) throw new Error('Missing emitted package name');
  generated[name] = packageName;
  receipt.modules.push({
    name,
    entry: path.relative(repository, entry),
    sourceSha256: sha(source),
    packageName,
    inputClosure: compiled.value.ir.sourceFiles,
    componentBytes: Buffer.byteLength(compiled.value.output.code),
    componentSha256: sha(compiled.value.output.code),
    generatedFiles: artifacts.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.contents),
      sha256: sha(file.contents),
    })),
  });
}
const measurement = readFileSync(path.join(fixture, 'cost-consumer.rs'), 'utf8');
for (const name of ['empty', 'base_button', 'composed']) {
  const libraryName = `proto_ui_cost_${name}`;
  const root = name === 'base_button' ? 'base_button' : 'empty';
  const count = name === 'composed' ? 3 : 0;
  const dependencies = name === 'composed' ? ['empty', 'base_button'] : [root];
  const members = Array.from({ length: count }, (_, i) => `button${i}`);
  const declarations = members
    .map((member) => `pub ${member}:Entity<base_button::CompiledComponent>,`)
    .join('\n');
  const buttons = members
    .map(
      (
        member
      ) => `let ${member}=base_button::CompiledComponent::create(json!({}),Some(Rc::downgrade(&root.read(cx).owner)),window,cx).expect("official Base Button");
    ${member}.update(cx,|button,cx|button.set_slot(vec![NativeSnapshot::text_value(Value::string("${member}"))],cx).unwrap());`
    )
    .join('\n');
  const slots =
    name === 'composed'
      ? `let native=cx.new(|_|NativeChild);root.update(cx,|root,cx|root.set_slot(vec![${members.map((member) => `NativeSnapshot::native_view(${member}.clone().into())`).join(',')},NativeSnapshot::native_view(native.into())],cx).unwrap());`
      : name === 'base_button'
        ? 'root.update(cx,|root,cx|root.set_slot(vec![NativeSnapshot::text_value(Value::string("original Base Button"))],cx).unwrap());'
        : '';
  const all = ['root', ...members];
  const actualButtons = name === 'base_button' ? ['root'] : members;
  const lib = `use gpui::{prelude::*,App,Context,Entity,Render,Window};
use proto_ui_gpui_native::gpui_native_owner::{NativeSnapshot,OwnerRef,Value};
use serde_json::{json,Value as Json};use std::rc::Rc;
pub const CASE:&str="${name}";pub const OWNER_COUNT:usize=${all.length};
pub struct Tree{pub root:Entity<${root}::CompiledComponent>,${declarations}}
struct NativeChild;impl Render for NativeChild{fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{gpui::div().child("ordinary native child")}}
impl Render for Tree{fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{self.root.clone()}}
pub fn mount(window:&mut Window,cx:&mut App)->Entity<Tree>{
    let root=${root}::CompiledComponent::create(json!({}),None,window,cx).expect("compiled root");
    ${buttons}${slots}
    cx.new(|_|Tree{${all.join(',')}})
}
impl Tree{
    #[cfg(feature="test-support")]pub fn owners(&self,cx:&App)->Vec<OwnerRef>{vec![${all.map((member) => `self.${member}.read(cx).owner.clone()`).join(',')}]}
    #[cfg(feature="test-support")]pub fn resource_counts(&self,cx:&App)->Json{json!({${all.map((member) => `"${member}":self.${member}.read(cx).native_resource_counts()`).join(',')}})}
    #[cfg(feature="test-support")]pub fn exercise(&mut self,window:&mut Window,cx:&mut Context<Self>){${actualButtons
      .map(
        (member) => `
        self.${member}.update(cx,|button,cx|{button.set_props(json!({"disabled":true}),window,cx).unwrap();assert_eq!(button.handle().state("disabled").unwrap(),json!(true));
        button.set_props(json!({"disabled":false}),window,cx).unwrap();assert_eq!(button.handle().state("disabled").unwrap(),json!(false));});`
      )
      .join('\n')}}
    #[cfg(feature="test-support")]pub fn retire(&mut self,window:&mut Window,cx:&mut Context<Self>){${[
      ...all,
    ]
      .reverse()
      .map(
        (member) =>
          `self.${member}.update(cx,|component,cx|component.handle().dispose(window,cx).unwrap());`
      )
      .join('\n')}}
}
#[cfg(feature="test-support")]pub fn assert_resource_boundary(resources:&Json){
    ${
      root === 'empty'
        ? `let root=&resources["root"];for key in ["states","hooks","listeners","stateWatchers","propsWatchers","contextSubscriptions","anatomySubscriptions","collectionStates","scrollHandles","boundaryRegions","boundaryCallbacks","metadataKeys","schedulerBindings","delays","presenceOwners","nativeSubscriptions"]{assert_eq!(root[key],json!(0),"empty owner unexpectedly initialized {key}: {root}");}
    for key in ["pointerInput","keyInput","boundaryInput","focusObservation"]{assert_eq!(root[key],json!(false));}`
        : ''
    }
    ${actualButtons.map((member) => `assert!(resources["${member}"]["states"].as_u64().unwrap()>0);assert!(resources["${member}"]["nativeSubscriptions"].as_u64().unwrap()>0);`).join('\n')}
}
// A narrow native linking probe: the same ordinary mount implementation is
// retained behind symbols. This ABI is only for this exact Rust/GPUI build.
#[no_mangle]pub unsafe extern "C" fn proto_ui_cost_mount(window:*mut Window,cx:*mut App)->*mut Entity<Tree>{Box::into_raw(Box::new(mount(&mut *window,&mut *cx)))}
#[no_mangle]pub unsafe extern "C" fn proto_ui_cost_drop(tree:*mut Entity<Tree>){if !tree.is_null(){drop(Box::from_raw(tree));}}
`;
  const consumer = `consumers/${name}`;
  const consumerMeasurement = `${measurement}\nuse ${libraryName} as subject;\n`;
  write(`${consumer}/src/lib.rs`, lib);
  write(`${consumer}/tests/measure.rs`, consumerMeasurement);
  write(
    `${consumer}/Cargo.toml`,
    `[package]\nname = "proto-ui-cost-${name.replaceAll('_', '-')}"\nversion = "0.1.0"\nedition = "2021"\npublish = false\n[lib]\nname = "${libraryName}"\ncrate-type = ["rlib", "cdylib"]\n[features]\ndefault = []\ntest-support = ["gpui/test-support", "proto-ui-gpui-native/test-support", ${dependencies.map((dependency) => `"${dependency}/test-support"`).join(', ')}]\n[dependencies]\ngpui = { git = "https://github.com/zed-industries/zed", rev = "${revision}" }\nserde_json = "1.0"\nproto-ui-gpui-native = { path = "../../modules/empty/.proto-ui/gpui-native" }\n${dependencies.map((dependency) => `${dependency} = { package = "${generated[dependency]}", path = "../../modules/${dependency}" }`).join('\n')}\n[[test]]\nname = "measure"\npath = "tests/measure.rs"\nrequired-features = ["test-support"]\n`
  );
  receipt.cases.push({
    name,
    libraryName,
    owners: all.length,
    generatedModules: dependencies,
    ordinaryNativeChild: name === 'composed',
    consumer,
    source: sha(lib),
    measurement: sha(consumerMeasurement),
    measurementTemplateSha256: sha(measurement),
    nativeCostIterations: 31,
  });
}
write(
  'Cargo.toml',
  `[workspace]\nresolver = "2"\nmembers = ["consumers/empty", "consumers/base_button", "consumers/composed", "modules/empty", "modules/base_button", "modules/empty/.proto-ui/gpui-native"]\n[profile.release]\nopt-level = 3\nlto = "thin"\ncodegen-units = 1\ndebug = false\nstrip = "debuginfo"\n`
);
const visit = (relative = '') => {
  for (const entry of readdirSync(path.join(output, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) visit(file);
    else {
      const data = readFileSync(path.join(output, file));
      receipt.files.push({ path: file, bytes: data.length, sha256: sha(data) });
    }
  }
};
visit();
for (const name of [
  'cost-empty.proto.ts',
  'cost-consumer.rs',
  'produce-cost.mjs',
  'run-cost.py',
  'cost-Cargo.lock',
]) {
  const data = readFileSync(path.join(fixture, name));
  receipt.compilerInputs.push({
    path: path.relative(repository, path.join(fixture, name)),
    bytes: data.length,
    sha256: sha(data),
  });
}
write('source-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
write('Cargo.lock', readFileSync(path.join(fixture, 'cost-Cargo.lock')));
write('run-cost.py', readFileSync(path.join(fixture, 'run-cost.py')));
for (const [input, destination] of [
  ['scripts/gpui/check-cargo-graph.mjs', 'tools/check-cargo-graph.mjs'],
  ['scripts/gpui/lib/cargo-graph.mjs', 'tools/lib/cargo-graph.mjs'],
]) {
  write(destination, readFileSync(path.join(repository, input)));
}
const imported = {};
const retain = (relative = '') => {
  for (const entry of readdirSync(path.join(output, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) retain(file);
    else imported[file] = sha(readFileSync(path.join(output, file)));
  }
};
retain();
write('import-manifest.json', JSON.stringify(imported, null, 2) + '\n');
console.log(
  JSON.stringify({
    kind: receipt.kind,
    modules: receipt.modules.map(({ name, componentBytes, componentSha256 }) => ({
      name,
      componentBytes,
      componentSha256,
    })),
    cases: receipt.cases,
    sourceFiles: receipt.compilerInputs.length,
  })
);
