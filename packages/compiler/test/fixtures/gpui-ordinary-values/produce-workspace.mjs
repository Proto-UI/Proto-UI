import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compilePrototype, writeCompilation } from '../../../src/compile.ts';

const directory = process.argv[2];
const revision = process.argv[3];
if (!path.isAbsolute(directory ?? '') || !/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('Provide a fresh absolute Cargo workspace and a full GPUI revision.');
}

await mkdir(directory);
const packages = [];
for (const name of ['component', 'sibling']) {
  const source = `import { definePrototype } from '@proto.ui/core';
export default definePrototype({ name: '${name}', setup() { return r => r.slot(); } });`;
  const compiled = compilePrototype(source, {
    fileName: `${name}.proto.ts`,
    profile: 'gpui-source-v1',
    gpuiDependency: 'workspace',
    ...(name === 'sibling' ? { nativeSdkPath: '../component/.proto-ui/gpui-native' } : {}),
  });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const output = await writeCompilation(compiled.value, path.join(directory, name));
  if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
  const manifest = compiled.value.output.supportingFiles.find(({ path }) => path === 'Cargo.toml');
  const packageName = /^\s*name = "([^"]+)"/m.exec(manifest.contents)[1];
  packages.push(`${name} = { package = "${packageName}", path = "${name}" }`);
}
await writeFile(
  path.join(directory, 'Cargo.toml'),
  `[package]
name = "workspace-gpui-consumer"
version = "0.1.0"
edition = "2021"
publish = false

[workspace]
resolver = "2"
members = ["component", "sibling"]

[workspace.dependencies]
gpui = { git = "https://github.com/zed-industries/zed", rev = "${revision}" }

[dependencies]
gpui.workspace = true
${packages.join('\n')}
serde_json = "1.0"
`,
  { flag: 'wx' }
);
await mkdir(path.join(directory, 'src'));
await writeFile(
  path.join(directory, 'src/lib.rs'),
  `
pub fn mount(window: &mut gpui::Window, cx: &mut gpui::App) -> gpui::Entity<component::CompiledComponent> {
    component::CompiledComponent::create(serde_json::json!({}), None, window, cx)
        .unwrap_or_else(|_| panic!("plain prototype failed to construct"))
}

pub fn mount_sibling(parent: &gpui::Entity<component::CompiledComponent>, window: &mut gpui::Window, cx: &mut gpui::App) -> gpui::Entity<sibling::CompiledComponent> {
    // This ordinary cross-crate type checks both GPUI and native SDK identity.
    let owner = std::rc::Rc::downgrade(&parent.read(cx).owner);
    sibling::CompiledComponent::create(serde_json::json!({}), Some(owner), window, cx)
        .unwrap_or_else(|_| panic!("sibling prototype failed to construct"))
}
`,
  { flag: 'wx' }
);
