# Native material intent and shared target lowering

Status: non-normative design direction, requested 2026-10-04. Refs #792, #793, #806 and #809. No Apple, Windows, Android or GTK material backend is implemented or admitted by this record. This future direction does not block current owned-scene Web evidence or its separate budget transaction.

## Preserve the requested meaning

A Prototype describes the role of a surface, material/shape intent, interaction changes and its sampling relationship. Platform API names, OS-version conditionals, shader uniforms, passes and synchronization belong in target profiles and generated host code.

Two author intents must remain distinct:

- Follow the current platform's native appearance. The selected native control/material may appropriately change across system versions, themes and preferences.
- Preserve a specified visual language or material meaning, such as Aero or Acrylic. Selecting Mica just because it is available must not silently satisfy that request. A substitute requires a disclosed, permitted approximation/degradation; otherwise report unsupported.

Windows Vista/7 Aero, Windows 10-era Acrylic and Windows 11 Mica illustrate why an OS-name switch is insufficient. Microsoft records that Vista/7 composition depended on the Aero Glass theme, whereas Windows 8 made DWM composition continuously available. This history is not a promise to build or maintain old-OS targets. [Historical composition boundary](https://learn.microsoft.com/en-us/windows/win32/w8cookbook/desktop-window-manager-is-always-on), [current material roles](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials).

## Shared Adapter and Compiler decision

A future versioned lowering profile should be consumed by both the live Adapter and Compiler. Given the same intent and capability facts, both must select equivalent eligibility and fallback decisions. The Adapter creates/updates native objects; the Compiler emits the corresponding editable target-language calls and runtime capability/lifetime hooks. Neither should maintain an unrelated private mapping table.

The profile needs framework and OS/library bounds, native surface role, sampling scope, shape restrictions, interaction/group support, runtime availability probes, preferences, ownership and teardown obligations. Prefer a standard platform control when it fulfills the applicable Base contract; do not wrap an already-native glass control in another decorative glass layer. Native activation/focus/accessibility must remain connected to the same Base semantics, without duplicate event owners.

Report semantic/control preservation, material identity, sampling scope, grouping/motion and effective availability separately:

- **Exact** is relative to a stated semantic/profile contract, not a promise of identical pixels across systems.
- **Approximate** identifies a permitted substitute and its specific lost behavior.
- **Degraded** identifies a simpler realization selected because of policy, preferences or runtime limitations.
- **Unsupported** means the required meaning or source relationship cannot be supplied.

The current #809 declaration explicitly requires an owned-scene source. Native system compositing is a different source contract. A future backend cannot relabel it as the same exact capability merely because both look translucent. A broader native-composited intent requires its own governed source relationship and evidence. Source acquisition must not become implicit arbitrary desktop/DOM capture.

## Candidate platform mechanisms, not a support matrix

### Apple

Apple recommends starting with standard SwiftUI/UIKit/AppKit controls, which adopt system appearance when built with the relevant SDK and run on supported systems. For custom surfaces, candidate mappings include SwiftUI `glassEffect(_:in:)` and `GlassEffectContainer`, UIKit `UIGlassEffect`/`UIGlassContainerEffect`, and AppKit `NSGlassEffectView`/`NSGlassEffectContainerView`. These calls delegate optical realization to the system; they need not run the experimental Web shader. Group identity and morphing still require a separately governed multi-surface contract. [Adoption guidance](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass), [SwiftUI custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views).

Official symbol metadata inspected on 2026-10-04 lists SwiftUI `glassEffect` from iOS/iPadOS/Mac Catalyst/macOS/tvOS/watchOS 26; UIKit `UIGlassEffect` from iOS/iPadOS/Mac Catalyst/tvOS 26; AppKit glass views from macOS 26. Do not infer visionOS availability for the same API from the general Apple design name. SDK/OS checks and actual target tests remain required. [SwiftUI effect](<https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)>), [UIKit effect](https://developer.apple.com/documentation/uikit/uiglasseffect), [AppKit effect](https://developer.apple.com/documentation/appkit/nsglasseffectview), [AppKit grouping](https://developer.apple.com/documentation/appkit/nsglasseffectcontainerview).

### Windows

Mica is an opaque wallpaper-derived window foundation; Acrylic is a different translucent material with different uses. They are not Liquid Glass aliases. `Window.SystemBackdrop` with Mica/Desktop Acrylic is documented from Windows App SDK 1.3; current documentation adds element-scoped `SystemBackdropElement` from SDK 2.0. Framework support, OS availability and the actual sampling region must all match. In-app `AcrylicBrush` and desktop/window backdrops do not sample the same scene. [Material mechanisms](https://learn.microsoft.com/en-us/windows/apps/develop/ui/materials), [system backdrops](https://learn.microsoft.com/en-us/windows/apps/develop/ui/system-backdrops), [Acrylic guidance](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic).

Mica's intended realization requires Windows 11 build 22000+, with fallback elsewhere. Controller paths require runtime support checks, activation/theme updates and disposal on window closure. Transparency, high contrast, power and hardware can change the effective material. These constraints belong in the shared profile rather than Prototype version branches. [Mica policies](https://learn.microsoft.com/en-us/windows/apps/design/style/mica).

### Android

Prefer Material/Compose controls and semantic color roles; dynamic color is an Android 12+ capability, with ordinary light/dark schemes as fallback. Android 12/API 31 cross-window background/behind blur is distinct from `RenderEffect` or Compose content blur. Device support can change at runtime; the host must observe blur availability, unregister listeners and use readable opacity/dimming when unavailable. Blur alone does not establish refraction, fusion or Liquid Glass interaction. [Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3), [cross-window blur and lifecycle](https://source.android.com/docs/core/display/window-blurs), [Compose content blur](https://developer.android.com/develop/ui/compose/graphics/images/customize#blur-image).

### GTK / Libadwaita

Prefer native widgets, semantic style classes and `AdwStyleManager` appearance facts. GTK snapshot blur processes the image recorded in its push/pop scope; it is not evidence of compositor-backdrop access. The initial proposed profile must mark unproven glass/backdrop semantics unsupported rather than call Adwaita styling Liquid Glass. Gate actual GTK/Libadwaita versions and backend capabilities, not a generic Linux flag. [GNOME styling](https://developer.gnome.org/hig/guidelines/ui-styling.html), [Libadwaita appearance](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/styles-and-appearance.html), [snapshot blur](https://docs.gtk.org/gtk4/method.Snapshot.push_blur.html).

## Future evidence boundary

Before admitting any native mapping, test standard-control semantics, label/focus/disabled behavior, supported and unavailable APIs, live theme/accessibility changes, reduced motion/transparency, high contrast, readable fallback, activation, detach/rebind and disposal. Native libraries may manage part of the visual policy, but that is not proof that the binding preserves Proto UI behavior or cleans up its observers. Compare Adapter and Compiler decisions and real target interactions on the same declared profile; record visual differences without inventing pixel equivalence.

No new public schema or normative lifecycle promotion is introduced here. Standard controls and material providers are candidates for future bounded slices; shader targets remain alternative realizations only where their actual capability and source contracts fit the requested intent.
