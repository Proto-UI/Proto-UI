import { describe, expect, it } from 'vitest';
import { shadcnComponentPresets } from '../src/component-presets';
import { shadcnCheckboxComponentPreset } from '../src/checkbox/preset';
import { shadcnDialogComponentPreset } from '../src/dialog/preset';
import { shadcnSwitchComponentPreset } from '../src/switch/preset';

describe('prototypes/shadcn: component preset recipes', () => {
  it('aggregates component-local recipes without owning prototype visual tokens', () => {
    expect(shadcnSwitchComponentPreset).toEqual({
      kind: 'replaceable-default-part',
      placement: 'direct-child',
      exportName: 'ShadcnSwitch',
      rootPrototype: 'shadcnSwitchRoot',
      defaultPartPrototype: 'shadcnSwitchThumb',
      inputName: 'thumb',
      elementName: 'proto-ui-shadcn-switch',
      omissionAttribute: 'data-pui-no-default-thumb',
    });
    expect(shadcnDialogComponentPreset.defaultPartPrototype).toBe('shadcnDialogCloseIcon');
    expect(shadcnCheckboxComponentPreset.defaultPartPrototype).toBe('shadcnCheckboxIndicator');
    expect(shadcnComponentPresets).toEqual({
      'shadcn-switch': shadcnSwitchComponentPreset,
      'shadcn-dialog': shadcnDialogComponentPreset,
      'shadcn-checkbox': shadcnCheckboxComponentPreset,
    });
    expect(JSON.stringify(shadcnComponentPresets)).not.toMatch(
      /className|style|token|translate|padding/
    );
  });
});
