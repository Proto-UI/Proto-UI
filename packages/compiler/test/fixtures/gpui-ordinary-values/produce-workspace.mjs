import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compilePrototype, writeCompilation } from '../../../src/compile.ts';

const directory = process.argv[2];
const revision = process.argv[3];
if (!path.isAbsolute(directory ?? '') || !/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('Provide a fresh absolute Cargo workspace and a full GPUI revision.');
}

const source = `import { definePrototype } from '@proto.ui/core';
export default definePrototype({ name: 'native-child', setup() { return r => r.slot(); } });`;
const compiled = compilePrototype(source, {
  fileName: 'native-child.proto.ts',
  profile: 'gpui-source-v1',
  gpuiDependency: 'workspace',
});
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

await mkdir(directory);
const output = await writeCompilation(compiled.value, path.join(directory, 'component'));
if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
const manifest = compiled.value.output.supportingFiles.find(({ path }) => path === 'Cargo.toml');
const packageName = /^\s*name = "([^"]+)"/m.exec(manifest.contents)[1];
await writeFile(path.join(directory, 'Cargo.toml'), `[package]
name = "workspace-gpui-consumer"
version = "0.1.0"
edition = "2021"
publish = false

[workspace]
resolver = "2"
members = ["component"]

[workspace.dependencies]
gpui = { git = "https://github.com/zed-industries/zed", rev = "${revision}" }

[dependencies]
gpui.workspace = true
component = { package = "${packageName}", path = "component" }
serde_json = "1.0"
`, { flag: 'wx' });
await mkdir(path.join(directory, 'src'));
await writeFile(path.join(directory, 'src/lib.rs'), `
pub fn mount(window: &mut gpui::Window, cx: &mut gpui::App) -> gpui::Entity<component::CompiledComponent> {
    component::CompiledComponent::create(serde_json::json!({}), None, window, cx)
        .unwrap_or_else(|_| panic!("plain prototype failed to construct"))
}
`, { flag: 'wx' });
