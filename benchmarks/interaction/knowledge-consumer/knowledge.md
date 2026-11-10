# Tabs interaction facts for the knowledge condition

This is a proposed readable projection of existing **draft** Proto UI definitions at source `0607c6c5c386b8a932ab850e92a8873b2121dc45`. It is experimental knowledge, not stable conformance or an independently approved experiment result. Review the projection before using it for a measured comparison. No final implementation is included.

| Fact | Source entity and criterion |
| --- | --- |
| Keep one selected protocol value within a Tabs domain. A root owns selection; triggers request a change and derive whether they are selected. | `P-BASE-TABS#P-BASE-TABS-ROLE-SINGLE-SELECTION`, `P-BASE-TABS-ROOT-SEMANTIC-OWNER`; `P-BASE-TABS-TRIGGER` |
| Keep collection/focus movement separate from selected-value ownership. A list carries roving focus; moving focus need not change selection. | `P-BASE-TABS-LIST#P-BASE-TABS-LIST-ROLE-COLLECTION`, `P-BASE-TABS-LIST-FOCUS-ROVING`; `P-BASE-TABS#P-BASE-TABS-PROP-ACTIVATION-MODE` |
| Horizontal movement uses Left/Right, skips disabled triggers, and supports Home/End. Looping is an explicit configuration; Proto's draft List defaults to false. | `P-BASE-TABS-LIST#P-BASE-TABS-LIST-SKIP-DISABLED`, `P-BASE-TABS-LIST-ORIENTATION-KEYS`, `P-BASE-TABS-LIST-HOME-END`, `P-BASE-TABS-LIST-PROP-LOOP` |
| A panel derives whether it is current from selection. It does not own activation or selection. Its accessible label comes from its matching trigger. | `P-BASE-TABS-CONTENT#P-BASE-TABS-CONTENT-ROLE-CONTENT`, `P-BASE-TABS-CONTENT-A11Y-LABELLEDBY-TARGET` |
| A component includes its relationships with people, the application, other components and the environment. An implementation alone is not the whole interactive unit. | `K-COMPONENT-INTERACTION-0001#K-COMPONENT-INTERACTION-0001-B` |

The ordinary task explicitly asks for **manual activation and looping**. It also specifies the labels, disabled item, initial panel, reciprocal relationships and host-removal behavior. Those facts are available to both AI conditions. The public [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) is permitted ecosystem information for both conditions; knowledge availability does not give one condition exclusive access to it.

Use the target framework's actual APIs. Proto's `valueChange` signal, anatomy declarations, L1 detach and retained owner lifetime are project-specific. They are not Radix prop names or requirements to reproduce a Proto runtime in a React component. Application-owned removal and continued host interaction can be observed separately from any claim about retained Proto resources.

Source documents at the exact projection revision:

- [Root](https://github.com/Proto-UI/Proto-UI/blob/0607c6c5c386b8a932ab850e92a8873b2121dc45/spec/prototypes/P-BASE-TABS.yaml)
- [List](https://github.com/Proto-UI/Proto-UI/blob/0607c6c5c386b8a932ab850e92a8873b2121dc45/spec/prototypes/P-BASE-TABS-LIST.yaml)
- [Trigger](https://github.com/Proto-UI/Proto-UI/blob/0607c6c5c386b8a932ab850e92a8873b2121dc45/spec/prototypes/P-BASE-TABS-TRIGGER.yaml)
- [Content](https://github.com/Proto-UI/Proto-UI/blob/0607c6c5c386b8a932ab850e92a8873b2121dc45/spec/prototypes/P-BASE-TABS-CONTENT.yaml)
- [Interaction vocabulary](https://github.com/Proto-UI/Proto-UI/blob/0607c6c5c386b8a932ab850e92a8873b2121dc45/spec/knowledge/K-COMPONENT-INTERACTION-0001.yaml)

These lifecycle statuses remain draft. Public accessibility guidance and the application task are separate authorities; a conflict needs independent adjudication. This projection does not claim dynamic selected-trigger removal, duplicate-value fallback, other hosts, assistive technology or business-level usability.
