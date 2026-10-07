import type { Plugin } from 'vite';
export declare function runtimeRetryUrlsPlugin(appRoot?: string): Plugin;
export declare const runtimeRetryModules: Readonly<
  Record<
    | 'reactRuntime'
    | 'vueRuntime'
    | 'vue2Runtime'
    | 'reactAdapter'
    | 'vueAdapter'
    | 'vue2Adapter'
    | 'react'
    | 'reactDom'
    | 'reactDomClient'
    | 'vue'
    | 'vue2',
    string
  >
>;
