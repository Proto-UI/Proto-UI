export * from './types';
export { SsaBuilder } from './builder';
export { verifyModuleIR, verifySsaFunction } from './verify';
export {
  optimizeModuleIR,
  optimizeSsaFunction,
  computePrototypeCapabilities,
  type SsaPassStats,
} from './passes';
export { printModuleIR, printPrototypeIR, printSsaFunction } from './print';
