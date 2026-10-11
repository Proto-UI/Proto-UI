import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../src/registry/finf-components';
import { COMPONENT_REGISTRY } from '../src/registry/components';
import * as baseCalendar from '../../prototypes/base/src/calendar';
import * as shadcnCalendar from '../../prototypes/shadcn/src/calendar';
import * as brutalistCalendar from '../../prototypes/brutalist/src/calendar';
import * as bootstrapCalendar from '../../prototypes/bootstrap-2-3-2/src/calendar';
import * as liquidCalendar from '../../prototypes/liquid-glass/src/calendar';
import * as baseDropdown from '../../prototypes/base/src/dropdown';
import * as shadcnDropdown from '../../prototypes/shadcn/src/dropdown';
import * as brutalistDropdown from '../../prototypes/brutalist/src/dropdown';
import * as bootstrapDropdown from '../../prototypes/bootstrap-2-3-2/src/dropdown';
import * as liquidDropdown from '../../prototypes/liquid-glass/src/dropdown';

const families: [string, Record<string, unknown>, Record<string, unknown>][] = [
  ['base', baseCalendar, baseDropdown],
  ['shadcn', shadcnCalendar, shadcnDropdown],
  ['brutalist', brutalistCalendar, brutalistDropdown],
  ['bootstrap-2-3-2', bootstrapCalendar, bootstrapDropdown],
  ['liquid-glass', liquidCalendar, liquidDropdown],
];
const loaders = fs.readFileSync(
  'apps/www/src/components/PrototypePreviewer/finf-prototype-modules.ts',
  'utf8'
);

describe('quality-source entries preserve actual atom identities and admission boundaries', () => {
  it.each(families)(
    '%s wires genuine Calendar and Dropdown parts',
    (family, calendar, dropdown) => {
      const calendarEntry = FINF_WORKSPACE_COMPONENT_ENTRIES[`${family}-calendar`];
      const passiveOnly = ['base', 'shadcn', 'brutalist'].includes(family);
      const dropdownId = `${family}-dropdown${passiveOnly ? '-composition' : ''}`;
      const dropdownEntry = FINF_WORKSPACE_COMPONENT_ENTRIES[dropdownId];
      for (const [entry, module, names] of [
        [calendarEntry, calendar, ['calendarCaption', 'calendarWeekdays', 'calendarWeekday']],
        [
          dropdownEntry,
          dropdown,
          passiveOnly
            ? ['dropdownGroup', 'dropdownLabel', 'dropdownSeparator', 'dropdownShortcut']
            : [
                'dropdownGroup',
                'dropdownLabel',
                'dropdownSeparator',
                'dropdownShortcut',
                'dropdownRoot',
                'dropdownTrigger',
                'dropdownContent',
                'dropdownItem',
              ],
        ],
      ] as const) {
        expect(entry?.sourceOnly).toBe(true);
        for (const name of names) {
          const atom = entry?.items.find((item) => item.prototypeImport === name);
          expect(atom).toBeDefined();
          const prototype = module[name];
          if (!prototype || typeof prototype !== 'object' || !('name' in prototype)) {
            throw new Error(`Missing actual prototype ${family}/${name}`);
          }
          expect(`proto-ui-${prototype.name}`).toBe(atom?.elementName);
          expect(loaders).toContain(`'${prototype.name}': async () =>`);
        }
      }
      expect(COMPONENT_REGISTRY[dropdownId]).toBeUndefined();
      if (passiveOnly) {
        expect(COMPONENT_REGISTRY[`${family}-dropdown`]?.items).toHaveLength(4);
      }
    }
  );
});
