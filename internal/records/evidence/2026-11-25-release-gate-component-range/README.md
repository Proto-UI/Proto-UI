# Component-specific Calendar range paint observations

Run `45537881490`, job `138967171695`, failed 20 of its 100 native component journeys. Each failure compared a range interior to a stale shared pigment expectation. The draft contract `C-CALENDAR-SELECTION-0001-DAYS` requires families to distinguish range interiors and endpoints; it does not require Calendar and Date Picker to share an identical presentation recipe.

The runner now names its actual component when selecting the independent paint oracle. Current authored recipes are:

| Family          | Calendar interior          | Date Picker interior       |
| --------------- | -------------------------- | -------------------------- |
| Shadcn          | accent / accent-foreground | accent / accent-foreground |
| Brutalist       | main at 25% / foreground   | main at 20% / foreground   |
| Bootstrap 2.3.2 | accent / accent-foreground | accent / accent-foreground |
| Liquid Glass    | primary at 15% / primary   | muted / foreground         |

Base remains headless. The change does not modify prototypes, themes, selected state, selection ownership, date geometry, native input, or the original range-completion and reentrancy checks. Endpoint colors, foreground colors, nontransparent/distinct segments, square interiors, and visible boxes are still asserted. Colors continue to be normalized with an independent hidden probe in the actual inherited theme scope.

## Native result

The original runner, limited through its existing diagnostic selector to Calendar and Date Picker, passed **40/40**: five families, four Web adapters, and two components. Node was 24.22.3; Chromium was 156.0.8078.79. The baseline checkout was `124e329cfc3cd710c1f1d267d640f1b97ef2f4c9`; the only tracked overlay was this runner. The actual CLI build and style generation were run first.

The runner SHA-256 was `bdaacabe291ff4b8181cdea7071df7bb4d7a686f031757811ecc9ca0853f4174`. `native-report.json.gz` is the unedited original JSON, with SHA-256 `414ca39df5e5c93737977a94d7f710f34c1d25511ef53d43073c7932dbfc8752`. It records the source digest, CSS digests, environment, actual paint, cases, and screenshots. Images remain in the recorded execution directory `/home/ezra/proto-ui-root-current-cb5d-control/capabilities-calendar-candidate`.

The other 60 component journeys were not repeated in this diagnostic run. Complete official CI and independent release admission remain separate.
