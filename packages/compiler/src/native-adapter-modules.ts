import { selectSupportDeclarations, omitSupportDeclarations } from './native-support/template-ast';
import {
  LEGACY_TEXT_SINGLE_V1,
  LEGACY_TEXT_MULTILINE_V1,
} from './native-support/legacy-text-v1.template';
import { fullNativeModuleTemplate } from './native-support/artifacts';
let fullTemplate: string | undefined;
const fullTemplateSource = () => (fullTemplate ??= fullNativeModuleTemplate());

export const nativeAdapterModulesArtifact = {
  path: '.proto-ui/interaction/adapter-modules-v1.ts',
  kind: 'source' as const,
  get contents() {
    return fullTemplateSource();
  },
};

/** Legacy v1 module assembly is structural; no source-text surgery. */
const ownershipTypes = [
  'NativeFocusRequest',
  'NativeAnatomyFamily',
  'NativeAnatomyPart',
  'Claim',
  'Owner',
] as const;
const ownershipMaps = ['owners', 'activeScopes', 'parts', 'targets', 'hostIds'] as const;
const ancestry = [
  'logicalRoot',
  'ancestor',
  'descends',
  'hostOrder',
  'isElement',
  'targetOf',
  'contains',
] as const;
const rootOwnership = [
  'RootOwner',
  'rootOwners',
  'logicalOwners',
  'exposeSignals',
  'defaultPreventedSamples',
] as const;

export function nativeOwnershipArtifact(interactionSource: string) {
  return {
    path: '.proto-ui/interaction/ownership-v1.ts',
    kind: 'source' as const,
    contents:
      '// Native logical identity and physical-root ownership. No capability factory.\n' +
      selectSupportDeclarations(
        fullTemplateSource(),
        [...ownershipTypes, ...ownershipMaps, ...ancestry],
        true
      ) +
      selectSupportDeclarations(interactionSource, rootOwnership, true),
  };
}
export function nativeAdapterModulesWithOwnership(options: { controlLabel?: boolean } = {}) {
  return {
    path: '.proto-ui/interaction/adapter-modules-v1.ts',
    kind: 'source' as const,
    contents:
      "import { owners, activeScopes, parts, targets, hostIds, logicalRoot, ancestor, descends, hostOrder, isElement, targetOf, contains, type Claim, type Owner } from './ownership-v1';\n" +
      omitSupportDeclarations(
        options.controlLabel ? fullNativeModuleTemplate(options) : fullTemplateSource(),
        ['Claim', 'Owner', ...ownershipMaps, ...ancestry]
      ),
  };
}
export function nativeTextControlArtifact(singleLine: boolean) {
  return {
    path: '.proto-ui/interaction/' + (singleLine ? 'text-single' : 'text-multiline') + '-v1.ts',
    kind: 'source' as const,
    contents: singleLine ? LEGACY_TEXT_SINGLE_V1 : LEGACY_TEXT_MULTILINE_V1,
  };
}
