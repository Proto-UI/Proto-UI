# General queue: observe lowered paint with its actual state facts

Four original `d0392fb3` failures came from two observation assumptions. The [original errors and complete validation receipts](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-lowered-state-paint-observations/manifest.json) remain preserved. No product rule, input, timeout or controlled-owner assertion changes.

## Calendar selected endpoints

Existing draft `C-CALENDAR-SELECTION-0001-DAYS` requires range middle segments to differ from selected endpoints. Shadcn, Brutalist and Liquid Date Picker Day therefore project selected endpoint fill with both `selected` and `not rangeMiddle` conditions. The older test only recognized a token starting immediately with `data-[selected]:bg-` and rejected the valid compound recipe. The existing independent `calendar-variable-weeks` consumer already requires `data-[selected]:not-[data-range-middle]:bg-primary`.

A first diagnostic incorrectly expected the compound rule to become a bare dynamic `bg-primary`; that candidate failed all three original cases. Its full failed result is retained, not treated as product evidence. A subsequent read-only diagnostic records the actual public states, attributes and full token lists: selected is true, rangeMiddle is false, data-selected exists, and both compound primary/foreground tokens are present.

The final test requires both exact compound tokens and both corresponding actual selector facts after the original click. It also changes the canonical date through the existing Root request, checks the same selected State handle becomes false and data-selected withdraws, while the registered recipe remains. Existing disabled, focus, press/cancel, value and popup assertions remain intact. Bootstrap keeps its independently defined primary-gradient observations.

## Menubar focused item

`P-SHADCN-MENUBAR-SOURCE-BOUND-PARTS` requires focused accent/foreground, preserving Base focus ownership. The pinned `3d98900e9b73c45f035f8109e9d41ba6a51685e7` source fixture's eight `.cn-menubar-item` recipes independently use `focus:bg-accent` and `focus:text-accent-foreground`. The existing separate `menubar-style-projection` test explicitly requires literal exposed-state variants and rejects bare resolved `bg-accent`.

The original nine-profile journey now observes `data-[focused]:bg-accent` and `data-[focused]:text-accent-foreground` alongside actual data-focused and the original focused State/identity checks. Navigation Menu retains its independent profile expectations. All original controlled refusal, activation and owner assertions remain.

Five complete files passed **81/81**, zero skipped, in **11.38 seconds**, source stable: nested feedback, Calendar selection, its four-Adapter journey, search/menu profiles and separate Menubar projection. These are real Runtime/Adapter and synthetic-DOM state/selector observations. They do not establish native pixels, browser focus dispatch, AT or final integrated acceptance.
