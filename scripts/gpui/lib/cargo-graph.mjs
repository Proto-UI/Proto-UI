// Cargo, rather than a partial TOML parser, determines package identity and
// dependency reachability. Callers must obtain this input with the complete
// `cargo metadata --locked --all-features` command, without --no-deps or a
// platform filter. This verifies a resolved graph, not a native build.
export function inspectGpuiCargoGraph(metadata, { git, revision, requireSdk = true }) {
  if (typeof git !== 'string' || !git || !/^[a-f0-9]{40}$/.test(revision ?? '')) {
    throw new Error('Expected a GPUI Git source URL and full lowercase revision.');
  }
  // Preserve the source URL, not just its revision: forks may share a commit.
  const expectedSource = `git+${git}?rev=${revision}#${revision}`;
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
  const sdk = find('proto-ui-gpui-native');
  const errors = [];
  if (gpui.length !== 1) {
    errors.push(
      `Expected exactly one resolved GPUI package; found ${gpui.length}: ${gpui.map((pkg) => pkg.id).join(', ')}`
    );
  } else if (gpui[0].source !== expectedSource) {
    errors.push(
      `GPUI source mismatch: expected ${expectedSource}; resolved ${gpui[0].source ?? 'a local path'}.`
    );
  }
  if (requireSdk && sdk.length !== 1) {
    errors.push(
      `Expected exactly one shared Proto UI GPUI SDK package; found ${sdk.length}: ${sdk.map((pkg) => pkg.id).join(', ')}`
    );
  }
  return {
    ok: errors.length === 0,
    errors,
    expectedSource,
    workspaceMembers: [...metadata.workspace_members],
    resolvedPackages: reachable.size,
    gpui: gpui.map(({ id, name, version, source }) => ({ id, name, version, source })),
    sdk: sdk.map(({ id, name, version, source }) => ({ id, name, version, source })),
  };
}
