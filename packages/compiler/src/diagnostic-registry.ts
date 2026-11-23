import type { CompilerDiagnostic } from './ir';

/**
 * Stable diagnostic registry: the canonical code → category/meaning table for
 * every PUI diagnostic the compiler emits. Existing category variants are
 * explicit; one correct emission must not mask another unregistered category.
 * This table records the governed emission meanings; it does not redesign them.
 *
 * `PUI_*` literals that are generated-source placeholders rather than
 * diagnostics (e.g. `PUI_CONTEXT_KEY_` Rust bindings,
 * `__PUI_SSR_ARTIFACT_BINDING__` hydration markers, `PUI_WC_HYDRATION_MISMATCH`
 * runtime error-class codes inside generated WC support) are intentionally
 * absent and are tracked in the drift test's placeholder denylist, not here.
 */
export interface DiagnosticRegistration {
  /** Stable primary category retained by the existing single-category lookup. */
  readonly category: CompilerDiagnostic['category'];
  /** Existing meaning-specific variants in addition to the primary category. */
  readonly additionalCategories?: readonly CompilerDiagnostic['category'][];
  /** One-sentence meaning, bound to the real emission path. */
  readonly meaning: string;
}

export const DIAGNOSTIC_REGISTRY: Readonly<Record<string, DiagnosticRegistration>> = {
  // Parser/module semantic front end (1xxx) — source conformance failures.
  PUI1001: {
    category: 'unsupported-input',
    // SourceGraph.load reports authored TypeScript parse diagnostics as invalid input.
    additionalCategories: ['invalid-input'],
    meaning:
      'Static type/source graph could not resolve or check the authored type. Also emitted as invalid-input from explicit-category reject sites in parser-module.ts.',
  },
  PUI1002: {
    category: 'unsupported-input',
    // SourceGraph.publishExport rejects a duplicate export as invalid input.
    additionalCategories: ['invalid-input'],
    meaning:
      'Local declaration or binding conflicts with the module namespace. Also emitted once as invalid-input from parser-module.ts for a duplicate-export boundary.',
  },
  PUI1003: {
    category: 'invalid-input',
    // The parser's reasoned unsupported import/re-export boundary uses rejectNode.
    additionalCategories: ['unsupported-input'],
    meaning:
      'Import boundary: unsupported specifier, import kind, or a file/root/closed-source read failure. rejectNode call sites without an explicit category default to unsupported-input; the explicit-category boundary sites dominate the registered meaning.',
  },
  PUI1004: {
    category: 'unsupported-input',
    meaning:
      'Syntax outside the admitted static subset (async/generator/computed names/effectful expressions).',
  },
  PUI1005: {
    category: 'unsupported-input',
    meaning: 'Duplicate declaration or binding within the module source.',
  },
  PUI1006: {
    category: 'unsupported-input',
    meaning:
      'Authored value or part violates its type or is not renderable under the family boundary.',
  },
  PUI1007: {
    category: 'unsupported-input',
    meaning: 'Captured/callback value violates the immutable data boundary.',
  },
  PUI1008: {
    category: 'unsupported-input',
    meaning: 'Export/import binding fails the declared surface contract.',
  },
  PUI1020: {
    category: 'unsupported-input',
    meaning:
      'Static type resolution fails: absent graph node, cyclic/ambiguous export, or non-finite shape.',
  },
  PUI1021: {
    category: 'unsupported-input',
    meaning:
      'Context declaration fails: non-literal key, non-createContextKey origin, or non-record value type.',
  },
  PUI1024: {
    category: 'unsupported-input',
    meaning: 'Static rule declaration requires one checked declaration.',
  },
  PUI1025: {
    category: 'unsupported-input',
    meaning:
      'Static/Module declaration fails: duplicate field, non-factory value, or non-JSON value.',
  },
  PUI1999: {
    category: 'compiler-defect',
    meaning:
      'Unexpected internal failure past the admitted input boundary; original stack is preserved.',
  },

  // Internal IR (2xxx) — machine-checked projection integrity.
  PUI2001: {
    category: 'invalid-ir',
    meaning: 'Private IR schema version is not supported by this compiler.',
  },
  PUI2002: { category: 'invalid-ir', meaning: 'Generated IR violates its private schema.' },
  PUI2024: {
    category: 'invalid-ir',
    meaning: 'Rule plan failed to lower a declared rule into the target contract.',
  },

  // Emitter/source generation (3xxx) — target emission failures and conflicts.
  PUI3001: {
    category: 'invalid-input',
    meaning: 'Reserved/invalid generated component identifier in the emitted profile.',
  },
  PUI3002: {
    category: 'output-conflict',
    meaning:
      'Artifact publication failed; the primary diagnostic is an output conflict (rollback reported).',
  },
  PUI3003: {
    category: 'output-write',
    meaning:
      'Artifact publication failed; the primary diagnostic is not a conflict (rollback reported). Non-conflict sibling of PUI3002 at artifact-output.ts:570, where the only non-conflict category in the declared union is output-write.',
  },
  PUI3004: {
    category: 'invalid-input',
    meaning:
      'Artifact output could not be planned or the produced artifact set could not be committed.',
  },
  PUI3005: { category: 'compiler-defect', meaning: 'Emitter source-map attachment failed.' },
  PUI3301: {
    category: 'unsupported-input',
    meaning: 'Web-component source emission rejected the input.',
  },
  PUI3302: {
    category: 'unsupported-input',
    meaning: 'Web-component public surface has an unsupported member/property.',
  },

  // Target/profile admission (4xxx) — profile and host-capability conformance.
  PUI4001: {
    category: 'unsupported-input',
    // watchProject input and filesystem rejection; target admission stays unsupported.
    additionalCategories: ['invalid-input'],
    meaning:
      'Profile or target is not implemented/admitted; also used by watch for unreadable project.',
  },
  PUI4002: {
    category: 'unsupported-input',
    meaning: 'Requested profile version or native watch path is not admitted.',
  },
  PUI4003: {
    category: 'unsupported-input',
    // watchProject retains this code for a thrown compiler invocation, not a target rejection.
    additionalCategories: ['compiler-defect'],
    meaning:
      'Public method/interaction signature cannot cross the portable data boundary. Also emitted as compiler-defect when a watch compiler invocation throws; the failed revision retains only explicitly old output.',
  },
  PUI4004: {
    category: 'unsupported-input',
    // A throwing watch report consumer terminates that watch after cleanup.
    additionalCategories: ['compiler-defect'],
    meaning:
      'Operation or requested capability is unavailable in the selected profile. Also emitted as compiler-defect when a watch report consumer callback throws; the watch closes and reports the original exception.',
  },
  PUI4006: {
    category: 'unsupported-input',
    meaning: 'Authored hook has no semantic body, or a recursive hook is rejected.',
  },
  PUI4007: {
    category: 'invalid-input',
    // checkTargetOperations reports an unavailable Context scope as unsupported.
    additionalCategories: ['unsupported-input'],
    meaning:
      'Component identifier is reserved/invalid (Vue name check). The same code also reports a context-scope requirement at targets.ts:747 as unsupported-input.',
  },
  PUI4008: {
    category: 'unsupported-input',
    meaning: 'Requested props-update policy or capability override is not admitted.',
  },
  PUI4009: {
    category: 'unsupported-input',
    meaning:
      'Native shader declaration fails graph validation or static lowering, or combines Shader and Presence without an admitted atomic material profile.',
  },
  PUI4101: {
    category: 'invalid-input',
    meaning: 'Project source/manifest entry is not a valid project.',
  },
  PUI4102: {
    category: 'unsupported-input',
    meaning: 'Vue2 profile rejects the emitted public surface.',
  },
  PUI4201: {
    category: 'invalid-input',
    // evaluateStylePlan validates IR; prepareCompilerLibrary requires a DOM source profile.
    additionalCategories: ['invalid-ir', 'unsupported-input'],
    meaning:
      'Compiler library manifest or artifact input is invalid. Also emitted as invalid-ir from style-plan.ts when a style contribution cannot be projected, and as unsupported-input when nominal DOM library linking is requested for a non-DOM source profile.',
  },
  PUI4202: {
    category: 'invalid-input',
    // A valid contribution with no supported target style mapping remains unsupported.
    additionalCategories: ['unsupported-input'],
    meaning:
      'Style plan could not be applied to the library surface. Also emitted as unsupported-input from style-plan.ts for an unsupported style contribution.',
  },
  PUI4203: {
    category: 'invalid-input',
    meaning: 'Compiler library artifact inventory/linking is incomplete or colliding.',
  },
  PUI4204: {
    category: 'invalid-input',
    meaning: 'Linked declaration contract differs from the exported surface.',
  },

  // Artifact output (5xxx).
  PUI5001: {
    category: 'output-conflict',
    meaning: 'A produced artifact conflicts with an existing destination or output constraint.',
  },

  // CLI boundary (9xxx).
  PUI9001: { category: 'invalid-input', meaning: 'CLI invoked with a missing/invalid input.' },
  PUI9002: {
    category: 'compiler-defect',
    meaning: 'CLI surface hit an unexpected internal failure.',
  },

  // Native/emission symbolic codes — emission-time profile rejections, not
  // numeric diagnostics; categories follow their literal call sites.
  PUI_FLUTTER_NAME: {
    category: 'invalid-input',
    meaning: 'Flutter profile requires an uppercase Dart component identifier.',
  },
  PUI_QT_NAME: {
    category: 'invalid-input',
    meaning: 'Qt profile requires a valid Qt component identifier.',
  },
  PUI_QT_STYLE: {
    category: 'unsupported-input',
    meaning: 'Qt profile rejects an admitted style token.',
  },
  PUI_QT_DYNAMIC_STYLE: {
    category: 'unsupported-input',
    meaning: 'Qt profile cannot lower a dynamic style expression.',
  },
  PUI_QT_PUBLIC_DATA: {
    category: 'unsupported-input',
    meaning: 'Qt public surface exposes non-portable data.',
  },
  PUI_GPUI_NAME: {
    category: 'invalid-input',
    meaning: 'GPUI profile requires a valid component identifier.',
  },
  PUI_GPUI_SDK_COMPATIBILITY: {
    category: 'invalid-input',
    meaning:
      'Shared GPUI SDK contents, dependency mode or ownership inventory do not match the compiler obligation.',
  },
  PUI_RUST_DATA_SELECTION: {
    category: 'unsupported-input',
    meaning:
      'Rust data extraction requires a non-empty explicit set of distinct pure method selectors.',
  },
  PUI_RUST_DATA_NAME: {
    category: 'unsupported-input',
    meaning:
      'Rust data package or normalized public function names are invalid, reserved or colliding.',
  },
  PUI_RUST_DATA_PURITY: {
    category: 'unsupported-input',
    meaning: 'A selected Rust data function does not have a proven pure portable helper closure.',
  },
  PUI_RUST_DATA_UNSUPPORTED: {
    category: 'unsupported-input',
    meaning:
      'Checked data computation uses a type or operation outside the private Rust data lowering subset.',
  },
  PUI_GPUI_STYLE: {
    category: 'unsupported-input',
    meaning: 'GPUI profile rejects an admitted style token.',
  },
  PUI_GPUI_STRING_UNSUPPORTED: {
    category: 'unsupported-input',
    meaning: 'GPUI profile cannot lower a string form.',
  },
  PUI_GPUI_PUBLIC_DATA: {
    category: 'unsupported-input',
    meaning: 'GPUI public surface exposes non-portable data.',
  },
  PUI_GPUI_SDK_CAPABILITY: {
    category: 'unsupported-input',
    meaning: 'GPUI host does not expose the requested SDK capability.',
  },
  PUI_GPUI_A11Y_VALUE: {
    category: 'unsupported-input',
    meaning: 'GPUI SetValue requires its default route or a literal nonempty host:* event route.',
  },
  PUI_GPUI_CONTROL_LABEL_ANATOMY: {
    category: 'unsupported-input',
    meaning:
      'GPUI ControlLabel supports explicit typed InstanceAssociations but has no native lowering for Anatomy pairing.',
  },
  PUI_GPUI_HOST_REQUIRED: {
    category: 'unsupported-input',
    meaning: 'GPUI lowering requires an owned host bridge.',
  },
  PUI_GPUI_INPUT_REQUIRED: {
    category: 'unsupported-input',
    meaning: 'GPUI lowering requires a declared input owner.',
  },
  PUI_GPUI_MODULE_REQUIRED: {
    category: 'unsupported-input',
    meaning: 'GPUI lowering requires a declared module binding.',
  },
  PUI_GPUI_EXCEPTION_PROPERTY: {
    category: 'unsupported-input',
    meaning: 'GPUI rejects an exception/property payload.',
  },
  PUI_GPUI_STATIC_ABI: {
    category: 'unsupported-input',
    meaning: 'Shared native Table family must match its declared package ABI.',
  },
  PUI_NATIVE_INTERACTION_UNSUPPORTED: {
    category: 'unsupported-input',
    meaning: 'Native interaction requires a supported static input type or host:* extension.',
  },
};

/** Registered diagnostic category, or `undefined` for an unregistered code. */
export function diagnosticCategory(code: string): CompilerDiagnostic['category'] | undefined {
  return DIAGNOSTIC_REGISTRY[code]?.category;
}

/** Complete permitted category set, including only the registered meaning-specific variants. */
export function diagnosticCategories(code: string): readonly CompilerDiagnostic['category'][] {
  if (!Object.hasOwn(DIAGNOSTIC_REGISTRY, code)) return [];
  const registration = DIAGNOSTIC_REGISTRY[code];
  return [registration.category, ...(registration.additionalCategories ?? [])];
}

/** True when the literal is an emitted diagnostic code, not a generated-source placeholder. */
export function isDiagnosticCode(code: string): boolean {
  return Object.hasOwn(DIAGNOSTIC_REGISTRY, code);
}
