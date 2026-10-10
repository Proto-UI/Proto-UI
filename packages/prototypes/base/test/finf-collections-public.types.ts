// Compile-only public consumer regressions. Every family has independent positive and negative checks.
import type { ProtoAdapterProps, ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { ExposeOf, ExposeEvent } from '@proto.ui/core';
import * as f0c0 from '../../base/src/tree';
import * as f0c1 from '../../base/src/message-scroller';
import * as f0c2 from '../../base/src/virtual-list';
import * as f0c3 from '../../base/src/data-table';
import * as f1c0 from '../../shadcn/src/tree';
import * as f1c1 from '../../shadcn/src/message-scroller';
import * as f1c2 from '../../shadcn/src/virtual-list';
import * as f1c3 from '../../shadcn/src/data-table';
import * as f2c0 from '../../brutalist/src/tree';
import * as f2c1 from '../../brutalist/src/message-scroller';
import * as f2c2 from '../../brutalist/src/virtual-list';
import * as f2c3 from '../../brutalist/src/data-table';
import * as f3c0 from '../../bootstrap-2-3-2/src/tree';
import * as f3c1 from '../../bootstrap-2-3-2/src/message-scroller';
import * as f3c2 from '../../bootstrap-2-3-2/src/virtual-list';
import * as f3c3 from '../../bootstrap-2-3-2/src/data-table';
import * as f4c0 from '../../liquid-glass/src/tree';
import * as f4c1 from '../../liquid-glass/src/message-scroller';
import * as f4c2 from '../../liquid-glass/src/virtual-list';
import * as f4c3 from '../../liquid-glass/src/data-table';
type Assert<T extends true> = T;
type NotAny<T> = 0 extends 1 & T ? false : true;

{
  type P = ProtoAdapterProps<typeof f0c0.treeRoot>;
  type E = ExposeOf<typeof f0c0.treeRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { value: 'a', expandedKeys: ['a'] };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { value: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c0.treeRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const selected: boolean = x.requestValue('a');
  x.requestExpanded('a', true);
  const count: number = x.count.get();
  const nodes = x.getTree();
  const key: string | undefined = nodes[0]?.key;
  x.getCollectionItems();
  // @ts-expect-error selection key is a string
  x.requestValue(1);
  // @ts-expect-error expansion is boolean
  x.requestExpanded('a', 'yes');
}

{
  type P = ProtoAdapterProps<typeof f0c0.treeItem>;
  type E = ExposeOf<typeof f0c0.treeItem>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: 3 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c0.treeItem>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf({ reason: 'keyboard' });
  const value: boolean = x.selected.get();
  const index: number = x.collectionIndex.get();
  const key: string = x.getNode().key;
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
  // @ts-expect-error boolean state is not a number
  const wrong: number = x.selected.get();
}

{
  type P = ProtoAdapterProps<typeof f0c0.treeGroup>;
  type E = ExposeOf<typeof f0c0.treeGroup>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: true };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c0.treeGroup>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f0c0.treeToggle>;
  type E = ExposeOf<typeof f0c0.treeToggle>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c0.treeToggle>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const disabled: boolean = x.disabled.get();
  // @ts-expect-error event signals are not instance methods
  x.click();
}

{
  type P = ProtoAdapterProps<typeof f0c1.messageScrollerRoot>;
  type E = ExposeOf<typeof f0c1.messageScrollerRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { newContentCount: 3 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { newContentCount: '3' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c1.messageScrollerRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f0c1.messageScrollerViewport>;
  type E = ExposeOf<typeof f0c1.messageScrollerViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c1.messageScrollerViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.jumpToEnd();
  const following: 'off' | 'pending' | 'following' | 'paused' = x.following.get();
  const status: 'idle' | 'pending' | 'applied' | 'rejected' = x.requestStatus.get();
  const focused: boolean = x.focused.get();
  const position: number = x.scrollYPosition.get();
  // @ts-expect-error jump takes no destination argument
  x.jumpToEnd(3);
  // @ts-expect-error scroll state is numeric
  const wrong: string = x.scrollYPosition.get();
}

{
  type P = ProtoAdapterProps<typeof f0c1.messageScrollerJump>;
  type E = ExposeOf<typeof f0c1.messageScrollerJump>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c1.messageScrollerJump>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const count: number = x.newContentCount.get();
  const end: boolean = x.atEnd.get();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
}

{
  type P = ProtoAdapterProps<typeof f0c2.virtualListRoot>;
  type E = ExposeOf<typeof f0c2.virtualListRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { itemKeys: ['a'], overscanItems: 2 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { itemKeys: [3] };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c2.virtualListRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const count: number = x.logicalCount.get();
  const window = x.getWindow();
  const status: 'idle' | 'requesting' | 'committed' | 'unavailable' = window.status;
  x.getCollection().propose(0, 1);
  // @ts-expect-error item range is numeric
  x.getCollection().propose('0', 1);
  // @ts-expect-error logical count is numeric
  const wrong: string = x.logicalCount.get();
}

{
  type P = ProtoAdapterProps<typeof f0c2.virtualListViewport>;
  type E = ExposeOf<typeof f0c2.virtualListViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c2.virtualListViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const focused: boolean = x.focusVisible.get();
  const scrollable: boolean = x.canScrollDown.get();
  // @ts-expect-error message-only command is not inherited by Virtual List
  x.jumpToEnd();
}

{
  type P = ProtoAdapterProps<typeof f0c2.virtualListContent>;
  type E = ExposeOf<typeof f0c2.virtualListContent>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c2.virtualListContent>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableRoot>;
  type E = ExposeOf<typeof f0c3.dataTableRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { rows: [{ id: 'a', score: 2 }], sortDirection: 'ascending' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { sortDirection: 'up' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const accepted: boolean = x.requestPage(2);
  x.requestSort('score');
  x.requestSelection('a');
  x.getStructure();
  x.getCollectionCount();
  const value: string | number | boolean | null | undefined = x.getRecord('a')?.score;
  // @ts-expect-error page is numeric
  x.requestPage('2');
  // @ts-expect-error row key is string
  x.requestSelection(3);
  // @ts-expect-error sort signals are not adapter instance methods
  x.sortChange();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableRow>;
  type E = ExposeOf<typeof f0c3.dataTableRow>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { index: 0, header: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { index: '0' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableRow>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const key: string = x.rowKey.get();
  const selected: boolean = x.selected.get();
  x.getCollectionItem();
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error hidden is an internal hook state, not an expose
  x.hidden.get();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableCell>;
  type E = ExposeOf<typeof f0c3.dataTableCell>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { columnKey: 'score', headers: ['score'], rowSpan: 2, columnSpan: 1 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { rowSpan: '2' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableCell>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.displayValue.get();
  // @ts-expect-error rendered cell value is string
  const wrong: number = x.displayValue.get();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableHeader>;
  type E = ExposeOf<typeof f0c3.dataTableHeader>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {
    headerKey: 'score',
    headerKind: 'column',
    headers: ['score'],
    rowSpan: 2,
    columnSpan: 1,
  };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { headerKind: 'both' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableHeader>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.sort.get();
  // @ts-expect-error focus facts are not exposed by Data Table Header
  x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableCaption>;
  type E = ExposeOf<typeof f0c3.dataTableCaption>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableCaption>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTablePrevious>;
  type E = ExposeOf<typeof f0c3.dataTablePrevious>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTablePrevious>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f0c3.dataTableNext>;
  type E = ExposeOf<typeof f0c3.dataTableNext>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 'no' };
  const x = null as unknown as ProtoAdapterExposes<typeof f0c3.dataTableNext>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.disabled.get();
}

{
  type P = ProtoAdapterProps<typeof f1c0.treeRoot>;
  type E = ExposeOf<typeof f1c0.treeRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { value: 'a', expandedKeys: ['a'] };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { value: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c0.treeRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const selected: boolean = x.requestValue('a');
  x.requestExpanded('a', true);
  const count: number = x.count.get();
  const nodes = x.getTree();
  const key: string | undefined = nodes[0]?.key;
  x.getCollectionItems();
  // @ts-expect-error selection key is a string
  x.requestValue(1);
  // @ts-expect-error expansion is boolean
  x.requestExpanded('a', 'yes');
}

{
  type P = ProtoAdapterProps<typeof f1c0.treeItem>;
  type E = ExposeOf<typeof f1c0.treeItem>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: 3 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c0.treeItem>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf({ reason: 'keyboard' });
  const value: boolean = x.selected.get();
  const index: number = x.collectionIndex.get();
  const key: string = x.getNode().key;
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
  // @ts-expect-error boolean state is not a number
  const wrong: number = x.selected.get();
}

{
  type P = ProtoAdapterProps<typeof f1c0.treeGroup>;
  type E = ExposeOf<typeof f1c0.treeGroup>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: true };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c0.treeGroup>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f1c0.treeToggle>;
  type E = ExposeOf<typeof f1c0.treeToggle>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c0.treeToggle>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const disabled: boolean = x.disabled.get();
  // @ts-expect-error event signals are not instance methods
  x.click();
}

{
  type P = ProtoAdapterProps<typeof f1c1.messageScrollerRoot>;
  type E = ExposeOf<typeof f1c1.messageScrollerRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { newContentCount: 3 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { newContentCount: '3' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c1.messageScrollerRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f1c1.messageScrollerViewport>;
  type E = ExposeOf<typeof f1c1.messageScrollerViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c1.messageScrollerViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.jumpToEnd();
  const following: 'off' | 'pending' | 'following' | 'paused' = x.following.get();
  const status: 'idle' | 'pending' | 'applied' | 'rejected' = x.requestStatus.get();
  const focused: boolean = x.focused.get();
  const position: number = x.scrollYPosition.get();
  // @ts-expect-error jump takes no destination argument
  x.jumpToEnd(3);
  // @ts-expect-error scroll state is numeric
  const wrong: string = x.scrollYPosition.get();
}

{
  type P = ProtoAdapterProps<typeof f1c1.messageScrollerJump>;
  type E = ExposeOf<typeof f1c1.messageScrollerJump>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c1.messageScrollerJump>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const count: number = x.newContentCount.get();
  const end: boolean = x.atEnd.get();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
}

{
  type P = ProtoAdapterProps<typeof f1c2.virtualListRoot>;
  type E = ExposeOf<typeof f1c2.virtualListRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { itemKeys: ['a'], overscanItems: 2 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { itemKeys: [3] };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c2.virtualListRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const count: number = x.logicalCount.get();
  const window = x.getWindow();
  const status: 'idle' | 'requesting' | 'committed' | 'unavailable' = window.status;
  x.getCollection().propose(0, 1);
  // @ts-expect-error item range is numeric
  x.getCollection().propose('0', 1);
  // @ts-expect-error logical count is numeric
  const wrong: string = x.logicalCount.get();
}

{
  type P = ProtoAdapterProps<typeof f1c2.virtualListViewport>;
  type E = ExposeOf<typeof f1c2.virtualListViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c2.virtualListViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const focused: boolean = x.focusVisible.get();
  const scrollable: boolean = x.canScrollDown.get();
  // @ts-expect-error message-only command is not inherited by Virtual List
  x.jumpToEnd();
}

{
  type P = ProtoAdapterProps<typeof f1c2.virtualListContent>;
  type E = ExposeOf<typeof f1c2.virtualListContent>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c2.virtualListContent>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableRoot>;
  type E = ExposeOf<typeof f1c3.dataTableRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { rows: [{ id: 'a', score: 2 }], sortDirection: 'ascending' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { sortDirection: 'up' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const accepted: boolean = x.requestPage(2);
  x.requestSort('score');
  x.requestSelection('a');
  x.getStructure();
  x.getCollectionCount();
  const value: string | number | boolean | null | undefined = x.getRecord('a')?.score;
  // @ts-expect-error page is numeric
  x.requestPage('2');
  // @ts-expect-error row key is string
  x.requestSelection(3);
  // @ts-expect-error sort signals are not adapter instance methods
  x.sortChange();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableRow>;
  type E = ExposeOf<typeof f1c3.dataTableRow>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { index: 0, header: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { index: '0' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableRow>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const key: string = x.rowKey.get();
  const selected: boolean = x.selected.get();
  x.getCollectionItem();
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error hidden is an internal hook state, not an expose
  x.hidden.get();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableCell>;
  type E = ExposeOf<typeof f1c3.dataTableCell>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { columnKey: 'score', headers: ['score'], rowSpan: 2, columnSpan: 1 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { rowSpan: '2' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableCell>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.displayValue.get();
  // @ts-expect-error rendered cell value is string
  const wrong: number = x.displayValue.get();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableHeader>;
  type E = ExposeOf<typeof f1c3.dataTableHeader>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {
    headerKey: 'score',
    headerKind: 'column',
    headers: ['score'],
    rowSpan: 2,
    columnSpan: 1,
  };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { headerKind: 'both' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableHeader>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.sort.get();
  // @ts-expect-error focus facts are not exposed by Data Table Header
  x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableCaption>;
  type E = ExposeOf<typeof f1c3.dataTableCaption>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableCaption>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTablePrevious>;
  type E = ExposeOf<typeof f1c3.dataTablePrevious>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTablePrevious>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f1c3.dataTableNext>;
  type E = ExposeOf<typeof f1c3.dataTableNext>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 'no' };
  const x = null as unknown as ProtoAdapterExposes<typeof f1c3.dataTableNext>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.disabled.get();
}

{
  type P = ProtoAdapterProps<typeof f2c0.treeRoot>;
  type E = ExposeOf<typeof f2c0.treeRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { value: 'a', expandedKeys: ['a'] };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { value: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c0.treeRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const selected: boolean = x.requestValue('a');
  x.requestExpanded('a', true);
  const count: number = x.count.get();
  const nodes = x.getTree();
  const key: string | undefined = nodes[0]?.key;
  x.getCollectionItems();
  // @ts-expect-error selection key is a string
  x.requestValue(1);
  // @ts-expect-error expansion is boolean
  x.requestExpanded('a', 'yes');
}

{
  type P = ProtoAdapterProps<typeof f2c0.treeItem>;
  type E = ExposeOf<typeof f2c0.treeItem>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: 3 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c0.treeItem>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf({ reason: 'keyboard' });
  const value: boolean = x.selected.get();
  const index: number = x.collectionIndex.get();
  const key: string = x.getNode().key;
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
  // @ts-expect-error boolean state is not a number
  const wrong: number = x.selected.get();
}

{
  type P = ProtoAdapterProps<typeof f2c0.treeGroup>;
  type E = ExposeOf<typeof f2c0.treeGroup>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: true };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c0.treeGroup>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f2c0.treeToggle>;
  type E = ExposeOf<typeof f2c0.treeToggle>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c0.treeToggle>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const disabled: boolean = x.disabled.get();
  // @ts-expect-error event signals are not instance methods
  x.click();
}

{
  type P = ProtoAdapterProps<typeof f2c1.messageScrollerRoot>;
  type E = ExposeOf<typeof f2c1.messageScrollerRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { newContentCount: 3 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { newContentCount: '3' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c1.messageScrollerRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f2c1.messageScrollerViewport>;
  type E = ExposeOf<typeof f2c1.messageScrollerViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c1.messageScrollerViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.jumpToEnd();
  const following: 'off' | 'pending' | 'following' | 'paused' = x.following.get();
  const status: 'idle' | 'pending' | 'applied' | 'rejected' = x.requestStatus.get();
  const focused: boolean = x.focused.get();
  const position: number = x.scrollYPosition.get();
  // @ts-expect-error jump takes no destination argument
  x.jumpToEnd(3);
  // @ts-expect-error scroll state is numeric
  const wrong: string = x.scrollYPosition.get();
}

{
  type P = ProtoAdapterProps<typeof f2c1.messageScrollerJump>;
  type E = ExposeOf<typeof f2c1.messageScrollerJump>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c1.messageScrollerJump>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const count: number = x.newContentCount.get();
  const end: boolean = x.atEnd.get();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
}

{
  type P = ProtoAdapterProps<typeof f2c2.virtualListRoot>;
  type E = ExposeOf<typeof f2c2.virtualListRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { itemKeys: ['a'], overscanItems: 2 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { itemKeys: [3] };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c2.virtualListRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const count: number = x.logicalCount.get();
  const window = x.getWindow();
  const status: 'idle' | 'requesting' | 'committed' | 'unavailable' = window.status;
  x.getCollection().propose(0, 1);
  // @ts-expect-error item range is numeric
  x.getCollection().propose('0', 1);
  // @ts-expect-error logical count is numeric
  const wrong: string = x.logicalCount.get();
}

{
  type P = ProtoAdapterProps<typeof f2c2.virtualListViewport>;
  type E = ExposeOf<typeof f2c2.virtualListViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c2.virtualListViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const focused: boolean = x.focusVisible.get();
  const scrollable: boolean = x.canScrollDown.get();
  // @ts-expect-error message-only command is not inherited by Virtual List
  x.jumpToEnd();
}

{
  type P = ProtoAdapterProps<typeof f2c2.virtualListContent>;
  type E = ExposeOf<typeof f2c2.virtualListContent>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c2.virtualListContent>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableRoot>;
  type E = ExposeOf<typeof f2c3.dataTableRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { rows: [{ id: 'a', score: 2 }], sortDirection: 'ascending' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { sortDirection: 'up' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const accepted: boolean = x.requestPage(2);
  x.requestSort('score');
  x.requestSelection('a');
  x.getStructure();
  x.getCollectionCount();
  const value: string | number | boolean | null | undefined = x.getRecord('a')?.score;
  // @ts-expect-error page is numeric
  x.requestPage('2');
  // @ts-expect-error row key is string
  x.requestSelection(3);
  // @ts-expect-error sort signals are not adapter instance methods
  x.sortChange();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableRow>;
  type E = ExposeOf<typeof f2c3.dataTableRow>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { index: 0, header: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { index: '0' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableRow>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const key: string = x.rowKey.get();
  const selected: boolean = x.selected.get();
  x.getCollectionItem();
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error hidden is an internal hook state, not an expose
  x.hidden.get();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableCell>;
  type E = ExposeOf<typeof f2c3.dataTableCell>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { columnKey: 'score', headers: ['score'], rowSpan: 2, columnSpan: 1 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { rowSpan: '2' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableCell>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.displayValue.get();
  // @ts-expect-error rendered cell value is string
  const wrong: number = x.displayValue.get();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableHeader>;
  type E = ExposeOf<typeof f2c3.dataTableHeader>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {
    headerKey: 'score',
    headerKind: 'column',
    headers: ['score'],
    rowSpan: 2,
    columnSpan: 1,
  };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { headerKind: 'both' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableHeader>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.sort.get();
  // @ts-expect-error focus facts are not exposed by Data Table Header
  x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableCaption>;
  type E = ExposeOf<typeof f2c3.dataTableCaption>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableCaption>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTablePrevious>;
  type E = ExposeOf<typeof f2c3.dataTablePrevious>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTablePrevious>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f2c3.dataTableNext>;
  type E = ExposeOf<typeof f2c3.dataTableNext>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 'no' };
  const x = null as unknown as ProtoAdapterExposes<typeof f2c3.dataTableNext>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.disabled.get();
}

{
  type P = ProtoAdapterProps<typeof f3c0.treeRoot>;
  type E = ExposeOf<typeof f3c0.treeRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { value: 'a', expandedKeys: ['a'] };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { value: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c0.treeRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const selected: boolean = x.requestValue('a');
  x.requestExpanded('a', true);
  const count: number = x.count.get();
  const nodes = x.getTree();
  const key: string | undefined = nodes[0]?.key;
  x.getCollectionItems();
  // @ts-expect-error selection key is a string
  x.requestValue(1);
  // @ts-expect-error expansion is boolean
  x.requestExpanded('a', 'yes');
}

{
  type P = ProtoAdapterProps<typeof f3c0.treeItem>;
  type E = ExposeOf<typeof f3c0.treeItem>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: 3 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c0.treeItem>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf({ reason: 'keyboard' });
  const value: boolean = x.selected.get();
  const index: number = x.collectionIndex.get();
  const key: string = x.getNode().key;
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
  // @ts-expect-error boolean state is not a number
  const wrong: number = x.selected.get();
}

{
  type P = ProtoAdapterProps<typeof f3c0.treeGroup>;
  type E = ExposeOf<typeof f3c0.treeGroup>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: true };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c0.treeGroup>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f3c0.treeToggle>;
  type E = ExposeOf<typeof f3c0.treeToggle>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c0.treeToggle>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const disabled: boolean = x.disabled.get();
  // @ts-expect-error event signals are not instance methods
  x.click();
}

{
  type P = ProtoAdapterProps<typeof f3c1.messageScrollerRoot>;
  type E = ExposeOf<typeof f3c1.messageScrollerRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { newContentCount: 3 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { newContentCount: '3' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c1.messageScrollerRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f3c1.messageScrollerViewport>;
  type E = ExposeOf<typeof f3c1.messageScrollerViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c1.messageScrollerViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.jumpToEnd();
  const following: 'off' | 'pending' | 'following' | 'paused' = x.following.get();
  const status: 'idle' | 'pending' | 'applied' | 'rejected' = x.requestStatus.get();
  const focused: boolean = x.focused.get();
  const position: number = x.scrollYPosition.get();
  // @ts-expect-error jump takes no destination argument
  x.jumpToEnd(3);
  // @ts-expect-error scroll state is numeric
  const wrong: string = x.scrollYPosition.get();
}

{
  type P = ProtoAdapterProps<typeof f3c1.messageScrollerJump>;
  type E = ExposeOf<typeof f3c1.messageScrollerJump>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c1.messageScrollerJump>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const count: number = x.newContentCount.get();
  const end: boolean = x.atEnd.get();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
}

{
  type P = ProtoAdapterProps<typeof f3c2.virtualListRoot>;
  type E = ExposeOf<typeof f3c2.virtualListRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { itemKeys: ['a'], overscanItems: 2 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { itemKeys: [3] };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c2.virtualListRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const count: number = x.logicalCount.get();
  const window = x.getWindow();
  const status: 'idle' | 'requesting' | 'committed' | 'unavailable' = window.status;
  x.getCollection().propose(0, 1);
  // @ts-expect-error item range is numeric
  x.getCollection().propose('0', 1);
  // @ts-expect-error logical count is numeric
  const wrong: string = x.logicalCount.get();
}

{
  type P = ProtoAdapterProps<typeof f3c2.virtualListViewport>;
  type E = ExposeOf<typeof f3c2.virtualListViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c2.virtualListViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const focused: boolean = x.focusVisible.get();
  const scrollable: boolean = x.canScrollDown.get();
  // @ts-expect-error message-only command is not inherited by Virtual List
  x.jumpToEnd();
}

{
  type P = ProtoAdapterProps<typeof f3c2.virtualListContent>;
  type E = ExposeOf<typeof f3c2.virtualListContent>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c2.virtualListContent>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableRoot>;
  type E = ExposeOf<typeof f3c3.dataTableRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { rows: [{ id: 'a', score: 2 }], sortDirection: 'ascending' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { sortDirection: 'up' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const accepted: boolean = x.requestPage(2);
  x.requestSort('score');
  x.requestSelection('a');
  x.getStructure();
  x.getCollectionCount();
  const value: string | number | boolean | null | undefined = x.getRecord('a')?.score;
  // @ts-expect-error page is numeric
  x.requestPage('2');
  // @ts-expect-error row key is string
  x.requestSelection(3);
  // @ts-expect-error sort signals are not adapter instance methods
  x.sortChange();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableRow>;
  type E = ExposeOf<typeof f3c3.dataTableRow>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { index: 0, header: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { index: '0' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableRow>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const key: string = x.rowKey.get();
  const selected: boolean = x.selected.get();
  x.getCollectionItem();
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error hidden is an internal hook state, not an expose
  x.hidden.get();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableCell>;
  type E = ExposeOf<typeof f3c3.dataTableCell>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { columnKey: 'score', headers: ['score'], rowSpan: 2, columnSpan: 1 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { rowSpan: '2' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableCell>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.displayValue.get();
  // @ts-expect-error rendered cell value is string
  const wrong: number = x.displayValue.get();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableHeader>;
  type E = ExposeOf<typeof f3c3.dataTableHeader>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {
    headerKey: 'score',
    headerKind: 'column',
    headers: ['score'],
    rowSpan: 2,
    columnSpan: 1,
  };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { headerKind: 'both' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableHeader>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.sort.get();
  // @ts-expect-error focus facts are not exposed by Data Table Header
  x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableCaption>;
  type E = ExposeOf<typeof f3c3.dataTableCaption>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableCaption>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTablePrevious>;
  type E = ExposeOf<typeof f3c3.dataTablePrevious>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTablePrevious>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f3c3.dataTableNext>;
  type E = ExposeOf<typeof f3c3.dataTableNext>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 'no' };
  const x = null as unknown as ProtoAdapterExposes<typeof f3c3.dataTableNext>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.disabled.get();
}

{
  type P = ProtoAdapterProps<typeof f4c0.treeRoot>;
  type E = ExposeOf<typeof f4c0.treeRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { value: 'a', expandedKeys: ['a'] };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { value: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c0.treeRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const selected: boolean = x.requestValue('a');
  x.requestExpanded('a', true);
  const count: number = x.count.get();
  const nodes = x.getTree();
  const key: string | undefined = nodes[0]?.key;
  x.getCollectionItems();
  // @ts-expect-error selection key is a string
  x.requestValue(1);
  // @ts-expect-error expansion is boolean
  x.requestExpanded('a', 'yes');
}

{
  type P = ProtoAdapterProps<typeof f4c0.treeItem>;
  type E = ExposeOf<typeof f4c0.treeItem>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: 3 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c0.treeItem>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf({ reason: 'keyboard' });
  const value: boolean = x.selected.get();
  const index: number = x.collectionIndex.get();
  const key: string = x.getNode().key;
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
  // @ts-expect-error boolean state is not a number
  const wrong: number = x.selected.get();
}

{
  type P = ProtoAdapterProps<typeof f4c0.treeGroup>;
  type E = ExposeOf<typeof f4c0.treeGroup>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { nodeKey: true };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c0.treeGroup>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f4c0.treeToggle>;
  type E = ExposeOf<typeof f4c0.treeToggle>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { nodeKey: 'a', disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c0.treeToggle>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const disabled: boolean = x.disabled.get();
  // @ts-expect-error event signals are not instance methods
  x.click();
}

{
  type P = ProtoAdapterProps<typeof f4c1.messageScrollerRoot>;
  type E = ExposeOf<typeof f4c1.messageScrollerRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { newContentCount: 3 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { newContentCount: '3' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c1.messageScrollerRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f4c1.messageScrollerViewport>;
  type E = ExposeOf<typeof f4c1.messageScrollerViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c1.messageScrollerViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.jumpToEnd();
  const following: 'off' | 'pending' | 'following' | 'paused' = x.following.get();
  const status: 'idle' | 'pending' | 'applied' | 'rejected' = x.requestStatus.get();
  const focused: boolean = x.focused.get();
  const position: number = x.scrollYPosition.get();
  // @ts-expect-error jump takes no destination argument
  x.jumpToEnd(3);
  // @ts-expect-error scroll state is numeric
  const wrong: string = x.scrollYPosition.get();
}

{
  type P = ProtoAdapterProps<typeof f4c1.messageScrollerJump>;
  type E = ExposeOf<typeof f4c1.messageScrollerJump>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c1.messageScrollerJump>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const count: number = x.newContentCount.get();
  const end: boolean = x.atEnd.get();
  // @ts-expect-error invalid focus reason
  x.focusSelf({ reason: 'invalid' });
}

{
  type P = ProtoAdapterProps<typeof f4c2.virtualListRoot>;
  type E = ExposeOf<typeof f4c2.virtualListRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { itemKeys: ['a'], overscanItems: 2 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { itemKeys: [3] };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c2.virtualListRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const count: number = x.logicalCount.get();
  const window = x.getWindow();
  const status: 'idle' | 'requesting' | 'committed' | 'unavailable' = window.status;
  x.getCollection().propose(0, 1);
  // @ts-expect-error item range is numeric
  x.getCollection().propose('0', 1);
  // @ts-expect-error logical count is numeric
  const wrong: string = x.logicalCount.get();
}

{
  type P = ProtoAdapterProps<typeof f4c2.virtualListViewport>;
  type E = ExposeOf<typeof f4c2.virtualListViewport>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c2.virtualListViewport>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const focused: boolean = x.focusVisible.get();
  const scrollable: boolean = x.canScrollDown.get();
  // @ts-expect-error message-only command is not inherited by Virtual List
  x.jumpToEnd();
}

{
  type P = ProtoAdapterProps<typeof f4c2.virtualListContent>;
  type E = ExposeOf<typeof f4c2.virtualListContent>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c2.virtualListContent>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableRoot>;
  type E = ExposeOf<typeof f4c3.dataTableRoot>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { rows: [{ id: 'a', score: 2 }], sortDirection: 'ascending' };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { sortDirection: 'up' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableRoot>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const accepted: boolean = x.requestPage(2);
  x.requestSort('score');
  x.requestSelection('a');
  x.getStructure();
  x.getCollectionCount();
  const value: string | number | boolean | null | undefined = x.getRecord('a')?.score;
  // @ts-expect-error page is numeric
  x.requestPage('2');
  // @ts-expect-error row key is string
  x.requestSelection(3);
  // @ts-expect-error sort signals are not adapter instance methods
  x.sortChange();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableRow>;
  type E = ExposeOf<typeof f4c3.dataTableRow>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { index: 0, header: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { index: '0' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableRow>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const key: string = x.rowKey.get();
  const selected: boolean = x.selected.get();
  x.getCollectionItem();
  // @ts-expect-error private collection metadata is not public
  x.__collectionItem();
  // @ts-expect-error hidden is an internal hook state, not an expose
  x.hidden.get();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableCell>;
  type E = ExposeOf<typeof f4c3.dataTableCell>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { columnKey: 'score', headers: ['score'], rowSpan: 2, columnSpan: 1 };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { rowSpan: '2' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableCell>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.displayValue.get();
  // @ts-expect-error rendered cell value is string
  const wrong: number = x.displayValue.get();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableHeader>;
  type E = ExposeOf<typeof f4c3.dataTableHeader>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {
    headerKey: 'score',
    headerKind: 'column',
    headers: ['score'],
    rowSpan: 2,
    columnSpan: 1,
  };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { headerKind: 'both' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableHeader>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  const value: string = x.sort.get();
  // @ts-expect-error focus facts are not exposed by Data Table Header
  x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableCaption>;
  type E = ExposeOf<typeof f4c3.dataTableCaption>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = {};
  // @ts-expect-error wrong public prop domain
  const invalid: P = { unknownProp: 2 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableCaption>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTablePrevious>;
  type E = ExposeOf<typeof f4c3.dataTablePrevious>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: true };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 1 };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTablePrevious>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.focusVisible.get();
}

{
  type P = ProtoAdapterProps<typeof f4c3.dataTableNext>;
  type E = ExposeOf<typeof f4c3.dataTableNext>;
  type ExactProps = Assert<NotAny<P>>;
  type ExactExposes = Assert<NotAny<E>>;
  const props: P = { disabled: false };
  // @ts-expect-error wrong public prop domain
  const invalid: P = { disabled: 'no' };
  const x = null as unknown as ProtoAdapterExposes<typeof f4c3.dataTableNext>;
  // @ts-expect-error no arbitrary instance keys
  x.notARealExpose();
  x.focusSelf();
  const value: boolean = x.disabled.get();
}

// Contract domains must stand independently of any Base/styled equality.
const treeRootHook = null as unknown as ReturnType<typeof f0c0.asTreeRoot>;
const selected: string = treeRootHook.stateHandles!.value.get();
const count: number = treeRootHook.stateHandles!.collectionCount.get();
// @ts-expect-error collection expose alias is not the handle's registered name
treeRootHook.stateHandles!.count;
// @ts-expect-error value handle takes strings
treeRootHook.stateHandles!.value.set(1);
const treeItemHook = null as unknown as ReturnType<typeof f0c0.asTreeItem>;
const level: number = treeItemHook.stateHandles!.level.get();
const branch: boolean = treeItemHook.stateHandles!.branch.get();
// @ts-expect-error branch is boolean
treeItemHook.stateHandles!.branch.set('true');
const toggle = null as unknown as ReturnType<typeof f0c0.asTreeToggle>;
const toggleFocus: boolean | undefined = toggle
  .getAsHookHandle?.('as-button')
  ?.stateHandles?.focusVisible.get();
// @ts-expect-error nested authored Button states are not flattened
toggle.stateHandles!.focusVisible;
const message = null as unknown as ReturnType<typeof f0c1.asMessageScrollerViewport>;
const following: 'off' | 'pending' | 'following' | 'paused' =
  message.stateHandles!['@scroll/endFollowState'].get();
// @ts-expect-error end-follow handle has a finite state domain
message.stateHandles!['@scroll/endFollowState'].set('broken');
// @ts-expect-error exposed aliases do not rename captured state handles
message.stateHandles!.following;
const messageJump = null as unknown as ReturnType<typeof f0c1.asMessageScrollerJump>;
const unread: number = messageJump.stateHandles!.newContentCount.get();
const virtual = null as unknown as ReturnType<typeof f0c2.asVirtualListViewport>;
const focus: boolean | undefined = virtual
  .getAsHookHandle?.('as-scroll-area-viewport')
  ?.stateHandles?.focusVisible.get();
// @ts-expect-error authored ScrollArea child states are not flattened
virtual.stateHandles!.focusVisible;
const row = null as unknown as ReturnType<typeof f0c3.asDataTableRow>;
const hidden: boolean = row.stateHandles!.hidden.get();
// @ts-expect-error internal row hidden handle is boolean
row.stateHandles!.hidden.set(3);
const cell = null as unknown as ReturnType<typeof f0c3.asDataTableCell>;
// @ts-expect-error cell display is a string
cell.stateHandles!.displayValue.set(2);
const page = null as unknown as ReturnType<typeof f0c3.asDataTableNext>;
const pageDisabled: boolean | undefined = page
  .getAsHookHandle?.('as-button')
  ?.stateHandles?.disabled.get();
// @ts-expect-error nested Button states are not flattened
page.stateHandles!.disabled;
type Payload<E> = E extends ExposeEvent<infer P> ? P : never;
const sortPayload: Payload<ExposeOf<typeof f0c3.dataTableRoot>['sortChange']> = {
  sortKey: 'name',
  sortDirection: 'descending',
};
const invalidSortPayload: Payload<ExposeOf<typeof f0c3.dataTableRoot>['sortChange']> = {
  sortKey: 'name',
  // @ts-expect-error invalid event payload domain
  sortDirection: 'up',
};
