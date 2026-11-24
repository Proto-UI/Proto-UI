const exactVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function checkedSource(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} requires a Git or registry source descriptor.`);
  }
  const fields =
    value.kind === 'git' ? ['kind', 'git', 'revision'] : ['kind', 'registry', 'version'];
  if (
    !['git', 'registry'].includes(value.kind) ||
    Object.keys(value).some((key) => !fields.includes(key))
  ) {
    throw new Error(`${label} must select exactly one Git or registry source.`);
  }
  const selectedLocation = value.kind === 'git' ? value.git : value.registry;
  const registryPrefix =
    value.kind === 'registry' && typeof selectedLocation === 'string'
      ? ['registry+', 'sparse+'].find((prefix) => selectedLocation.startsWith(prefix))
      : undefined;
  const location = registryPrefix
    ? selectedLocation.slice(registryPrefix.length)
    : selectedLocation;
  // Keep the caller's exact Cargo source spelling. Do not silently normalize a
  // fork, registry, URL query or floating selector into the expected identity.
  if (typeof location !== 'string' || !location || /[\s?#]/.test(location)) {
    throw new Error(`${label} requires an exact source URL without whitespace, query or fragment.`);
  }
  try {
    const url = new URL(location);
    const protocols =
      registryPrefix === 'sparse+'
        ? ['https:', 'http:']
        : ['https:', 'http:', 'ssh:', 'git:', 'file:'];
    if (!protocols.includes(url.protocol) || !location.includes('://')) throw new Error();
  } catch {
    throw new Error(`${label} requires an absolute source URL.`);
  }
  if (value.kind === 'git') {
    if (!/^[a-f0-9]{40}$/.test(value.revision ?? '')) {
      throw new Error(`${label} requires a full lowercase Git revision.`);
    }
    return { kind: 'git', git: value.git, revision: value.revision };
  }
  if (typeof value.version !== 'string' || !exactVersion.test(value.version)) {
    throw new Error(
      `${label} requires one exact complete registry version, not a range or wildcard.`
    );
  }
  return { kind: 'registry', registry: value.registry, version: value.version };
}

const sourceId = (source) =>
  source.kind === 'git'
    ? `git+${source.git}?rev=${source.revision}#${source.revision}`
    : /^(registry|sparse)\+/.test(source.registry)
      ? source.registry
      : `registry+${source.registry}`;

/** Validate all source selectors before Cargo runs, including legacy API calls. */
export function resolveGpuiCargoExpectations(options = {}) {
  const legacy = options.git !== undefined || options.revision !== undefined;
  if (options.source !== undefined && legacy) {
    throw new Error('Select source or legacy git/revision options, not both.');
  }
  const source = checkedSource(
    options.source ?? { kind: 'git', git: options.git, revision: options.revision },
    'GPUI'
  );
  const requireSdk = options.requireSdk ?? true;
  const requirePlatform = options.requirePlatform ?? options.platformSource !== undefined;
  if (typeof requireSdk !== 'boolean' || typeof requirePlatform !== 'boolean') {
    throw new Error('requireSdk and requirePlatform must be Boolean values.');
  }
  // A Git commit fixes every crate in that source. Registry crates can release
  // independently, so their platform version must always be supplied explicitly.
  const platform =
    options.platformSource === undefined
      ? source.kind === 'git'
        ? source
        : null
      : checkedSource(options.platformSource, 'GPUI platform');
  if (requirePlatform && !platform) {
    throw new Error('A required registry GPUI platform needs its own exact platformSource.');
  }
  return {
    expectedDependency: source,
    expectedSource: sourceId(source),
    expectedVersion: source.kind === 'registry' ? source.version : null,
    expectedPlatform: {
      required: requirePlatform,
      dependency: platform,
      source: platform ? sourceId(platform) : null,
      version: platform?.kind === 'registry' ? platform.version : null,
    },
    requireSdk,
  };
}

// Cargo, rather than a partial TOML parser, determines package identity and
// dependency reachability. Callers must obtain this input with the complete
// `cargo metadata --locked --all-features` command, without --no-deps or a
// platform filter. This verifies a resolved graph, not a native build.
export function inspectGpuiCargoGraph(metadata, options) {
  const expectations = resolveGpuiCargoExpectations(options);
  const { expectedSource, expectedVersion, expectedPlatform, requireSdk } = expectations;
  if (
    metadata?.version !== 1 ||
    !Array.isArray(metadata.packages) ||
    !Array.isArray(metadata.workspace_members) ||
    metadata.workspace_members.length === 0 ||
    !Array.isArray(metadata.resolve?.nodes)
  ) {
    throw new Error(
      'Complete Cargo metadata with a resolve graph is required; --no-deps is not evidence.'
    );
  }
  const packages = new Map();
  for (const pkg of metadata.packages) {
    if (typeof pkg?.id !== 'string' || typeof pkg.name !== 'string' || packages.has(pkg.id)) {
      throw new Error('Cargo metadata has an invalid or duplicate package ID.');
    }
    packages.set(pkg.id, pkg);
  }
  const nodes = new Map();
  for (const node of metadata.resolve.nodes) {
    if (
      typeof node?.id !== 'string' ||
      !Array.isArray(node.deps) ||
      nodes.has(node.id) ||
      !packages.has(node.id)
    ) {
      throw new Error('Cargo metadata has an incomplete or invalid resolve node.');
    }
    nodes.set(node.id, node);
  }
  const reachable = new Set();
  const pending = [...metadata.workspace_members];
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    const node = nodes.get(id);
    if (!node) throw new Error(`Cargo metadata is missing the resolved package ${id}.`);
    reachable.add(id);
    for (const dependency of node.deps) {
      if (typeof dependency?.pkg !== 'string' || !nodes.has(dependency.pkg)) {
        throw new Error(`Cargo metadata is missing a dependency of ${id}.`);
      }
      // Dependency aliases, build/dev kinds and target expressions do not alter
      // the actual package name or ID. All of these edges remain in this walk.
      pending.push(dependency.pkg);
    }
  }
  const find = (name) =>
    metadata.packages.filter((pkg) => reachable.has(pkg.id) && pkg.name === name);
  const gpui = find('gpui');
  const gpuiPlatform = find('gpui_platform');
  const sdk = find('proto-ui-gpui-native');
  const errors = [];
  if (gpui.length !== 1) {
    errors.push(
      `Expected exactly one resolved GPUI package; found ${gpui.length}: ${gpui.map((pkg) => pkg.id).join(', ')}`
    );
  } else {
    if (gpui[0].source !== expectedSource) {
      errors.push(
        `GPUI source mismatch: expected ${expectedSource}; resolved ${gpui[0].source ?? 'a local path'}.`
      );
    }
    if (expectedVersion !== null && gpui[0].version !== expectedVersion) {
      errors.push(
        `GPUI version mismatch: expected ${expectedVersion}; resolved ${gpui[0].version}.`
      );
    }
  }
  if (gpuiPlatform.length > 1 || (expectedPlatform.required && gpuiPlatform.length !== 1)) {
    errors.push(
      `Expected ${expectedPlatform.required ? 'exactly one' : 'at most one'} resolved GPUI platform package; found ${gpuiPlatform.length}: ${gpuiPlatform.map((pkg) => pkg.id).join(', ')}`
    );
  } else if (gpuiPlatform.length === 1) {
    if (expectedPlatform.source === null) {
      errors.push(
        'A resolved registry GPUI platform requires its own exact platformSource; its version is not inferred from GPUI.'
      );
    } else {
      if (gpuiPlatform[0].source !== expectedPlatform.source) {
        errors.push(
          `GPUI platform source mismatch: expected ${expectedPlatform.source}; resolved ${gpuiPlatform[0].source ?? 'a local path'}.`
        );
      }
      if (
        expectedPlatform.version !== null &&
        gpuiPlatform[0].version !== expectedPlatform.version
      ) {
        errors.push(
          `GPUI platform version mismatch: expected ${expectedPlatform.version}; resolved ${gpuiPlatform[0].version}.`
        );
      }
    }
  }
  if (requireSdk && sdk.length !== 1) {
    errors.push(
      `Expected exactly one shared Proto UI GPUI SDK package; found ${sdk.length}: ${sdk.map((pkg) => pkg.id).join(', ')}`
    );
  }
  return {
    ok: errors.length === 0,
    errors,
    ...expectations,
    workspaceMembers: [...metadata.workspace_members],
    resolvedPackages: reachable.size,
    gpui: gpui.map(({ id, name, version, source }) => ({ id, name, version, source })),
    gpuiPlatform: gpuiPlatform.map(({ id, name, version, source }) => ({
      id,
      name,
      version,
      source,
    })),
    sdk: sdk.map(({ id, name, version, source }) => ({ id, name, version, source })),
  };
}
