import { createHash } from 'node:crypto';
import { GPUI_NATIVE_SDK_VERSION, gpuiCargoDependency } from './gpui-native-sdk';

/** One canonical Cargo projection binds SDK obligations to the actual published manifest. */
export function gpuiComponentCargoManifest(
  code: string,
  styleFixture: string,
  staticArtifacts: readonly { path: string; contents: string }[],
  nativeSdkPath: string,
  useWorkspace: boolean
): string {
  const packageDigest = createHash('sha256').update(code).update('\0').update(styleFixture);
  for (const artifact of staticArtifacts)
    packageDigest.update('\0').update(artifact.path).update('\0').update(artifact.contents);
  const dependency = gpuiCargoDependency(useWorkspace);
  return `[package]
  name = "generated-gpui-${packageDigest.digest('hex').slice(0, 32)}"
  version = "0.1.0"
  edition = "2021"

  [features]
  # An explicit local SDK experiment, never enabled by the default published profile.
  experimental-focus-tree = ["proto-ui-gpui-native/experimental-focus-tree"]
  test-support = ["proto-ui-gpui-native/test-support"]

  [lib]
  name = "generated_gpui_component"
  path = "Component.rs"

  [dependencies]
  proto-ui-gpui-native = { version = "=${GPUI_NATIVE_SDK_VERSION}", path = ${JSON.stringify(nativeSdkPath)}${useWorkspace ? ', features = ["gpui-modern-element-api"]' : ''} }
  gpui = { ${dependency} }
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"

  [dev-dependencies]
  gpui = { ${dependency}${useWorkspace ? '' : ', features = ["test-support"]'} }
  `;
}
