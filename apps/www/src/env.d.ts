/// <reference types="astro/client" />
/// <reference types="astro/astro-jsx" />
/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements extends astroHTML.JSX.IntrinsicElements {}
}

declare module '*.astro' {
  const AstroComponent: any;
  export default AstroComponent;
}

declare module 'shiki' {
  export function codeToHtml(
    code: string,
    options?: {
      lang?: string;
      theme?: string;
      themes?: Record<string, string>;
    }
  ): Promise<string>;
}

declare module 'virtual:starlight/user-config' {
  const config: {
    locales?: Record<string, unknown>;
  };
  export default config;
}

declare module 'virtual:starlight/pagefind-config' {
  export const pagefindUserConfig: Record<string, unknown>;
}

declare module 'hast' {
  export type Properties = Record<string, unknown>;

  export type Text = {
    type: 'text';
    value: string;
  };

  export type Comment = {
    type: 'comment';
    value: string;
  };

  export type Element = {
    type: 'element';
    tagName: string;
    properties: Properties;
    children: ElementContent[];
  };

  export type ElementContent = Element | Text | Comment;

  export type Root = {
    type: 'root';
    children: ElementContent[];
  };
}
