import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NumberFieldFormat } from '../../prototypes/base/src/number-field/format';
import type { NumberFieldFormatOptions } from '../../prototypes/base/src/number-field/types';
import { mountNativeOwner } from './native-owner-consumer';

/** Compile the real official helper closure once for the existing format oracles. */
export async function mountNumberFieldFormatter() {
  const files = Object.fromEntries(
    await Promise.all(
      ['format.ts', 'types.ts'].map(async (file) => [
        file,
        await readFile(
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../prototypes/base/src/number-field',
            file
          ),
          'utf8'
        ),
      ])
    )
  );
  const owner = await mountNativeOwner(
    `import {definePrototype} from '@proto.ui/core';
    import {createNumberFieldFormat} from './format';
    import type {NumberFieldFormatOptions} from './types';
    export default definePrototype({name:'official-number-format-consumer',setup(def){
      def.expose.method('sample',(locale:string,text:string,value:number|null,options?:NumberFieldFormatOptions & {notation?:string})=>{
        const formatter=createNumberFieldFormat(locale,options);
        return {invalid:formatter.invalid,formatted:formatter.format(value),parsed:formatter.parse(text)};
      });
      return render=>render.slot();
    }});`,
    'react-dom-source-v1',
    { compile: { fileName: 'format-consumer.proto.ts', files } }
  );
  const sample = owner.handle.getExposes().sample as (
    locale: string,
    text: string,
    value: number | null,
    options?: NumberFieldFormatOptions
  ) => { invalid: boolean; formatted: string; parsed: ReturnType<NumberFieldFormat['parse']> };
  return {
    owner,
    create(locale?: string, options?: NumberFieldFormatOptions): NumberFieldFormat {
      return {
        invalid: sample(locale ?? '', '', null, options).invalid,
        format: (value) => sample(locale ?? '', '', value, options).formatted,
        parse: (text) => sample(locale ?? '', text, null, options).parsed,
      };
    },
  };
}
