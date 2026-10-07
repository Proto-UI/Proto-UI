import { gpuiNativeOwnerSource } from './gpui-native-owner';
import { gpuiNativeA11ySource } from './gpui-native-a11y';
import { gpuiNativeHostSource } from './gpui-native-host';
import { gpuiNativeKeySource } from './gpui-native-key';
import { buildGpuiNativeStyleFiles } from './gpui-native-style';
import type { GeneratedModule } from './ir';

export const GPUI_NATIVE_SDK_PATH = '.proto-ui/gpui-native';
export const GPUI_NATIVE_SDK_VERSION = '0.1.0';

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

let cached: NonNullable<GeneratedModule['supportingFiles']> | undefined;

/** One ordinary native-source crate; all composed prototypes share its owner types and registries. */
export function gpuiNativeSdkFiles(): NonNullable<GeneratedModule['supportingFiles']> {
  if (cached) return cached;
  const style = buildGpuiNativeStyleFiles([]);
  const source = (path: string, contents: string) => ({
    path: `${GPUI_NATIVE_SDK_PATH}/${path}`,
    kind: 'source' as const,
    contents,
  });
  cached = [
    source(
      'LICENSE',
      'MIT License\n\nCopyright (c) 2026 Proto UI Contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n'
    ),
    source(
      'Cargo.toml',
      `[package]\nname = "proto-ui-gpui-native"\nversion = "${GPUI_NATIVE_SDK_VERSION}"\nedition = "2021"\nlicense = "MIT"\npublish = false\n\n[dependencies]\ngpui = { git = "https://github.com/zed-industries/zed", rev = "62e5991dd0f0c8a3af8d5e7e9c4652490d468db8" }\nserde = { version = "1.0", features = ["derive"] }\nserde_json = "1.0"\nunicode-segmentation = "=1.13.3"\ndata-url = "=0.3.2"\nimage = { version = "=0.25.10", default-features = false }\n`
    ),
    source(
      'src/lib.rs',
      `#[path = "gpui-native-owner.rs"] pub mod gpui_native_owner;\n#[path = "gpui-native-a11y.rs"] pub mod gpui_native_a11y;\n#[path = "gpui-native-host.rs"] pub mod gpui_native_host;\n#[path = "gpui-native-key.rs"] pub mod gpui_native_key;\n#[path = "style/mod.rs"] pub mod gpui_native_style;\n#[path = "style/mapping.rs"] pub mod gpui_native_style_mapping;\n`
    ),
    source('src/gpui-native-owner.rs', gpuiNativeOwnerSource),
    source('src/gpui-native-a11y.rs', gpuiNativeA11ySource),
    source('src/gpui-native-host.rs', gpuiNativeHostSource),
    source('src/gpui-native-key.rs', gpuiNativeKeySource),
    ...style.files.map((file) =>
      source(
        `src/${file.path.slice('.proto-ui/'.length)}`,
        file.contents + (file.path === '.proto-ui/style/mod.rs' ? styleVocabularyConstructor : '')
      )
    ),
  ];
  return cached;
}
