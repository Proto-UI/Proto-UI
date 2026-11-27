/// <reference no-default-lib="true" />

// Primitive shapes required by the TypeScript checker, not an ECMAScript or
// host API promise. In particular, no Node/DOM globals, String code-unit APIs,
// mutable Array methods, or capability-producing casts are declared here.
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface Boolean {}
interface Number {}
interface String {}
interface RegExp {}
interface IArguments {
  readonly length: number;
  readonly [index: number]: unknown;
}
interface Array<T> {
  readonly length: number;
  readonly [index: number]: T;
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [index: number]: T;
}

// Binary64 includes these values. They do not make numeric truthiness legal.
declare const NaN: number;
declare const Infinity: number;
