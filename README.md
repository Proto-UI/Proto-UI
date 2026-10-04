# PR #816 mobile interaction evidence

Public website screenshots only. This evidence-only branch must not be merged into product source.

## Captures

- `menu-before-ec6e5710-390.png`: exact pre-change ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31, 390×844 CSS pixels, Chinese, light theme, normal text.
- `menu-after-70a2ff89-390.png`: actual candidate 70a2ff89148c1552c6df762188294aa4595c6904 under the same menu probe and viewport.
- `code-expanded-70a2ff89-390.png`: actual candidate 70a2ff89148c1552c6df762188294aa4595c6904, 390×1000 CSS pixels, Chinese, light theme, existing independent code-surfaces browser suite.

Source: https://github.com/Proto-UI/Proto-UI/actions/runs/37203687650 . The code-surfaces suite passed 7/7. In the mobile report, native menu journeys and the 320px/200% stress scenarios passed their checks, but the later source stage incorrectly awaited the deliberately hidden/deferred Copy before expansion. That probe failure is preserved and corrected in later evidence-only commits; it is not presented as an all-green browser matrix.

The primary images are mobile browser simulations, not physical device captures. No pixels were generated or altered. These images remain bound to their captured revisions even when later source-only/evidence-only commits exist. The new menu's measured bounds are left8/top61/right382/bottom836, with a 44px public Close target and 685px independently scrollable body; page horizontal overflow is zero.

Retention owner: PR #816 contributor. Keep this small evidence-only branch and immutable links for review; product changes remain on `fix/mobile-navigation-reading`.
