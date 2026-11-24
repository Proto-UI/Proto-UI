import { gpuiNativeOwnerSource } from './gpui-native-owner';
import { gpuiNativeA11ySource } from './gpui-native-a11y';
import { gpuiNativeHostSource } from './gpui-native-host';
import { gpuiNativeKeySource } from './gpui-native-key';
import { gpuiNativeMoveSource } from './gpui-native-move';
import { buildGpuiNativeStyleFiles } from './gpui-native-style';
import { createHash } from 'node:crypto';
import type { GeneratedModule } from './ir';
import { GPUI_PROFILE_CARGO_DEPENDENCY } from './gpui-dependency';

export const GPUI_NATIVE_SDK_PATH = '.proto-ui/gpui-native';
export const GPUI_NATIVE_SDK_VERSION = '0.2.0';
export function gpuiCargoDependency(useWorkspace: boolean): string {
  return useWorkspace ? 'workspace = true' : GPUI_PROFILE_CARGO_DEPENDENCY;
}

/** Content compatibility is stricter than Cargo's package version equality. */
export interface GpuiNativeSdkIdentity {
  schemaVersion: 1;
  name: 'proto-ui-gpui-native';
  version: string;
  dependencyMode: 'profile' | 'workspace';
  contentSha256: string;
}

export function gpuiNativeSdkInventory(useWorkspace = false) {
  const prefix = `${GPUI_NATIVE_SDK_PATH}/`;
  return gpuiNativeSdkFiles(useWorkspace)
    .map((file) => ({
      path: file.path.slice(prefix.length),
      kind: file.kind,
      sha256: createHash('sha256').update(file.contents).digest('hex'),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function gpuiNativeSdkIdentity(useWorkspace = false): GpuiNativeSdkIdentity {
  return {
    schemaVersion: 1,
    name: 'proto-ui-gpui-native',
    version: GPUI_NATIVE_SDK_VERSION,
    dependencyMode: useWorkspace ? 'workspace' : 'profile',
    contentSha256: createHash('sha256')
      .update(JSON.stringify(gpuiNativeSdkInventory(useWorkspace)))
      .digest('hex'),
  };
}

const styleVocabularyConstructor = String.raw`
impl StyleVocabulary {
    pub fn from_json(source: &str) -> Result<Self, serde_json::Error> {
        let fixture: Fixture = serde_json::from_str(source)?;
        Ok(Self {
            tokens: fixture.tokens,
            markers: fixture.no_declarations.into_iter().map(|token| (token, ())).collect(),
            order: fixture.order.into_iter().enumerate().map(|(index, token)| (token, index)).collect(),
        })
    }
}
`;

const cached = new Map<boolean, NonNullable<GeneratedModule['supportingFiles']>>();

/** One ordinary native-source crate; all composed prototypes share its owner types and registries. */
export function gpuiNativeSdkFiles(
  useWorkspace = false
): NonNullable<GeneratedModule['supportingFiles']> {
  const existing = cached.get(useWorkspace);
  if (existing) return existing;
  const style = buildGpuiNativeStyleFiles([]);
  const defaultFeatures = useWorkspace ? 'default = ["gpui-modern-element-api"]\n' : '';
  const source = (path: string, contents: string) => ({
    path: `${GPUI_NATIVE_SDK_PATH}/${path}`,
    kind: 'source' as const,
    contents,
  });
  const files = [
    source(
      'LICENSE',
      'MIT License\n\nCopyright (c) 2026 Proto UI Contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n'
    ),
    source(
      'Cargo.toml',
      `[package]\nname = "proto-ui-gpui-native"\nversion = "${GPUI_NATIVE_SDK_VERSION}"\nedition = "2021"\nlicense = "MIT"\npublish = false\n\n[features]\n${defaultFeatures}# Host ABI selection for GPUI's blanket IntoElement impl and cached path IDs.\ngpui-modern-element-api = []\n# Requires Window::notify_text_selection_changed; absent from the pinned profile.\ngpui-text-selection-notification = []\n# Requires an explicit local upstream focus-tree patch; not an advertised profile capability.\nexperimental-focus-tree = []\n# Native consumer evidence only; no product introspection surface by default.\ntest-support = ["gpui/test-support"]\n\n[dependencies]\ngpui = { ${gpuiCargoDependency(useWorkspace)} }\nserde = { version = "1.0", features = ["derive"] }\nserde_json = "1.0"\nunicode-segmentation = "=1.13.3"\ndata-url = "=0.3.2"\nimage = { version = "=0.25.10", default-features = false }\n\n[dev-dependencies]\naccesskit_consumer = "=0.38.0"\n`
    ),
    source(
      'src/lib.rs',
      `#[path = "gpui-native-owner.rs"] pub mod gpui_native_owner;\n#[path = "gpui-native-a11y.rs"] pub mod gpui_native_a11y;\n#[path = "gpui-native-host.rs"] pub mod gpui_native_host;\n#[path = "gpui-native-key.rs"] pub mod gpui_native_key;\n#[path = "gpui-native-move.rs"] pub mod gpui_native_move;\n#[path = "style/mod.rs"] pub mod gpui_native_style;\n#[path = "style/mapping.rs"] pub mod gpui_native_style_mapping;\n`
    ),
    source('src/gpui-native-owner.rs', gpuiNativeOwnerSource),
    source('src/gpui-native-a11y.rs', gpuiNativeA11ySource),
    source('src/gpui-native-host.rs', gpuiNativeHostSource),
    source('src/gpui-native-key.rs', gpuiNativeKeySource),
    source('src/gpui-native-move.rs', gpuiNativeMoveSource),
    ...style.files.map((file) =>
      source(
        `src/${file.path.slice('.proto-ui/'.length)}`,
        file.contents + (file.path === '.proto-ui/style/mod.rs' ? styleVocabularyConstructor : '')
      )
    ),
  ];
  cached.set(useWorkspace, files);
  return files;
}
