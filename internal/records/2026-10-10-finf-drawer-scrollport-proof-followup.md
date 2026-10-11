# Drawer scrollport proof follow-up

Date: 2026-10-10.

## Preserved failure

The official representative-feature browser run `38036693145` on published commit `14ce5ddee6311b3b8e807f8b5ac24e1ba4173c92` passed Form and Calendar, then captured a half-open Drawer whose panel started at y=924 with height=152 in a 1000px viewport. The Close click timed out. That image and failure demonstrate an actual inaccessible lower panel, not successful Drawer acceptance.

## Source and proof changes

The separate Drawer implementation now changes the bounded scrollport extent at each snap and anchors it to the available region, instead of translating a self-sized panel beyond the viewport. Its four directional style recipes are statically collectible. The shared CLI vocabulary fixes are separate source commits.

The existing browser proof now requires the half-snap height to match half of the declared 85% available-region extent, checks all panel edges against the viewport, scrolls the real Close control into view, checks that its center intersects both the panel and viewport, captures the resulting geometry, and still performs the actual Close click and hidden-state assertion. The screenshot does not replace the interaction requirement.

The focused Drawer fixture's TypeScript signature now describes only the five names it consumes from each family, and its CSS collector validates the returned token element types before rendering. These changes fix five actual test-source diagnostics without weakening behavior assertions or inventing a cast to the Base module shape.

## Checks and remaining evidence

The integrated seven-file focused check passed 110 tests, including all 35 Drawer tests, all 44 CLI style-renderer tests, and Form/Overlay capture tests. `tsc -p tsconfig.workspace.json --noEmit` passed after the separately authored Calendar negative-type directive correction was integrated.

The modified native browser proof has not been executed locally. New source-bound official browser screenshots and the real Close interaction are still required. Earlier `14ce5d` screenshots remain historical failure evidence and must not be presented as results for this fix. No acceptance score is changed here.
