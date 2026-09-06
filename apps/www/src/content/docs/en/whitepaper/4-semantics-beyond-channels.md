---
title: 'Chapter 4: Semantics Beyond Channels'
description: 'Using State, Anatomy, and Lifecycle to add internal continuity, composite structure, and temporal order, bringing a Prototype closer to execution.'
---

> If information channels already organize a component's relations with the outside world, why can a Prototype not run on those channels alone?

## Channels Alone Are Not Enough

Return to the Switch relation map we have already used:

```text
App Maker   --Props { checked, defaultChecked, disabled }--> Switch Root
User        --Event { activate }---------------------------> Switch Root
Switch Root --Expose { checked, checkedChange }------------> App Maker
Switch Root --Context { checked, disabled }----------------> Switch Thumb
Switch Root / Switch Thumb --Feedback----------------------> User
```

The map tells us where information comes from and where it goes, but not how Switch remembers whether it is currently on or off.

When the User completes an operation, `checked` changes from false to true. Event can carry the operation to Switch, Feedback can present the result to the User, Expose can report the change to the App Maker, and Context can provide the new value to Thumb. Before any of that information can be sent again, however, Switch first needs somewhere to preserve the fact that “the current value is true.”

No information channel is responsible for doing that.

## State: Preserving Internal Facts Across Interactions

Proto UI uses State to describe the internal facts that a Component needs to preserve during interaction.

State introduces no new participant. When `checked` is stored, the act of storing it does not make anyone a new sender or receiver. It simply gives the same Component continuity between one interaction and the next.

A change in State also does not automatically decide how the outside world should perceive that change. After Switch becomes on, changing its visual Feedback, reporting to the App Maker, and providing the value to Thumb remain the separate responsibilities of Feedback, Expose, and Context.

The cooperation between State and Context illustrates the distinction:

- State explains how `checked` exists inside Switch Root.
- Context explains how Root transmits information it chooses to provide to Thumb.

Without State, Root has no internal fact that can persist and change through interaction. Without Context, Thumb does not automatically receive `checked` merely because Root happens to store it.

Seen this way, an information channel is how an internal fact relates to other participants. State is not on the channel, but it affects what many channels transmit next.

## Anatomy: Describing Composite Structure

Chapter 3 left us with another question.

Once information channels have drawn their boundaries, every independent Component is an interactive subject. Yet complete interaction tasks often require several subjects to cooperate. Switch Root and Thumb do so, as do Select Root, Trigger, Content, and Item.

A Component Author needs to describe the structure these subjects are expected to form. Actually placing them in a UI, choosing which parts to use, and arranging and composing them is usually the Maker's work.

If a Prototype directly created and nested other Prototypes, the composition would be fixed inside its definition. The Maker would lose the ability to adjust the structure, while the Prototype would have to assume how the target technology creates, nests, and schedules components. Technologies do not share one universal method of component composition, so such assumptions would weaken portability.

A Prototype therefore needs a way to declare structural expectations without manipulating the actual structure itself. Proto UI calls this Anatomy.

Anatomy can state the role a Prototype carries within a component family and the structural scope to which that role belongs.

In Switch, Root and Thumb carry the roles Root and Thumb, respectively. Root establishes the scope of the current Switch, and Thumb is recognized as an indicator within that scope. Even when a page contains several Switches, each Root and its Thumbs remain separate rather than being mixed together merely because they use the same Prototype.

The structural semantics become more visible in a complex component such as Select. Root, Trigger, Content, and Item are independent interactive subjects, but they must still be recognized as different parts of the same Select family. Anatomy says who those parts are and how they relate structurally; Context then carries the information they actually exchange.

Anatomy does not create or compose those parts. It will not automatically add a Thumb to Switch or decide where the Maker should place Select Trigger and Content. The real structure must still be established by a Maker, a higher-level system, and the Host. Anatomy only gives the Prototypes that already exist stable structural identities.

Although neither State nor Anatomy is an information channel, they solve different problems. State concerns what one Component preserves between interactions. Anatomy concerns how several Components form a recognizable composite structure.

Both eventually reconnect to information channels. Values stored in State produce external results through Feedback, Expose, or Context. The structural scope established by Anatomy lets capabilities such as Context coordinate the correct Components.

## Lifecycle: How a Prototype Is Established in Time

A component is ultimately a program. Programs run, and execution necessarily unfolds over time.

State changes. Anatomy parts appear, temporarily leave, or are ultimately destroyed. Event and Feedback occur during actual execution. Props and Expose mean different things when they “declare a capability” and when they “handle concrete data for this instance.”

A Prototype must therefore describe not only which semantics exist, but also when they become available, when they occur, and when they end. This is the problem Lifecycle addresses.

### One Setup, a Continuing Runtime

The most important division in Proto UI's lifecycle model is between `setup` and `runtime`:

```text
Proto instance

[ setup once ] → [-------------------- runtime --------------------] → [ dispose complete ]
                  mounted → detached → mounted → … → disposing
```

`setup` is the period in which one particular Proto instance is materialized, and it executes only once. Its governing mode is planning and declaration:

- Declare which Props the Prototype accepts and their defaults. The data actually supplied by the Maker for this run has not yet been read.
- Create State and set its initial defaults. State changes caused by real interaction wait until runtime.
- Declare Event, Feedback, Expose, Context, Anatomy, and finer-grained Lifecycle behavior. Callbacks registered by these declarations execute only when the corresponding runtime situation actually occurs.

After `setup`, the instance enters `runtime`. Its governing mode is handling the concrete circumstances of this run:

- Read the Props supplied by the Maker for this instance.
- Receive real Events and change current State.
- Update Context, emit an Expose signal, or ask existing Feedback to be evaluated again against new facts.
- Respond to finer-grained lifecycle points such as mounting, updating, temporary detachment, and final cleanup.

One point deserves particular emphasis: a State change does not implicitly perform other work. It does not automatically refresh Feedback, update Context, or emit an Expose signal for the Component. The Prototype must state which obligations follow a particular state change.

Temporary detachment of a Host view does not necessarily mean that the Proto instance has died. The same instance may mount, detach temporarily, and mount again. Until disposal completes, all of these stages belong to one runtime, and `setup` does not execute again.

## Returning to Switch Again

From Chapter 1 to this point, we have assembled a substantially complete skeleton for a Prototype description. It can describe not only Switch's relations with the outside world, but also how Switch preserves facts, participates in structure, and runs those semantics over time.

We can now write a definition that is closer to execution than the earlier relation map.

The example below uses TypeScript-style pseudocode rather than quoting the current Proto UI API exactly. It deliberately uses only concepts introduced in the first four chapters and omits Switch capabilities that do not affect this chapter's argument.

```ts
// family and ContextKey are stable identities shared by Root and Thumb.
const SwitchFamily = Anatomy.family('switch', {
  roles: {
    root: { min: 1, max: 1 },
    thumb: { min: 0, max: 'many' },
  },
  relations: [contains('root', 'thumb')],
});

const SwitchContext = Context.key<{
  checked: boolean;
  disabled: boolean;
}>('switch');

const SwitchRoot = Prototype('switch-root', {
  setup(setup) {
    // Anatomy only declares the structural identity of this instance.
    setup.anatomy.claim(SwitchFamily, { role: 'root' });

    setup.props.define<{
      checked?: boolean;
      defaultChecked: boolean;
      disabled: boolean;
    }>();
    setup.props.defaults({
      defaultChecked: false,
      disabled: false,
    });

    // Root is the sole value owner of checked.
    const checked = setup.state.boolean('checked', false);
    const disabled = setup.state.boolean('disabled', false);
    const controlled = setup.state.boolean('controlled', false);

    setup.expose.state('checked', checked);
    setup.expose.event<{ checked: boolean }>('checkedChange');

    setup.context.provide(SwitchContext, {
      checked: false,
      disabled: false,
    });

    // Feedback describes what must be presented. How that reaches the Web,
    // Qt, or another Host is decided later by the translation layer.
    setup.feedback.describe(() => ({
      part: 'root',
      state: checked.get() ? 'on' : 'off',
      disabled: disabled.get(),
    }));

    // State does not implicitly produce outward effects, so subsequent
    // obligations are made explicit here.
    function publish(runtime) {
      runtime.context.update(SwitchContext, {
        checked: checked.get(),
        disabled: disabled.get(),
      });
      runtime.feedback.refresh();
    }

    // This callback is registered during setup and runs only after runtime begins.
    setup.lifecycle.onRuntimeStart((runtime) => {
      controlled.set(runtime.props.isProvided('checked'));
      checked.set(
        controlled.get() ? runtime.props.get('checked') : runtime.props.get('defaultChecked')
      );
      disabled.set(runtime.props.get('disabled'));
      publish(runtime);
    });

    // Keep internal facts synchronized when the Maker later updates a
    // controlled value or disabled.
    setup.props.watch(['checked', 'disabled'], (runtime) => {
      controlled.set(runtime.props.isProvided('checked'));

      if (controlled.get()) {
        checked.set(runtime.props.get('checked'));
      }

      disabled.set(runtime.props.get('disabled'));
      publish(runtime);
    });

    setup.event.on('activate', (runtime) => {
      if (disabled.get()) return;

      const nextChecked = !checked.get();

      // An uncontrolled Switch stores the new value itself. A controlled
      // Switch waits for the Maker to return the final value through checked Props.
      if (!controlled.get()) {
        checked.set(nextChecked);
      }

      runtime.expose.emit('checkedChange', {
        checked: nextChecked,
      });
      publish(runtime);
    });
  },
});

const SwitchThumb = Prototype('switch-thumb', {
  setup(setup) {
    setup.anatomy.claim(SwitchFamily, { role: 'thumb' });

    // Thumb stores derived display state, not the source of truth for the Switch value.
    const checked = setup.state.boolean('checked', false);
    const disabled = setup.state.boolean('disabled', false);

    setup.feedback.describe(() => ({
      part: 'thumb',
      position: checked.get() ? 'on-side' : 'off-side',
      disabled: disabled.get(),
    }));

    function receiveContext(runtime, value) {
      checked.set(value.checked);
      disabled.set(value.disabled);
      runtime.feedback.refresh();
    }

    // subscribe declares the dependency during setup; the callback receives
    // updates during runtime.
    setup.context.subscribe(SwitchContext, (runtime, value) => receiveContext(runtime, value));

    setup.lifecycle.onRuntimeStart((runtime) => {
      receiveContext(runtime, runtime.context.read(SwitchContext));
    });
  },
});
```

> If you want to see what a complete Switch definition looks like, refer to [Proto UI Base Switch](https://github.com/Proto-UI/Proto-UI/tree/main/packages/prototypes/base/src/switch).

The two Prototypes in the pseudocode declare only the interaction obligations and structural identity of Root and Thumb. Root does not create Thumb internally. Actual composition remains the Maker's responsibility:

```ts
AppUI(() => SwitchRoot({ defaultChecked: false }, () => SwitchThumb()));
```

This Maker-side pseudocode could also be expressed through the composition conventions of React, Flutter, Qt, or another higher-level system. Whatever the concrete syntax, Root still owns `checked`, Thumb still receives derived information through Context in the same domain, and the Anatomy roles and relations remain unchanged.

When the User activates an uncontrolled Switch, execution proceeds roughly as follows:

```text
Event activate
  → Root reads checked
  → Root stores nextChecked
  → Root emits checkedChange
  → Root updates Context and requests Feedback reevaluation
  → Thumb receives Context
  → Thumb stores derived display state and requests Feedback reevaluation
```

Every channel in the relation map can now participate in an execution process with internal facts, structural identity, and temporal order.

## How Is a Prototype Translated?

Part I of the whitepaper, “Prototype,” is now drawing to a close. Extracting what can hold across technologies is valuable, but it still does not directly give us a React component, Flutter Widget, or Qt control. We need dedicated translation tools that map a Prototype's obligations to the state system, structural tree, lifecycle, and interaction capabilities of a target technology.

The next chapter opens Part II, “Translation.” It turns to the work outside the Prototype that engineering realization requires: how the translation layer fulfills these semantics, and what should happen when it cannot fulfill them completely.
