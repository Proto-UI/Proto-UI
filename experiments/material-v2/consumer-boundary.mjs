/** The optical artifact is a direct four-Adapter consumer, not a website build. */
export function assertConsumerBoundary(metafile, { packed = false } = {}) {
  const inputs = Object.keys(metafile.inputs).map((path) => path.replaceAll('\\', '/'));
  const websiteRuntime = inputs.filter((path) =>
    /\/PrototypePreviewer\/(?:demo-renderer\.|registry\.|runtimes\/)/.test(path)
  );
  if (websiteRuntime.length)
    throw new Error(`Artifact pulled website runtime graph: ${websiteRuntime.join(', ')}`);
  const external = Object.values(metafile.outputs)
    .flatMap((output) => output.imports ?? [])
    .filter((entry) => entry.external);
  if (external.length)
    throw new Error(
      `Artifact left unresolved external imports: ${external.map((entry) => entry.path).join(', ')}`
    );
  const packageInputs = inputs.filter(
    (file) => /(^|\/)packages\//.test(file) && !file.includes('/node_modules/')
  );
  const publicSourceInputs = packageInputs.filter(
    (file) => file.includes('/src/') && !/(^|\/)packages\/prototypes\/liquid-glass\//.test(file)
  );
  if (packed && publicSourceInputs.length)
    throw new Error(`Public package consumer reached source: ${publicSourceInputs.join(', ')}`);
  return { packageInputs, publicSourceInputs };
}
