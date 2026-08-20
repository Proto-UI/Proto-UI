import { addComponentToConfig, loadCliConfig, saveCliConfig } from '../config/project-config.js';
import { getAdapter, normalizeHost } from '../registry/adapters.js';
import { getComponentEntry } from '../registry/components.js';
import { writeGeneratedIndexes } from '../services/codegen.js';
import { promptForComponent, promptForHost } from '../services/interactive.js';
import {
  detectPackageManager,
  formatInstallCommand,
  hasPackage,
  installPackages,
  readProjectPackageJson,
  toExactProtoUiInstallSpec,
} from '../services/package-manager.js';
import { ensureRuntimePackages } from '../services/runtime-check.js';
import { isInteractiveDisabled, parseArgv } from '../utils/args.js';
import { relativeToCwd } from '../utils/fs.js';

export async function runAddCommand(argv: string[]): Promise<void> {
  const { options, positionals } = parseArgv(argv);
  const cwd = process.cwd();
  const interactive =
    !isInteractiveDisabled(options) && process.stdin.isTTY && process.stdout.isTTY;
  const rootDir = options['root-dir'] as string | undefined;

  let hostInput: string | undefined = positionals[0];
  let componentInput: string | undefined = positionals[1];
  if (!hostInput && interactive) hostInput = (await promptForHost()) ?? undefined;
  if (!componentInput && interactive) componentInput = (await promptForComponent()) ?? undefined;

  const host = normalizeHost(hostInput);
  if (!host) {
    throw new Error(
      hostInput
        ? `unsupported host "${hostInput}". supported: react, vue, wc`
        : 'missing host argument'
    );
  }

  const componentEntry = getComponentEntry(componentInput);
  if (!componentEntry) {
    throw new Error(
      componentInput ? `unsupported component "${componentInput}".` : 'missing component argument'
    );
  }

  const adapter = getAdapter(host);
  if (!adapter) {
    // unreachable: normalizeHost only returns ids drawn from ADAPTER_REGISTRY,
    // so getAdapter on its result must succeed. defensive guard for TS strict.
    throw new Error(`unsupported host "${host}"`);
  }
  const { config, paths } = await loadCliConfig(cwd, rootDir);
  if (!config) {
    throw new Error(
      `missing Proto UI config at ${relativeToCwd(paths.configPath, cwd)}. Run "proto-ui init" first.`
    );
  }
  assertStylePresetCompatible(config, componentEntry.id, componentEntry.stylePreset);

  const projectPkg = await readProjectPackageJson(cwd);
  if (!projectPkg) {
    throw new Error(
      'missing package.json in current project root. "proto-ui add" must run inside a project.'
    );
  }

  const packageManager = await detectPackageManager(cwd);
  ensureRuntimePackages({ adapter, projectPkg, packageManager });

  const noInstall = options.install === false || options['no-install'] === true;
  const requiredPackages = [adapter.packageName, componentEntry.packageName].filter(
    (pkg, index, list) => list.indexOf(pkg) === index
  );
  const missingPackages = requiredPackages.filter((pkg) => !hasPackage(projectPkg, pkg));
  const missingInstallSpecs = missingPackages.map((pkg) => toExactProtoUiInstallSpec(pkg));

  if (!noInstall && missingPackages.length > 0) {
    installPackages(packageManager, cwd, missingInstallSpecs, { exact: true });
    console.log(
      `[proto-ui] add: installed ${missingInstallSpecs.join(', ')} via ${packageManager}`
    );
  } else if (noInstall && missingPackages.length > 0) {
    console.log('[proto-ui] add: required Proto UI packages are not installed yet:');
    for (const spec of missingInstallSpecs) {
      console.log(`  ${formatInstallCommand(packageManager, [spec], { exact: true })}`);
    }
  }

  const nextConfig = addComponentToConfig(config, host, componentEntry.id, adapter.packageName);
  await saveCliConfig(cwd, nextConfig);
  await writeGeneratedIndexes(paths, nextConfig);

  console.log(
    `[proto-ui] add: generated ${relativeToCwd(paths.componentsDir, cwd)} for ${host}/${componentEntry.id}`
  );
  if (componentEntry.stylePreset && nextConfig.styles?.enabled === false) {
    console.log(
      `[proto-ui] add: styles are disabled; provide the complete ${componentEntry.stylePreset} --pui-* token set for ${componentEntry.id}`
    );
  }
}

function assertStylePresetCompatible(
  config: { styles?: { enabled?: boolean; preset?: string | null } },
  componentId: string,
  requiredPreset: string | null
): void {
  if (!requiredPreset) return;
  if (config.styles?.enabled === false) return;

  const configuredPreset = config.styles?.preset ?? null;
  if (configuredPreset !== requiredPreset) {
    throw new Error(
      `${componentId} requires the ${requiredPreset} style preset, but proto-ui/config.json enables ${configuredPreset ?? 'no preset'}. Proto UI config v1 supports one project-wide preset; migrate explicitly with "proto-ui init --prototypes ${requiredPreset}" or choose a component compatible with ${configuredPreset ?? 'the configured styling mode'}.`
    );
  }
}
