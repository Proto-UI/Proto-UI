export function unwrapGeneratedTokenLayer(css: string): string;
export function loadConsumerStyles(
  document: Document,
  options?: {
    root?: string;
    stylesDir?: string;
    evidenceName?: string;
  }
): {
  styles: HTMLStyleElement[];
  files: { name: string; bytes: number; sha256: string }[];
  evidenceDir: string;
};
export function assertPositionedSwitch(element: Element | null, label: string): void;
