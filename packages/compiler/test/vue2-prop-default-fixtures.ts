export interface ResolvedNullInput {
  readonly name: string;
  readonly setup: string;
  readonly validRaw: number;
  readonly imports?: string;
  readonly files?: Readonly<Record<string, string>>;
}

/** A skipped declaration leaves no resolved key; it does not resolve to null. */
export const skippedPropSetup =
  "if(false){def.props.define({count:{type:'number',default:5}});}return r=>r.el('output',r.read.props.get().count ?? 'missing');";

/** Actual admitted inputs shared by complete strict programs and native consumers. */
export const resolvedNullInputs: readonly ResolvedNullInput[] = [
  {
    name: 'a default below its own minimum',
    setup: "def.props.define({count:{type:'number',default:5,range:{min:10}}});",
    validRaw: 20,
  },
  {
    name: 'a default above its own maximum',
    setup: "def.props.define({count:{type:'number',default:5,range:{max:3}}});",
    validRaw: 2,
  },
  {
    name: 'a later conditional range refinement',
    setup:
      "def.props.define({count:{type:'number',default:5}});if(true){def.props.define({count:{type:'number',range:{min:10}}});}",
    validRaw: 20,
  },
  {
    name: 'a later hook range refinement',
    setup: "def.props.define({count:{type:'number',default:5}});asRangeRefinement();",
    validRaw: 20,
    imports: "import {asRangeRefinement} from './range-refinement';",
    files: {
      'range-refinement.ts':
        "import {defineAsHook} from '@proto.ui/core';export const asRangeRefinement=defineAsHook({name:'range-refinement',setup(def){def.props.define({count:{type:'number',range:{min:10}}});}});",
    },
  },
];

export function nativeOwnerInput(setup: string, imports = ''): string {
  return `import {definePrototype} from '@proto.ui/core';
    import {asFocusable} from '@proto.ui/hooks';${imports}
    export default definePrototype({name:'ordinary-native-owner',setup(def){${setup}}});`;
}
