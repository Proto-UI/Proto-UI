import ts from 'typescript';
import { DOM_MODULE_TEMPLATE } from './dom-modules.template';
import { domInteractionTemplate } from './dom-interaction.template';
import {
  mapSupportImports,
  omitSupportDeclarations,
  parseSupportTemplate,
  printSupport,
  selectSupportDeclarations,
} from './template-ast';
import {
  nativeSupportFeatures,
  nativeSupportPlanFromFeatures,
  type NativeSupportFeature,
  type NativeSupportPlan,
} from './plan';
import { specializeNativeTemplate } from './specialize';
import { nativeControlLabelArtifact } from '../native-control-label';

function legacyFullPlan(options: { controlLabel?: boolean }) {
  return nativeSupportPlanFromFeatures(
    nativeSupportFeatures.filter((feature) => feature !== 'control-label' || options.controlLabel)
  );
}
const baseModuleNames = [
  'owners',
  'parts',
  'targets',
  'hostIds',
  'logicalRoot',
  'ancestor',
  'descends',
  'hostOrder',
  'isElement',
  'targetOf',
  'contains',
] as const;
const baseInteractionNames = [
  'RootOwner',
  'rootOwners',
  'logicalOwners',
  'exposeSignals',
  'defaultPreventedSamples',
] as const;
const ownerTypes = [
  'NativeConfig',
  'NativeFocusRequest',
  'NativeAnatomyFamily',
  'NativeAnatomyPart',
  'Claim',
  'Owner',
];
const familyUnits = [
  {
    feature: 'part-relationships',
    file: 'part-relationships-v1',
    names: [
      'createNativePartRelationships',
      'nativePartKey',
      'nativePartWriteTokens',
      'nativePartReleaseProjection',
      'nativePartProject',
      'nativePartReleaseBinding',
      'nativePartReleaseReservation',
      'nativePartId',
      'publishNativePartRelationships',
      'partRelationshipRecords',
      'partRelationshipIds',
      'partRelationshipTokens',
      'partRelationshipScopes',
      'partRelationshipPublication',
    ],
    types: ['Owner', 'NativeAnatomyFamily'],
    localTypes: [
      'NativePartKey',
      'NativePartTarget',
      'NativePartRelationships',
      'NativePartProjection',
      'NativePartRecord',
      'NativePartTokens',
    ],
  },
  {
    feature: 'focus',
    file: 'focus-ownership-v2',
    names: ['activeScopes', 'ScopeEntryIntent', 'noteNativeFocusRequest'],
    types: ['Owner', 'NativeFocusRequest'],
    extra:
      'export const focusState: { scopeRevision: number; focusRequestEpoch: number; scopeEntryIntent: ScopeEntryIntent | undefined } = { scopeRevision: 0, focusRequestEpoch: 0, scopeEntryIntent: undefined };\n',
  },
  {
    feature: 'boundary',
    file: 'boundary-ownership-v2',
    names: ['boundaryStacks', 'boundarySampleOwners'],
    types: ['Owner'],
  },
  { feature: 'overlay', file: 'overlay-ownership-v2', names: ['modalLocks'], types: [] },
  { feature: 'hit', file: 'hit-ownership-v2', names: ['hitClaims'], types: [] },
  {
    feature: 'table',
    file: 'table-ownership-v2',
    names: ['NativeTableRecord', 'tableRecords'],
    types: ['Owner', 'NativeConfig', 'NativeAnatomyFamily'],
    localTypes: [
      'NativeTableSnapshot',
      'NativeTableCell',
      'NativeTableRow',
      'NativeTableDiagnostic',
    ],
  },
] as const;
const mutableGlobals: Readonly<Record<string, readonly [string, string]>> = {
  scopeRevision: ['focusState', 'scopeRevision'],
  focusRequestEpoch: ['focusState', 'focusRequestEpoch'],
  scopeEntryIntent: ['focusState', 'scopeEntryIntent'],
  nextHostId: ['hostIdState', 'nextHostId'],
};
const movedGlobals = [
  ...baseModuleNames,
  ...familyUnits.flatMap((unit) => [...unit.names]),
  ...Object.keys(mutableGlobals),
];
function rewrite(source: string, modulesFile?: string): string {
  const file = parseSupportTemplate(source);
  const transformed = ts.transform(file, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isIdentifier(node) && mutableGlobals[node.text]) {
          const parent = node.parent;
          if (
            !(ts.isPropertyAccessExpression(parent) && parent.name === node) &&
            !(ts.isPropertyAssignment(parent) && parent.name === node)
          ) {
            const [object, property] = mutableGlobals[node.text];
            return ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(object),
              property
            );
          }
        }
        if (modulesFile && ts.isStringLiteral(node) && node.text === './adapter-modules-v1')
          return ts.factory.createStringLiteral(modulesFile);
        return ts.visitEachChild(node, visit, context);
      };
      return (source) => ts.visitNode(source, visit) as ts.SourceFile;
    },
  ]);
  try {
    return printSupport(transformed.transformed[0]);
  } finally {
    transformed.dispose();
  }
}
const file = (path: string, contents: string) => ({
  path: '.proto-ui/interaction/' + path + '.ts',
  kind: 'source' as const,
  contents,
});

/** Full v1 ABI remains readable while current compilation selects v2 closures. */
export function fullNativeModuleTemplate(options: { controlLabel?: boolean } = {}): string {
  return specializeNativeTemplate(
    DOM_MODULE_TEMPLATE,
    legacyFullPlan(options),
    'createNativeAdapterModules',
    ['createNativeAdapterModules', 'noteNativeFocusRequest']
  );
}
export function fullNativeInteractionTemplate(
  semanticEvents: readonly string[],
  stateAttributes: Readonly<Record<string, string>>,
  options: { controlLabel?: boolean } = {}
): string {
  return specializeNativeTemplate(
    domInteractionTemplate(semanticEvents, stateAttributes),
    legacyFullPlan(options),
    'createNativeInteraction',
    ['createNativeInteraction', 'markNativeExposeEvent']
  );
}

/** Every generated file has ordinary explicit ES imports. Only identity registries are shared. */
export function plannedNativeInteractionArtifacts(
  plan: NativeSupportPlan,
  semanticEvents: readonly string[],
  stateAttributes: Readonly<Record<string, string>>
) {
  const interaction = domInteractionTemplate(semanticEvents, stateAttributes);
  const ownership = file(
    'ownership-v2',
    '// Shared logical/physical identity ABI v2. No capability factories or observers.\n' +
      selectSupportDeclarations(DOM_MODULE_TEMPLATE, [...ownerTypes, ...baseModuleNames], true) +
      selectSupportDeclarations(interaction, baseInteractionNames, true) +
      'export const hostIdState = { nextHostId: 1 };\n'
  );
  const shared = [ownership];
  if (plan.features.includes('control-label')) {
    // The host pairing service is shared across independently planned libraries.
    // Its type-only edge must not point back into a plan-specific factory.
    shared.push(
      file(
        'control-label-types-v1',
        selectSupportDeclarations(
          DOM_MODULE_TEMPLATE,
          [
            'NativeAnatomyFamily',
            'NativeControlLabelAnatomyPair',
            'NativeControlLabelRequest',
            'NativeControlLabelHandle',
            'NativeControlLabel',
          ],
          true
        )
      ),
      {
        ...nativeControlLabelArtifact,
        contents: mapSupportImports(
          nativeControlLabelArtifact.contents,
          new Map([['./adapter-modules-v1', './control-label-types-v1']])
        ),
      }
    );
  }
  let imports =
    'import { ' +
    [...baseModuleNames, 'hostIdState', 'type Claim', 'type Owner'].join(', ') +
    " } from './ownership-v2';\n";
  for (const unit of familyUnits) {
    if (!plan.features.includes(unit.feature as NativeSupportFeature)) continue;
    const localTypes = 'localTypes' in unit ? unit.localTypes : [];
    const extra = 'extra' in unit ? unit.extra : '';
    const body = selectSupportDeclarations(
      DOM_MODULE_TEMPLATE,
      [...unit.names, ...localTypes],
      true
    );
    const typeImports = unit.types.length
      ? `import type { ${unit.types.join(', ')} } from './ownership-v2';\n`
      : '';
    const identityImports =
      unit.feature === 'part-relationships'
        ? "import { ancestor, hostIdState } from './ownership-v2';\n"
        : '';
    shared.push(file(unit.file, typeImports + identityImports + extra + rewrite(body)));
    const names = (
      unit.feature === 'part-relationships' ? ['createNativePartRelationships'] : unit.names
    ).map((name) =>
      ['ScopeEntryIntent', 'NativeTableRecord'].includes(name) ? 'type ' + name : name
    );
    imports += `import { ${names.join(', ')}${unit.feature === 'focus' ? ', focusState' : ''} } from './${unit.file}';\n`;
  }
  const moduleSource =
    imports +
    rewrite(
      omitSupportDeclarations(DOM_MODULE_TEMPLATE, [
        ...new Set(['Claim', 'Owner', ...movedGlobals]),
      ])
    );
  const modules = {
    path: plan.modulesPath,
    kind: 'source' as const,
    contents: specializeNativeTemplate(moduleSource, plan, 'createNativeAdapterModules'),
  };
  const moduleImport = './' + plan.modulesPath.slice(plan.modulesPath.lastIndexOf('/') + 1, -3);
  const interactionImports =
    "import { rootOwners, logicalOwners, exposeSignals, defaultPreventedSamples, type RootOwner } from './ownership-v2';\n" +
    (plan.features.includes('focus')
      ? "import { noteNativeFocusRequest } from './focus-ownership-v2';\n"
      : '');
  // noteNativeFocusRequest is now an explicit focus-identity import, not a re-export from each closure.
  let interactionFile = parseSupportTemplate(
    rewrite(omitSupportDeclarations(interaction, baseInteractionNames), moduleImport)
  );
  interactionFile = ts.factory.updateSourceFile(
    interactionFile,
    interactionFile.statements.map((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      )
        return statement;
      const bindings = statement.importClause.namedBindings;
      return ts.factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        ts.factory.updateImportClause(
          statement.importClause,
          statement.importClause.isTypeOnly,
          statement.importClause.name,
          ts.factory.updateNamedImports(
            bindings,
            bindings.elements.filter((element) => element.name.text !== 'noteNativeFocusRequest')
          )
        ),
        statement.moduleSpecifier,
        statement.attributes
      );
    })
  );
  const native = {
    path: plan.interactionPath,
    kind: 'source' as const,
    contents: specializeNativeTemplate(
      interactionImports + printSupport(interactionFile),
      plan,
      'createNativeInteraction',
      ['createNativeInteraction', 'markNativeExposeEvent']
    ),
  };
  return [...shared, modules, native];
}
