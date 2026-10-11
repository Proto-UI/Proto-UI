export function assertConsumerBoundary(
  metafile: {
    inputs: Record<string, unknown>;
    outputs: Record<string, { imports?: readonly { path: string; external?: boolean }[] }>;
  },
  options?: { packed?: boolean }
): {
  packageInputs: string[];
  publicSourceInputs: string[];
};
