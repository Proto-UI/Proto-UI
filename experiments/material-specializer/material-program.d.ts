declare module 'material-program' {
  const program: import('../../packages/adapters/web-component/src/material/owned-texture-sink').MaterialProgram & {
    prepareSource(pixels: Uint8Array, width: number, height: number): Uint8Array;
  };
  export default program;
}
declare module 'material-baseline-program' {
  const program: import('../../packages/adapters/web-component/src/material/owned-texture-sink').MaterialProgram;
  export default program;
}
