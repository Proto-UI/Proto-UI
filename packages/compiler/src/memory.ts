import { parsePrototype } from './parser';
import { emitReact } from './react';
import { emitReactSource } from './react-source';
import { emitVueSource } from './vue-source';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { emitGpuiSource } from './gpui-source';
import { emitQtSource } from './qt-source';
import { emitFlutterSource } from './flutter-source';
import { resolveTargetProfile, checkTargetOperations, type TargetSelection } from './targets';
import { attachEmitterMap } from './emitter-map';
import type { CompileResult, GeneratedModule, ParseOptions, PrototypeIR } from './ir';

export interface Compilation {
  ir: PrototypeIR;
  output: GeneratedModule;
}
export interface CompileOptions extends ParseOptions {
  componentName?: string;
  profile?: string | TargetSelection;
  /** GPUI source dependency shared by composed prototypes; omission bundles the editable SDK. */
  nativeSdkPath?: string;
}

/** Compile an explicit source graph without loading files or executing author input. */
export function compilePrototype(
  source: string,
  options: CompileOptions = {}
): CompileResult<Compilation> {
  const parsed = parsePrototype(source, options);
  if (!parsed.ok) return parsed;
  const profile = resolveTargetProfile(options.profile ?? 'react-runtime-v1');
  if (!profile.ok) return profile;
  const admitted = checkTargetOperations(parsed.value, profile.value);
  if (!admitted.ok) return admitted;
  let emitted: CompileResult<GeneratedModule>;
  const emitOptions = { componentName: options.componentName };
  switch (profile.value.id) {
    case 'react-runtime-v1':
      emitted = emitReact(parsed.value, emitOptions);
      break;
    case 'react-dom-source-v1':
      emitted = emitReactSource(parsed.value, emitOptions);
      break;
    case 'vue-source-v1':
      emitted = emitVueSource(parsed.value, emitOptions);
      break;
    case 'vue2-source-v1':
      emitted = emitVue2Source(parsed.value, emitOptions);
      break;
    case 'web-component-source-v1':
      emitted = emitWebComponentSource(parsed.value, { className: options.componentName });
      break;
    case 'gpui-source-v1':
      emitted = emitGpuiSource(parsed.value, {
        componentName: options.componentName,
        nativeSdkPath: options.nativeSdkPath,
      });
      break;
    case 'qt-source-v1':
      emitted = emitQtSource(parsed.value, { componentName: options.componentName });
      break;
    case 'flutter-source-v1':
      emitted = emitFlutterSource(parsed.value, { componentName: options.componentName });
      break;
    case 'react-dom-ssr-v1':
      emitted = emitReactSource(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'vue-ssr-v1':
      emitted = emitVueSource(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'vue2-ssr-v1':
      emitted = emitVue2Source(parsed.value, { ...emitOptions, ssr: true });
      break;
    case 'web-component-ssr-v1':
      emitted = emitWebComponentSource(parsed.value, {
        className: options.componentName,
        ssr: true,
      });
      break;
    default:
      return {
        ok: false,
        diagnostics: [
          {
            code: 'PUI4001',
            category: 'unsupported-input',
            message: `No emitter is implemented for ${profile.value.id}.`,
            span: parsed.value.setup.span,
          },
        ],
      };
  }
  if (!emitted.ok) return emitted;
  try {
    return {
      ok: true,
      value: { ir: parsed.value, output: attachEmitterMap(emitted.value, parsed.value) },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3005',
          category: 'compiler-defect',
          message: `Emitter source mapping failed: ${error instanceof Error ? error.message : String(error)}`,
          span: parsed.value.setup.span,
        },
      ],
    };
  }
}
