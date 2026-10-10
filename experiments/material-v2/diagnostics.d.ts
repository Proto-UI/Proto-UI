declare module 'material-v2-diagnostics' {
  export function inspectWebOpticalResources(document: Document): Record<string, unknown>;
}

declare module 'material-v2-contact-diagnostics' {
  export function observeWebPointerContact(
    host: HTMLElement,
    callback: (value: unknown) => void
  ): { current(): unknown; dispose(): void };
}

declare module 'material-v2-program-diagnostics' {
  export function createWebOpticalProgram(
    canvas: HTMLCanvasElement,
    control: string | null
  ): { render(frame: unknown): string; inspect(): unknown; dispose(): void };
}
