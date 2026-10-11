# Finf B: preserve Toolbar current item on metadata updates

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Toolbar Button metadata/prop updates now ask Root to revalidate the existing current item, rather than making the updated Button current. Focus/activation still deliberately choose the Button; disabling the current Button permits Root's enabled-item fallback.

Real WC focused test checks that an unrelated value update preserves both actual focus and the single tab stop, then disabling the current Button moves only sequential participation to the enabled sibling. Controls suite: 12/12 passed with pinned offline pnpm 10.32.1. Focused controls source types passed. Ordinary Astro warning remains. No final browser/native/compiler or Finf acceptance is claimed.
