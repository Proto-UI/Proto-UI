declare module 'virtual:proto-ui/runtime-retry-urls' {
  const urls: Readonly<
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
  export default urls;
}
