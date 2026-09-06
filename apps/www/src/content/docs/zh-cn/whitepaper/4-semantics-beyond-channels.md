---
title: '第四章：通路之外的语义'
description: '用 State、Anatomy 和 Lifecycle 补足内部连续性、复合结构与时间秩序，使 Prototype 接近可执行。'
---

> 如果 information channel 已经组织了组件与外界的关系，为什么一份 Prototype 仍然不能只靠这些通路运行？

## 只有通路还不够

现在，让我们回到已经使用过的 Switch 关系图：

```text
App Maker   --Props { checked, defaultChecked, disabled }--> Switch Root
User        --Event { activate }---------------------------> Switch Root
Switch Root --Expose { checked, checkedChange }------------> App Maker
Switch Root --Context { checked, disabled }----------------> Switch Thumb
Switch Root / Switch Thumb --Feedback----------------------> User
```

这张图可以说明信息从哪里来、到哪里去，却没有说明 Switch 怎样记住自己现在是 on 还是 off。

当 User 完成一次操作，checked 从 false 变为 true。Event 可以把操作传给 Switch，Feedback 可以把结果呈现给 User，Expose 可以把变化报告给 App Maker，Context 也可以把新的值提供给 Thumb。但这些信息再次被发出去之前，Switch 首先需要有一个地方保存“当前是 true”这件事。

这不是任何一条信息通路负责的事情。

## State：保存交互中的内部事实

Proto UI 用 State 描述 Component 在交互过程中需要保留的内部事实。

State 并不增加新的参与者。保存 checked 时，没有谁因为这次保存而成为新的发送者或接收者；它只是让同一个 Component 在前后两次交互之间保持连续。

State 也不会因为值变化，就自动决定变化应该怎样被外界感知。Switch 变成 on 以后，是否改变视觉反馈、是否向 App Maker 报告、是否把值提供给 Thumb，仍然分别属于 Feedback、Expose 和 Context 的责任。

我们可以用 State 与 Context 的协作来说明这种区别：

- State 说明 checked 怎样存在于 Switch Root 内部；
- Context 说明 Root 怎样把自己愿意提供的信息传给 Thumb。

如果没有 State，Root 就没有一个可以在交互中持续变化的内部事实；如果没有 Context，Thumb 也不会因为 Root 恰好保存了 `checked`，就自动得到这个值。

从这个角度看，information channel 是内部事实与其他参与者发生关系的方式。State 不在通路上，却会影响许多通路接下来传递什么。

## Anatomy：描述复合结构

第三章其实给我们留下了另一个问题。

按照信息通路划分边界后，每一个独立 Component 都是一个交互主体。不过，完整的交互任务经常需要多个交互主体协作完成，Switch 的 Root 与 Thumb、Select 的 Root、Trigger、Content 与 Item 都是如此。

Component Author 需要说明这些主体，预期形成怎样的结构；但实际把它们放进 UI、选择使用哪些 part、怎样排列和组合，通常是 Maker 的工作。

如果 Prototype 直接创建并嵌套其他 Prototype，组合方式就会被写死在定义中。Maker 会失去调整结构的机会，Prototype 也不得不假设目标技术如何创建、嵌套和调度组件。不同技术并没有一套共同的组件组装方式，这种假设反而会削弱可移植性。

因此，Prototype 需要一种能够声明结构期望、却不会亲自操纵实际结构的能力。Proto UI 把它称为 Anatomy。

Anatomy 可以说明，某个 Prototype 在一个组件 family 中承担什么 role，以及这些 role 属于哪一个结构范围。

在 Switch 中，Root 和 Thumb 分别承担 Root 与 Thumb。Root 划定当前 Switch 的结构范围，Thumb 在这个范围内被识别为 indicator。这样，即使页面上同时存在多个 Switch，每组 Root 和 Thumb 也不会因为使用了同一种 Prototype 就混在一起。

如果换成更复杂的 Select，这种结构语义会更明显：Root、Trigger、Content 和 Item 都是独立的交互主体，但它们仍然需要被识别为同一个 Select family 的不同部分。Anatomy 描述这些部分分别是谁、彼此处于什么结构关系；Context 再负责它们实际交换的信息。

Anatomy 并不负责把这些部分创建或组装出来。它不会自动给 Switch 补上一个 Thumb，也不会替 Maker 决定 Select 的 Trigger 和 Content 应该放在哪里。真实结构仍然需要由 Maker、上层系统和 Host 建立；Anatomy 只是让已经存在的多个 Prototype 拥有稳定的结构身份。

因此，State 和 Anatomy 虽然都不属于 information channel，解决的却是不同问题：State 关注一个 Component 在交互之间保留了什么，Anatomy 关注多个 Component 怎样形成一个可以被识别的复合结构。

它们最终仍然会回到信息通路。State 中保存的值会通过 Feedback、Expose 或 Context 产生外部结果；Anatomy 划定的结构范围，则让 Context 等能力可以在正确的 Component 之间完成协作。

## Lifecycle：原型如何在时间中建立

组件毕竟是一段程序，程序要运行，而运行必定伴随时间。

State 会变化，Anatomy part 会出现、暂时离开或最终销毁；Event 和 Feedback 要在实际运行中发生，Props 和 Expose 在“声明一种能力”与“处理这个 instance 的具体数据”时也有不同的意义。

所以，一份 Prototype 不只要描述“有什么语义”，还要说明这些语义从什么时候开始可用、在什么时候发生，又在什么时候结束。这就是 Lifecycle 要解决的问题。

### 一次 setup，持续 runtime

Proto UI 生命周期模型中最重要的切分，是 `setup` 与 `runtime`：

```text
Proto instance

[ setup once ] → [-------------------- runtime --------------------] → [ dispose complete ]
                  mounted → detached → mounted → … → disposing
```

`setup` 是某一个具体 Proto instance 被物化的时期，并且只执行一次。它的主基调是“计划与声明”：

- 声明 Prototype 可以接受哪些 Props，以及它们的默认值；此时还没有读取本次运行中 Maker 实际传入的数据；
- 创建 State 并设置初始默认值；真实交互造成的状态变化要等到 runtime；
- 声明 Event、Feedback、Expose、Context、Anatomy 与更细的 Lifecycle 行为；这些声明中的 callback 要等到对应的 runtime 情况实际发生后才执行。

`setup` 结束以后，instance 进入 `runtime`。它的主基调是“处理这一次运行的具体情况”：

- 读取 Maker 为这个 instance 提供的 Props；
- 接收真实 Event，并改变当前 State；
- 更新 Context、发出 Expose signal，或者要求既有的 Feedback 根据新事实重新求值；
- 响应挂载、更新、暂时脱离和最终清理等更细的生命周期节点。

这里需要特别注意，State 的变化本身不会隐式完成其他工作。它不会自动刷新 Feedback、更新 Context 或替 Component 发出 Expose signal；Prototype 必须明确说明一次状态变化之后还要履行哪些义务。

Host view 暂时 detached，也不一定表示 Proto instance 已经死亡。同一个 instance 可以经历挂载、暂时离开和再次挂载，只要它还没有完成 disposal，这些过程就仍然属于同一段 runtime，`setup` 也不会再执行一次。

## 再回到 Switch

从第一章到这里，我们已经得到了一份基本完整的原型描述骨架。它不仅能描述 Switch 与外界有哪些关系，也能说明 Switch 如何保留事实、如何参与结构，以及这些语义如何在时间中运行。

因此，我们现在可以写出比关系图更接近执行的定义。

下面使用的是 TypeScript 风格的伪代码，并非完全引用当前的 Proto UI API。它故意只使用前四章已经介绍过的概念，也省略了不影响本章论证的 Switch 能力。

```ts
// family 和 ContextKey 是 Root 与 Thumb 共享的稳定身份。
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
    // Anatomy 只声明当前 instance 的结构身份。
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

    // Root 是 checked 的唯一 value owner。
    const checked = setup.state.boolean('checked', false);
    const disabled = setup.state.boolean('disabled', false);
    const controlled = setup.state.boolean('controlled', false);

    setup.expose.state('checked', checked);
    setup.expose.event<{ checked: boolean }>('checkedChange');

    setup.context.provide(SwitchContext, {
      checked: false,
      disabled: false,
    });

    // Feedback 描述“要呈现什么”。具体怎样落到 Web、Qt 或其他
    // Host，要等翻译层决定。
    setup.feedback.describe(() => ({
      part: 'root',
      state: checked.get() ? 'on' : 'off',
      disabled: disabled.get(),
    }));

    // State 不会隐式产生外部效果，所以把后续义务明确写出来。
    function publish(runtime) {
      runtime.context.update(SwitchContext, {
        checked: checked.get(),
        disabled: disabled.get(),
      });
      runtime.feedback.refresh();
    }

    // 这段 callback 在 setup 时登记，在 runtime 开始后才执行。
    setup.lifecycle.onRuntimeStart((runtime) => {
      controlled.set(runtime.props.isProvided('checked'));
      checked.set(
        controlled.get() ? runtime.props.get('checked') : runtime.props.get('defaultChecked')
      );
      disabled.set(runtime.props.get('disabled'));
      publish(runtime);
    });

    // Maker 后续更新受控值或 disabled 时，同步内部事实。
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

      // 非受控 Switch 自己保存新值；受控 Switch 等待 Maker
      // 通过 checked Props 回传最终值。
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

    // Thumb 保存的只是派生展示状态，不是 Switch value 的真理之源。
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

    // subscribe 在 setup 中声明依赖；callback 在 runtime 收到更新。
    setup.context.subscribe(SwitchContext, (runtime, value) => receiveContext(runtime, value));

    setup.lifecycle.onRuntimeStart((runtime) => {
      receiveContext(runtime, runtime.context.read(SwitchContext));
    });
  },
});
```

> 如果你很在意完整的 Switch 定义是怎样的，可以参考这里 [Proto UI Base Switch](https://github.com/Proto-UI/Proto-UI/tree/main/packages/prototypes/base/src/switch)

伪代码中的两份 Prototype 只声明了 Root 与 Thumb 各自的交互义务和结构身份，并没有在 Root 内部创建 Thumb。实际组合仍然由 Maker 完成：

```ts
AppUI(() => SwitchRoot({ defaultChecked: false }, () => SwitchThumb()));
```

这段 Maker 侧伪代码也可以分别用 React、Flutter、Qt 或其他上层系统所习惯的组装方式表达。无论具体语法怎样变化，Root 仍然拥有 `checked`，Thumb 仍然通过同一 domain 的 Context 获得派生信息，Anatomy 的 role 与 relation 也没有改变。

如果 User 激活一个非受控 Switch，执行过程大致是：

```text
Event activate
  → Root 读取 checked
  → Root 保存 nextChecked
  → Root 发出 checkedChange
  → Root 更新 Context，并请求 Feedback 重新求值
  → Thumb 收到 Context
  → Thumb 保存派生展示状态，并请求 Feedback 重新求值
```

至此，关系图中的每一条通路，都已经能够落到一个有内部事实、有结构身份、也有时间秩序的执行过程里。

## 原型如何翻译？

白皮书的第一部分“原型”已经进入尾声。现在能够把跨技术成立的部分抽离出来，这很棒，不过还不够，因为这并不能直接得到 React 组件、Flutter Widget 或 Qt 控件。我们还需要专门的翻译工具，把 Prototype 描述的义务映射到目标技术的状态系统、结构树、生命周期和交互能力上。

下一章开始，我们会进入白皮书的第二部分“翻译”，我们会讨论工程落地所必须的 Prototype 之外的工作：翻译层如何兑现这些语义，以及无法完整兑现时应该怎样处理。
