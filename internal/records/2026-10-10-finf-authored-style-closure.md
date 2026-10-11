# Finf authored style vocabulary closure

Status: bounded source repair, not visual acceptance.

The first integrated 28-component website style generation succeeded but retained an explicit unsupported-token block. In particular, Calendar's seven-column grid and Resizable's grow/shrink settings had no physical CSS realization. This was an actual source-functionality gap, not a passing visual test.

The shared renderer now lowers the finite set of authored layout, spacing, typography and interaction-affordance utilities. It also lowers the canonical two-pixel border-color shadow. Component owners independently replace noncanonical --color-_ references with the existing --pui-_ theme variables; no second theme protocol or runtime token enumeration is added.

Validation: 54 CLI CSS and Shadow-split tests passed. Added tests cover document and Shadow generation, seven grid columns, flex behavior, logical margins, theme-bound composed shadow and numeric typography. The regenerated whole-source stylesheet is separately checked before the source snapshot is frozen. Native/browser geometry and optical acceptance remain open.

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
