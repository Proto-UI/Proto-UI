export function unwrapGeneratedThemeSelectionLayer(css: string): string;
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
export function assertStyledSwitch(element: Element | null, label: string): void;
export function assertSwitchThumbState(
  element: Element | null,
  expectedChecked: boolean,
  label: string
): void;

export function assertDefaultButtonTokens(element: Element | null, label: string): void;
export function assertStyledButton(element: Element | null, label: string): void;
