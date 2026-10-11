# Toast Action callback lifetime (draft)

Status: draft, uncataloged prototype slice. Action owns enabled activation and emits an application action intent before requesting dismissal from its Toast Root. Root owns open state and controlled open-change requests; the application owns action side effects.

The continuation after application notification belongs to the activating Action's mounted view epoch. If the callback unmounts or terminally disposes the Action, that continuation ends. A remount is a new epoch and must not revive the old dismissal. No exception is swallowed to implement this boundary, and no Anatomy query is made with the retired RunHandle. An ordinary live action still emits intent first and then requests dismissal.

Acceptance: synchronous application callbacks unmount/dispose Action without stale queries; normal action order remains action then openChange; a remounted Action admits fresh input.

Related definitions: C-LIFECYCLE-0008 (active), C-ANATOMY-0005 and C-ANATOMY-0009 (draft). This portable responsibility requires no Compiler, IR, or Adapter special case. Root-only terminal retirement with retained descendants is a distinct ownership boundary, not certified by the Action-local evidence.
