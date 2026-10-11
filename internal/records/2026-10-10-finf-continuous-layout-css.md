# Continuous logical layout CSS lowering

Status: source-level repair, not full visual acceptance.

Reuse the existing exposed number.range to CSS variable projection rather than generating a runtime utility token for every percentage. Static basis-[calc(var(--pui-size)*1%)] now lowers to flex-basis and basis-2 lowers the resize handle's fixed extent. The same spacing lowering supports bottom-[calc(var(--pui-percentage)*1%)] for the existing vertical Slider thumb. Portable state remains dimensionless; no new pixel API or host-specific component DOM write is introduced.

Validation: 39 CLI style CSS tests passed, including the new document and Shadow CSS output assertions. Resizable's component owner separately verifies live exposed-state variable changes and ownership release; this record does not claim that forthcoming verification.

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
