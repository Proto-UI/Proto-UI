// Compile-only public consumer controls, checked separately from Calendar.
import type { ProtoAdapterProps, ProtoAdapterExposes } from '@proto.ui/adapter-base';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
import * as f0resizable from '../../base/src/resizable';
type f0resizableRootProps = ProtoAdapterProps<typeof f0resizable.resizableRoot>;
type f0resizableRootPropsNotAny = Assert<NotAny<f0resizableRootProps>>;
declare const f0resizableRoot: ProtoAdapterExposes<typeof f0resizable.resizableRoot>;
type f0resizableRootExposesNotAny = Assert<NotAny<typeof f0resizableRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0resizableRoot: f0resizableRootProps = { value: '50' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0resizableRoot.notAnExposedMethod();
type f0resizablePanelProps = ProtoAdapterProps<typeof f0resizable.resizablePanel>;
type f0resizablePanelPropsNotAny = Assert<NotAny<f0resizablePanelProps>>;
declare const f0resizablePanel: ProtoAdapterExposes<typeof f0resizable.resizablePanel>;
type f0resizablePanelExposesNotAny = Assert<NotAny<typeof f0resizablePanel>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0resizablePanel: f0resizablePanelProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0resizablePanel.notAnExposedMethod();
type f0resizableHandleProps = ProtoAdapterProps<typeof f0resizable.resizableHandle>;
type f0resizableHandlePropsNotAny = Assert<NotAny<f0resizableHandleProps>>;
declare const f0resizableHandle: ProtoAdapterExposes<typeof f0resizable.resizableHandle>;
type f0resizableHandleExposesNotAny = Assert<NotAny<typeof f0resizableHandle>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0resizableHandle: f0resizableHandleProps = { value: 50 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0resizableHandle.notAnExposedMethod();
const f0resizableRootResult: boolean = f0resizableRoot.requestValue(50, true);
const f0resizableRootValue: number = f0resizableRoot.value.get();
// @ts-expect-error Resize request and commit flag are typed.
f0resizableRoot.requestValue('50', 'yes');
const f0resizablePanelSize: number = f0resizablePanel.size.get();
const f0resizableHandleFocus: boolean = f0resizableHandle.focusVisible.get();
import * as f0carousel from '../../base/src/carousel';
type f0carouselRootProps = ProtoAdapterProps<typeof f0carousel.carouselRoot>;
type f0carouselRootPropsNotAny = Assert<NotAny<f0carouselRootProps>>;
declare const f0carouselRoot: ProtoAdapterExposes<typeof f0carousel.carouselRoot>;
type f0carouselRootExposesNotAny = Assert<NotAny<typeof f0carouselRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0carouselRoot: f0carouselRootProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0carouselRoot.notAnExposedMethod();
type f0carouselViewportProps = ProtoAdapterProps<typeof f0carousel.carouselViewport>;
type f0carouselViewportPropsNotAny = Assert<NotAny<f0carouselViewportProps>>;
declare const f0carouselViewport: ProtoAdapterExposes<typeof f0carousel.carouselViewport>;
type f0carouselViewportExposesNotAny = Assert<NotAny<typeof f0carouselViewport>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0carouselViewport: f0carouselViewportProps = { orientation: 'horizontal' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0carouselViewport.notAnExposedMethod();
type f0carouselSlideProps = ProtoAdapterProps<typeof f0carousel.carouselSlide>;
type f0carouselSlidePropsNotAny = Assert<NotAny<f0carouselSlideProps>>;
declare const f0carouselSlide: ProtoAdapterExposes<typeof f0carousel.carouselSlide>;
type f0carouselSlideExposesNotAny = Assert<NotAny<typeof f0carouselSlide>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0carouselSlide: f0carouselSlideProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0carouselSlide.notAnExposedMethod();
type f0carouselPreviousProps = ProtoAdapterProps<typeof f0carousel.carouselPrevious>;
type f0carouselPreviousPropsNotAny = Assert<NotAny<f0carouselPreviousProps>>;
declare const f0carouselPrevious: ProtoAdapterExposes<typeof f0carousel.carouselPrevious>;
type f0carouselPreviousExposesNotAny = Assert<NotAny<typeof f0carouselPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0carouselPrevious: f0carouselPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0carouselPrevious.notAnExposedMethod();
type f0carouselNextProps = ProtoAdapterProps<typeof f0carousel.carouselNext>;
type f0carouselNextPropsNotAny = Assert<NotAny<f0carouselNextProps>>;
declare const f0carouselNext: ProtoAdapterExposes<typeof f0carousel.carouselNext>;
type f0carouselNextExposesNotAny = Assert<NotAny<typeof f0carouselNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0carouselNext: f0carouselNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0carouselNext.notAnExposedMethod();
const f0carouselRootResult: boolean = f0carouselRoot.requestIndex(1);
const f0carouselRootValue: number = f0carouselRoot.index.get();
const f0carouselRootCount: number = f0carouselRoot.slideCount.get();
// @ts-expect-error Slide requests require numbers.
f0carouselRoot.requestIndex('1');
const f0carouselSlideValue: boolean = f0carouselSlide.current.get();
const f0carouselSlideIndex: number = f0carouselSlide.collectionIndex.get();
const f0carouselViewportFocus: boolean = f0carouselViewport.focusVisible.get();
const f0carouselPreviousDisabled: boolean = f0carouselPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f0carouselPrevious.focusSelf({ reason: 'invalid' });
const f0carouselNextDisabled: boolean = f0carouselNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f0carouselNext.focusSelf({ reason: 'invalid' });
import * as f1resizable from '../../shadcn/src/resizable';
type f1resizableRootProps = ProtoAdapterProps<typeof f1resizable.resizableRoot>;
type f1resizableRootPropsNotAny = Assert<NotAny<f1resizableRootProps>>;
declare const f1resizableRoot: ProtoAdapterExposes<typeof f1resizable.resizableRoot>;
type f1resizableRootExposesNotAny = Assert<NotAny<typeof f1resizableRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1resizableRoot: f1resizableRootProps = { value: '50' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1resizableRoot.notAnExposedMethod();
type f1resizablePanelProps = ProtoAdapterProps<typeof f1resizable.resizablePanel>;
type f1resizablePanelPropsNotAny = Assert<NotAny<f1resizablePanelProps>>;
declare const f1resizablePanel: ProtoAdapterExposes<typeof f1resizable.resizablePanel>;
type f1resizablePanelExposesNotAny = Assert<NotAny<typeof f1resizablePanel>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1resizablePanel: f1resizablePanelProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1resizablePanel.notAnExposedMethod();
type f1resizableHandleProps = ProtoAdapterProps<typeof f1resizable.resizableHandle>;
type f1resizableHandlePropsNotAny = Assert<NotAny<f1resizableHandleProps>>;
declare const f1resizableHandle: ProtoAdapterExposes<typeof f1resizable.resizableHandle>;
type f1resizableHandleExposesNotAny = Assert<NotAny<typeof f1resizableHandle>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1resizableHandle: f1resizableHandleProps = { value: 50 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1resizableHandle.notAnExposedMethod();
const f1resizableRootResult: boolean = f1resizableRoot.requestValue(50, true);
const f1resizableRootValue: number = f1resizableRoot.value.get();
// @ts-expect-error Resize request and commit flag are typed.
f1resizableRoot.requestValue('50', 'yes');
const f1resizablePanelSize: number = f1resizablePanel.size.get();
const f1resizableHandleFocus: boolean = f1resizableHandle.focusVisible.get();
import * as f1carousel from '../../shadcn/src/carousel';
type f1carouselRootProps = ProtoAdapterProps<typeof f1carousel.carouselRoot>;
type f1carouselRootPropsNotAny = Assert<NotAny<f1carouselRootProps>>;
declare const f1carouselRoot: ProtoAdapterExposes<typeof f1carousel.carouselRoot>;
type f1carouselRootExposesNotAny = Assert<NotAny<typeof f1carouselRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1carouselRoot: f1carouselRootProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1carouselRoot.notAnExposedMethod();
type f1carouselViewportProps = ProtoAdapterProps<typeof f1carousel.carouselViewport>;
type f1carouselViewportPropsNotAny = Assert<NotAny<f1carouselViewportProps>>;
declare const f1carouselViewport: ProtoAdapterExposes<typeof f1carousel.carouselViewport>;
type f1carouselViewportExposesNotAny = Assert<NotAny<typeof f1carouselViewport>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1carouselViewport: f1carouselViewportProps = { orientation: 'horizontal' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1carouselViewport.notAnExposedMethod();
type f1carouselSlideProps = ProtoAdapterProps<typeof f1carousel.carouselSlide>;
type f1carouselSlidePropsNotAny = Assert<NotAny<f1carouselSlideProps>>;
declare const f1carouselSlide: ProtoAdapterExposes<typeof f1carousel.carouselSlide>;
type f1carouselSlideExposesNotAny = Assert<NotAny<typeof f1carouselSlide>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1carouselSlide: f1carouselSlideProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1carouselSlide.notAnExposedMethod();
type f1carouselPreviousProps = ProtoAdapterProps<typeof f1carousel.carouselPrevious>;
type f1carouselPreviousPropsNotAny = Assert<NotAny<f1carouselPreviousProps>>;
declare const f1carouselPrevious: ProtoAdapterExposes<typeof f1carousel.carouselPrevious>;
type f1carouselPreviousExposesNotAny = Assert<NotAny<typeof f1carouselPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1carouselPrevious: f1carouselPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1carouselPrevious.notAnExposedMethod();
type f1carouselNextProps = ProtoAdapterProps<typeof f1carousel.carouselNext>;
type f1carouselNextPropsNotAny = Assert<NotAny<f1carouselNextProps>>;
declare const f1carouselNext: ProtoAdapterExposes<typeof f1carousel.carouselNext>;
type f1carouselNextExposesNotAny = Assert<NotAny<typeof f1carouselNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1carouselNext: f1carouselNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1carouselNext.notAnExposedMethod();
const f1carouselRootResult: boolean = f1carouselRoot.requestIndex(1);
const f1carouselRootValue: number = f1carouselRoot.index.get();
const f1carouselRootCount: number = f1carouselRoot.slideCount.get();
// @ts-expect-error Slide requests require numbers.
f1carouselRoot.requestIndex('1');
const f1carouselSlideValue: boolean = f1carouselSlide.current.get();
const f1carouselSlideIndex: number = f1carouselSlide.collectionIndex.get();
const f1carouselViewportFocus: boolean = f1carouselViewport.focusVisible.get();
const f1carouselPreviousDisabled: boolean = f1carouselPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f1carouselPrevious.focusSelf({ reason: 'invalid' });
const f1carouselNextDisabled: boolean = f1carouselNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f1carouselNext.focusSelf({ reason: 'invalid' });
import * as f2resizable from '../../brutalist/src/resizable';
type f2resizableRootProps = ProtoAdapterProps<typeof f2resizable.resizableRoot>;
type f2resizableRootPropsNotAny = Assert<NotAny<f2resizableRootProps>>;
declare const f2resizableRoot: ProtoAdapterExposes<typeof f2resizable.resizableRoot>;
type f2resizableRootExposesNotAny = Assert<NotAny<typeof f2resizableRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2resizableRoot: f2resizableRootProps = { value: '50' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2resizableRoot.notAnExposedMethod();
type f2resizablePanelProps = ProtoAdapterProps<typeof f2resizable.resizablePanel>;
type f2resizablePanelPropsNotAny = Assert<NotAny<f2resizablePanelProps>>;
declare const f2resizablePanel: ProtoAdapterExposes<typeof f2resizable.resizablePanel>;
type f2resizablePanelExposesNotAny = Assert<NotAny<typeof f2resizablePanel>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2resizablePanel: f2resizablePanelProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2resizablePanel.notAnExposedMethod();
type f2resizableHandleProps = ProtoAdapterProps<typeof f2resizable.resizableHandle>;
type f2resizableHandlePropsNotAny = Assert<NotAny<f2resizableHandleProps>>;
declare const f2resizableHandle: ProtoAdapterExposes<typeof f2resizable.resizableHandle>;
type f2resizableHandleExposesNotAny = Assert<NotAny<typeof f2resizableHandle>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2resizableHandle: f2resizableHandleProps = { value: 50 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2resizableHandle.notAnExposedMethod();
const f2resizableRootResult: boolean = f2resizableRoot.requestValue(50, true);
const f2resizableRootValue: number = f2resizableRoot.value.get();
// @ts-expect-error Resize request and commit flag are typed.
f2resizableRoot.requestValue('50', 'yes');
const f2resizablePanelSize: number = f2resizablePanel.size.get();
const f2resizableHandleFocus: boolean = f2resizableHandle.focusVisible.get();
import * as f2carousel from '../../brutalist/src/carousel';
type f2carouselRootProps = ProtoAdapterProps<typeof f2carousel.carouselRoot>;
type f2carouselRootPropsNotAny = Assert<NotAny<f2carouselRootProps>>;
declare const f2carouselRoot: ProtoAdapterExposes<typeof f2carousel.carouselRoot>;
type f2carouselRootExposesNotAny = Assert<NotAny<typeof f2carouselRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2carouselRoot: f2carouselRootProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2carouselRoot.notAnExposedMethod();
type f2carouselViewportProps = ProtoAdapterProps<typeof f2carousel.carouselViewport>;
type f2carouselViewportPropsNotAny = Assert<NotAny<f2carouselViewportProps>>;
declare const f2carouselViewport: ProtoAdapterExposes<typeof f2carousel.carouselViewport>;
type f2carouselViewportExposesNotAny = Assert<NotAny<typeof f2carouselViewport>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2carouselViewport: f2carouselViewportProps = { orientation: 'horizontal' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2carouselViewport.notAnExposedMethod();
type f2carouselSlideProps = ProtoAdapterProps<typeof f2carousel.carouselSlide>;
type f2carouselSlidePropsNotAny = Assert<NotAny<f2carouselSlideProps>>;
declare const f2carouselSlide: ProtoAdapterExposes<typeof f2carousel.carouselSlide>;
type f2carouselSlideExposesNotAny = Assert<NotAny<typeof f2carouselSlide>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2carouselSlide: f2carouselSlideProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2carouselSlide.notAnExposedMethod();
type f2carouselPreviousProps = ProtoAdapterProps<typeof f2carousel.carouselPrevious>;
type f2carouselPreviousPropsNotAny = Assert<NotAny<f2carouselPreviousProps>>;
declare const f2carouselPrevious: ProtoAdapterExposes<typeof f2carousel.carouselPrevious>;
type f2carouselPreviousExposesNotAny = Assert<NotAny<typeof f2carouselPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2carouselPrevious: f2carouselPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2carouselPrevious.notAnExposedMethod();
type f2carouselNextProps = ProtoAdapterProps<typeof f2carousel.carouselNext>;
type f2carouselNextPropsNotAny = Assert<NotAny<f2carouselNextProps>>;
declare const f2carouselNext: ProtoAdapterExposes<typeof f2carousel.carouselNext>;
type f2carouselNextExposesNotAny = Assert<NotAny<typeof f2carouselNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2carouselNext: f2carouselNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2carouselNext.notAnExposedMethod();
const f2carouselRootResult: boolean = f2carouselRoot.requestIndex(1);
const f2carouselRootValue: number = f2carouselRoot.index.get();
const f2carouselRootCount: number = f2carouselRoot.slideCount.get();
// @ts-expect-error Slide requests require numbers.
f2carouselRoot.requestIndex('1');
const f2carouselSlideValue: boolean = f2carouselSlide.current.get();
const f2carouselSlideIndex: number = f2carouselSlide.collectionIndex.get();
const f2carouselViewportFocus: boolean = f2carouselViewport.focusVisible.get();
const f2carouselPreviousDisabled: boolean = f2carouselPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f2carouselPrevious.focusSelf({ reason: 'invalid' });
const f2carouselNextDisabled: boolean = f2carouselNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f2carouselNext.focusSelf({ reason: 'invalid' });
import * as f3resizable from '../../bootstrap-2-3-2/src/resizable';
type f3resizableRootProps = ProtoAdapterProps<typeof f3resizable.resizableRoot>;
type f3resizableRootPropsNotAny = Assert<NotAny<f3resizableRootProps>>;
declare const f3resizableRoot: ProtoAdapterExposes<typeof f3resizable.resizableRoot>;
type f3resizableRootExposesNotAny = Assert<NotAny<typeof f3resizableRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3resizableRoot: f3resizableRootProps = { value: '50' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3resizableRoot.notAnExposedMethod();
type f3resizablePanelProps = ProtoAdapterProps<typeof f3resizable.resizablePanel>;
type f3resizablePanelPropsNotAny = Assert<NotAny<f3resizablePanelProps>>;
declare const f3resizablePanel: ProtoAdapterExposes<typeof f3resizable.resizablePanel>;
type f3resizablePanelExposesNotAny = Assert<NotAny<typeof f3resizablePanel>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3resizablePanel: f3resizablePanelProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3resizablePanel.notAnExposedMethod();
type f3resizableHandleProps = ProtoAdapterProps<typeof f3resizable.resizableHandle>;
type f3resizableHandlePropsNotAny = Assert<NotAny<f3resizableHandleProps>>;
declare const f3resizableHandle: ProtoAdapterExposes<typeof f3resizable.resizableHandle>;
type f3resizableHandleExposesNotAny = Assert<NotAny<typeof f3resizableHandle>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3resizableHandle: f3resizableHandleProps = { value: 50 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3resizableHandle.notAnExposedMethod();
const f3resizableRootResult: boolean = f3resizableRoot.requestValue(50, true);
const f3resizableRootValue: number = f3resizableRoot.value.get();
// @ts-expect-error Resize request and commit flag are typed.
f3resizableRoot.requestValue('50', 'yes');
const f3resizablePanelSize: number = f3resizablePanel.size.get();
const f3resizableHandleFocus: boolean = f3resizableHandle.focusVisible.get();
import * as f3carousel from '../../bootstrap-2-3-2/src/carousel';
type f3carouselRootProps = ProtoAdapterProps<typeof f3carousel.carouselRoot>;
type f3carouselRootPropsNotAny = Assert<NotAny<f3carouselRootProps>>;
declare const f3carouselRoot: ProtoAdapterExposes<typeof f3carousel.carouselRoot>;
type f3carouselRootExposesNotAny = Assert<NotAny<typeof f3carouselRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3carouselRoot: f3carouselRootProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3carouselRoot.notAnExposedMethod();
type f3carouselViewportProps = ProtoAdapterProps<typeof f3carousel.carouselViewport>;
type f3carouselViewportPropsNotAny = Assert<NotAny<f3carouselViewportProps>>;
declare const f3carouselViewport: ProtoAdapterExposes<typeof f3carousel.carouselViewport>;
type f3carouselViewportExposesNotAny = Assert<NotAny<typeof f3carouselViewport>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3carouselViewport: f3carouselViewportProps = { orientation: 'horizontal' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3carouselViewport.notAnExposedMethod();
type f3carouselSlideProps = ProtoAdapterProps<typeof f3carousel.carouselSlide>;
type f3carouselSlidePropsNotAny = Assert<NotAny<f3carouselSlideProps>>;
declare const f3carouselSlide: ProtoAdapterExposes<typeof f3carousel.carouselSlide>;
type f3carouselSlideExposesNotAny = Assert<NotAny<typeof f3carouselSlide>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3carouselSlide: f3carouselSlideProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3carouselSlide.notAnExposedMethod();
type f3carouselPreviousProps = ProtoAdapterProps<typeof f3carousel.carouselPrevious>;
type f3carouselPreviousPropsNotAny = Assert<NotAny<f3carouselPreviousProps>>;
declare const f3carouselPrevious: ProtoAdapterExposes<typeof f3carousel.carouselPrevious>;
type f3carouselPreviousExposesNotAny = Assert<NotAny<typeof f3carouselPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3carouselPrevious: f3carouselPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3carouselPrevious.notAnExposedMethod();
type f3carouselNextProps = ProtoAdapterProps<typeof f3carousel.carouselNext>;
type f3carouselNextPropsNotAny = Assert<NotAny<f3carouselNextProps>>;
declare const f3carouselNext: ProtoAdapterExposes<typeof f3carousel.carouselNext>;
type f3carouselNextExposesNotAny = Assert<NotAny<typeof f3carouselNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3carouselNext: f3carouselNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3carouselNext.notAnExposedMethod();
const f3carouselRootResult: boolean = f3carouselRoot.requestIndex(1);
const f3carouselRootValue: number = f3carouselRoot.index.get();
const f3carouselRootCount: number = f3carouselRoot.slideCount.get();
// @ts-expect-error Slide requests require numbers.
f3carouselRoot.requestIndex('1');
const f3carouselSlideValue: boolean = f3carouselSlide.current.get();
const f3carouselSlideIndex: number = f3carouselSlide.collectionIndex.get();
const f3carouselViewportFocus: boolean = f3carouselViewport.focusVisible.get();
const f3carouselPreviousDisabled: boolean = f3carouselPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f3carouselPrevious.focusSelf({ reason: 'invalid' });
const f3carouselNextDisabled: boolean = f3carouselNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f3carouselNext.focusSelf({ reason: 'invalid' });
import * as f4resizable from '../../liquid-glass/src/resizable';
type f4resizableRootProps = ProtoAdapterProps<typeof f4resizable.resizableRoot>;
type f4resizableRootPropsNotAny = Assert<NotAny<f4resizableRootProps>>;
declare const f4resizableRoot: ProtoAdapterExposes<typeof f4resizable.resizableRoot>;
type f4resizableRootExposesNotAny = Assert<NotAny<typeof f4resizableRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4resizableRoot: f4resizableRootProps = { value: '50' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4resizableRoot.notAnExposedMethod();
type f4resizablePanelProps = ProtoAdapterProps<typeof f4resizable.resizablePanel>;
type f4resizablePanelPropsNotAny = Assert<NotAny<f4resizablePanelProps>>;
declare const f4resizablePanel: ProtoAdapterExposes<typeof f4resizable.resizablePanel>;
type f4resizablePanelExposesNotAny = Assert<NotAny<typeof f4resizablePanel>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4resizablePanel: f4resizablePanelProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4resizablePanel.notAnExposedMethod();
type f4resizableHandleProps = ProtoAdapterProps<typeof f4resizable.resizableHandle>;
type f4resizableHandlePropsNotAny = Assert<NotAny<f4resizableHandleProps>>;
declare const f4resizableHandle: ProtoAdapterExposes<typeof f4resizable.resizableHandle>;
type f4resizableHandleExposesNotAny = Assert<NotAny<typeof f4resizableHandle>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4resizableHandle: f4resizableHandleProps = { value: 50 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4resizableHandle.notAnExposedMethod();
const f4resizableRootResult: boolean = f4resizableRoot.requestValue(50, true);
const f4resizableRootValue: number = f4resizableRoot.value.get();
// @ts-expect-error Resize request and commit flag are typed.
f4resizableRoot.requestValue('50', 'yes');
const f4resizablePanelSize: number = f4resizablePanel.size.get();
const f4resizableHandleFocus: boolean = f4resizableHandle.focusVisible.get();
import * as f4carousel from '../../liquid-glass/src/carousel';
type f4carouselRootProps = ProtoAdapterProps<typeof f4carousel.carouselRoot>;
type f4carouselRootPropsNotAny = Assert<NotAny<f4carouselRootProps>>;
declare const f4carouselRoot: ProtoAdapterExposes<typeof f4carousel.carouselRoot>;
type f4carouselRootExposesNotAny = Assert<NotAny<typeof f4carouselRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4carouselRoot: f4carouselRootProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4carouselRoot.notAnExposedMethod();
type f4carouselViewportProps = ProtoAdapterProps<typeof f4carousel.carouselViewport>;
type f4carouselViewportPropsNotAny = Assert<NotAny<f4carouselViewportProps>>;
declare const f4carouselViewport: ProtoAdapterExposes<typeof f4carousel.carouselViewport>;
type f4carouselViewportExposesNotAny = Assert<NotAny<typeof f4carouselViewport>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4carouselViewport: f4carouselViewportProps = { orientation: 'horizontal' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4carouselViewport.notAnExposedMethod();
type f4carouselSlideProps = ProtoAdapterProps<typeof f4carousel.carouselSlide>;
type f4carouselSlidePropsNotAny = Assert<NotAny<f4carouselSlideProps>>;
declare const f4carouselSlide: ProtoAdapterExposes<typeof f4carousel.carouselSlide>;
type f4carouselSlideExposesNotAny = Assert<NotAny<typeof f4carouselSlide>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4carouselSlide: f4carouselSlideProps = { index: '0' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4carouselSlide.notAnExposedMethod();
type f4carouselPreviousProps = ProtoAdapterProps<typeof f4carousel.carouselPrevious>;
type f4carouselPreviousPropsNotAny = Assert<NotAny<f4carouselPreviousProps>>;
declare const f4carouselPrevious: ProtoAdapterExposes<typeof f4carousel.carouselPrevious>;
type f4carouselPreviousExposesNotAny = Assert<NotAny<typeof f4carouselPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4carouselPrevious: f4carouselPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4carouselPrevious.notAnExposedMethod();
type f4carouselNextProps = ProtoAdapterProps<typeof f4carousel.carouselNext>;
type f4carouselNextPropsNotAny = Assert<NotAny<f4carouselNextProps>>;
declare const f4carouselNext: ProtoAdapterExposes<typeof f4carousel.carouselNext>;
type f4carouselNextExposesNotAny = Assert<NotAny<typeof f4carouselNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4carouselNext: f4carouselNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4carouselNext.notAnExposedMethod();
const f4carouselRootResult: boolean = f4carouselRoot.requestIndex(1);
const f4carouselRootValue: number = f4carouselRoot.index.get();
const f4carouselRootCount: number = f4carouselRoot.slideCount.get();
// @ts-expect-error Slide requests require numbers.
f4carouselRoot.requestIndex('1');
const f4carouselSlideValue: boolean = f4carouselSlide.current.get();
const f4carouselSlideIndex: number = f4carouselSlide.collectionIndex.get();
const f4carouselViewportFocus: boolean = f4carouselViewport.focusVisible.get();
const f4carouselPreviousDisabled: boolean = f4carouselPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f4carouselPrevious.focusSelf({ reason: 'invalid' });
const f4carouselNextDisabled: boolean = f4carouselNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f4carouselNext.focusSelf({ reason: 'invalid' });

import { asResizableRoot, asResizablePanel, asResizableHandle } from '../src/resizable';
import {
  asCarouselRoot,
  asCarouselViewport,
  asCarouselSlide,
  asCarouselPrevious,
} from '../src/carousel';
declare const resizeRoot: ReturnType<typeof asResizableRoot>;
declare const resizePanel: ReturnType<typeof asResizablePanel>;
declare const resizeHandle: ReturnType<typeof asResizableHandle>;
declare const carouselRootHook: ReturnType<typeof asCarouselRoot>;
declare const carouselViewportHook: ReturnType<typeof asCarouselViewport>;
declare const carouselSlideHook: ReturnType<typeof asCarouselSlide>;
declare const carouselPreviousHook: ReturnType<typeof asCarouselPrevious>;
const ratio: number | undefined = resizeRoot.stateHandles?.value.get();
const size: number | undefined = resizePanel.stateHandles?.size.get();
const resizeDisabled: boolean | undefined = resizeHandle.stateHandles?.disabled.get();
// @ts-expect-error Numeric ratio state retains its domain.
resizeRoot.stateHandles?.value.set('50');
// @ts-expect-error Empty Handle props do not claim Root ownership.
const badHandle: ProtoAdapterProps<typeof f0resizable.resizableHandle> = { readOnly: true };
const carouselCount: number | undefined = carouselRootHook.stateHandles?.count.get();
const carouselCollectionCount: number | undefined =
  carouselRootHook.stateHandles?.collectionCount.get();
// @ts-expect-error Exposed slideCount aliases the captured count state.
carouselRootHook.stateHandles?.slideCount.get();
const visibleFocus: boolean | undefined = carouselViewportHook.stateHandles?.focusVisible.get();
const hidden: boolean | undefined = carouselSlideHook.stateHandles?.hidden.get();
const label: string | undefined = carouselSlideHook.stateHandles?.label.get();
const disabled: boolean | undefined = carouselPreviousHook
  .getAsHookHandle?.('as-button')
  ?.stateHandles?.disabled.get();
// @ts-expect-error The nested Button state is not flattened into authored navigation.
carouselPreviousHook.stateHandles?.disabled.get();
// @ts-expect-error Slide state is boolean.
carouselSlideHook.stateHandles?.hidden.set('yes');

import type { ProtoReactEventProps } from '@proto.ui/adapter-react';
const f0resizeEventProps: ProtoReactEventProps<typeof f0resizable.resizableRoot> = {
  onValueChange(detail) {
    const value: number = detail.value;
  },
  onValueCommit(detail) {
    const value: number = detail.value;
  },
};
const f0carouselEventProps: ProtoReactEventProps<typeof f0carousel.carouselRoot> = {
  onIndexChange(detail) {
    const index: number = detail.index;
  },
};
// @ts-expect-error Events project as callbacks, not imperative instance methods.
f0resizableRoot.valueChange();
const f0wrongResizeEvent: ProtoReactEventProps<typeof f0resizable.resizableRoot> = {
  // @ts-expect-error Event payloads keep their numeric domain.
  onValueChange: (detail: { value: string }) => {},
};
const f1resizeEventProps: ProtoReactEventProps<typeof f1resizable.resizableRoot> = {
  onValueChange(detail) {
    const value: number = detail.value;
  },
  onValueCommit(detail) {
    const value: number = detail.value;
  },
};
const f1carouselEventProps: ProtoReactEventProps<typeof f1carousel.carouselRoot> = {
  onIndexChange(detail) {
    const index: number = detail.index;
  },
};
// @ts-expect-error Events project as callbacks, not imperative instance methods.
f1resizableRoot.valueChange();
const f1wrongResizeEvent: ProtoReactEventProps<typeof f1resizable.resizableRoot> = {
  // @ts-expect-error Event payloads keep their numeric domain.
  onValueChange: (detail: { value: string }) => {},
};
const f2resizeEventProps: ProtoReactEventProps<typeof f2resizable.resizableRoot> = {
  onValueChange(detail) {
    const value: number = detail.value;
  },
  onValueCommit(detail) {
    const value: number = detail.value;
  },
};
const f2carouselEventProps: ProtoReactEventProps<typeof f2carousel.carouselRoot> = {
  onIndexChange(detail) {
    const index: number = detail.index;
  },
};
// @ts-expect-error Events project as callbacks, not imperative instance methods.
f2resizableRoot.valueChange();
const f2wrongResizeEvent: ProtoReactEventProps<typeof f2resizable.resizableRoot> = {
  // @ts-expect-error Event payloads keep their numeric domain.
  onValueChange: (detail: { value: string }) => {},
};
const f3resizeEventProps: ProtoReactEventProps<typeof f3resizable.resizableRoot> = {
  onValueChange(detail) {
    const value: number = detail.value;
  },
  onValueCommit(detail) {
    const value: number = detail.value;
  },
};
const f3carouselEventProps: ProtoReactEventProps<typeof f3carousel.carouselRoot> = {
  onIndexChange(detail) {
    const index: number = detail.index;
  },
};
// @ts-expect-error Events project as callbacks, not imperative instance methods.
f3resizableRoot.valueChange();
const f3wrongResizeEvent: ProtoReactEventProps<typeof f3resizable.resizableRoot> = {
  // @ts-expect-error Event payloads keep their numeric domain.
  onValueChange: (detail: { value: string }) => {},
};
const f4resizeEventProps: ProtoReactEventProps<typeof f4resizable.resizableRoot> = {
  onValueChange(detail) {
    const value: number = detail.value;
  },
  onValueCommit(detail) {
    const value: number = detail.value;
  },
};
const f4carouselEventProps: ProtoReactEventProps<typeof f4carousel.carouselRoot> = {
  onIndexChange(detail) {
    const index: number = detail.index;
  },
};
// @ts-expect-error Events project as callbacks, not imperative instance methods.
f4resizableRoot.valueChange();
const f4wrongResizeEvent: ProtoReactEventProps<typeof f4resizable.resizableRoot> = {
  // @ts-expect-error Event payloads keep their numeric domain.
  onValueChange: (detail: { value: string }) => {},
};
