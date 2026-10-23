# Passive Card: New York / Rhea

Use the existing public Root, Header, Content and Footer parts. They do not become Base business atoms, add roles, focus themselves, validate input or take over native links/actions.

CardRoot is deliberately a family style-scope boundary. Its absent/inherit styleProfile follows the nearest outer scope. Explicit new-york (new-york-v4) or rhea selects this subtree, including descendant Textarea consumers. Header/Content/Footer use the same shared scope and may explicitly override their own style. Nested Card roots inherit style unless explicit, and start a fresh default density. A Card does not lock the whole page to Rhea. Other style IDs fail closed.

Root size defaults to default. Rhea supports default (20px) and sm (16px) gap/padding; New York preserves its pinned 24px spacing and only supports default size. Header/Footer divider=true adds the relevant border and matching inner spacing, rather than inspecting an arbitrary class. Switching visual props preserves child nodes, edited values, selection, focus and native action ownership.

Rhea maps the fixed upstream min(radius-4xl, 24px), foreground ring5/dark10, shadow-sm, card fill/ink, text-sm and header gap6. Theme radius remains dynamic below the cap. The root does not inherit generic Surface interaction/state presentation. Do not replace every Surface with Card.

This is the existing four-region subset, not the full React Card API. Native headings/paragraphs and public Text/Button own title, description and action semantics. For Rhea title use base/medium Text, and small/muted Text for description. Automatic image-edge detection/corners, CardAction-dependent columns/placement, container queries and arbitrary native/data-slot/className forwarding remain unsupported. No DOM query or page-specific paint substitutes for them. Exact-head native raster, full source parity and independent stable admission remain separate obligations.
