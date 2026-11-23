import 'package:flutter/widgets.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter_test/flutter_test.dart';
import '../lib/Component.dart' as generated;
import '../lib/.proto_ui/flutter_native.dart' as native;

void main() {
  testWidgets('actual generated Scroll outcomes, geometry and lifetime', (tester) async {
    final controller = generated.CompiledComponentController();
    await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 240, height: 200,
        child: generated.CompiledComponent(controller: controller,
          child: const SizedBox(width: 200, height: 1600))))));
    await tester.pump();
    expect(controller.ready, isTrue);
    final exposed = controller.getExposes();
    final scroll = controller.driver.scroll!;
    final scrollView = tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView));
    final control = scrollView.controller!;
    final position = control.position;
    final range = position.maxScrollExtent - position.minScrollExtent;
    expect(range, greaterThan(0));
    expect(exposed.createdOutcome(), 'rejected');
    expect(exposed.toKind(), 'dispatched');
    expect(position.pixels, closeTo(position.minScrollExtent + range * 0.5, 0.001));
    final beforeBy = position.pixels;
    expect(exposed.byKind(), 'dispatched');
    // A duplicated host-call evaluation during union conversion would move by 20.
    expect(position.pixels, closeTo(beforeBy + 10, 0.001));
    expect(exposed.pageKind(), 'dispatched');
    expect(exposed.dragKind(), 'dispatched');
    expect(position.pixels, closeTo(position.minScrollExtent + range * 0.25, 0.001));
    final statusBefore = scroll.endFollow.requestStatus.get();
    expect(exposed.wrongAxisKind(), 'rejected');
    final dynamic wrong = exposed.wrongAxisOutcome();
    expect(wrong.reason.value, 'unavailable');
    expect(scroll.endFollow.requestStatus.get(), statusBefore);
    control.detach(position);
    try {
      expect(exposed.toKind(), 'rejected');
      expect(controller.driver.invoke((_) => scroll.request({'kind':'to','axis':'vertical','position':0.5})),
        {'kind':'rejected','reason':'unavailable'});
    } finally { control.attach(position); }
    // Current implementation ordering: refreshed facts are observable inside
    // applied publication. This is not stable cross-host profile admission.
    expect(scroll.endFollow.state.get(), 'paused');
    final publications = <String>[];
    final appliedFacts = <(String, bool, double)>[];
    void observe(native.NativeStateChange<String> event) {
      publications.add(event.next);
      if (event.next == 'applied') {
        appliedFacts.add((scroll.endFollow.state.get(), scroll.vertical.atEnd.get(), position.pixels));
      }
    }
    scroll.endFollow.requestStatus.subscribers.add(observe);
    try { expect(exposed.endKind(), 'dispatched'); }
    finally { scroll.endFollow.requestStatus.subscribers.remove(observe); }
    expect(publications, ['pending', 'applied']);
    expect(appliedFacts, [('following', true, position.maxScrollExtent)]);
    expect(position.pixels, closeTo(position.maxScrollExtent, 0.001));
    expect(scroll.endFollow.requestStatus.get(), 'applied');
    final applied = scroll.endFollow.requestStatus.get();
    expect(exposed.wrongAxisKind(), 'rejected');
    expect(scroll.endFollow.requestStatus.get(), applied);
    controller.setPresent(false);
    expect(exposed.toKind(), 'rejected');
    expect(controller.driver.invoke((_) => scroll.request({'kind':'to-end','axis':'vertical'})),
      {'kind':'rejected','reason':'not-mounted'});
    expect(scroll.endFollow.requestStatus.get(), 'rejected');
    await tester.pump();
    controller.setPresent(true);
    await tester.pump();
    await tester.pump();
    expect(exposed.toKind(), 'dispatched');

    // Detach synchronously inside pending publication: the old request must not jump.
    final beforeRetirement = position.pixels;
    void retire(native.NativeStateChange<String> event) {
      if (event.next == 'pending') controller.setPresent(false);
    }
    scroll.endFollow.requestStatus.subscribers.add(retire);
    try { expect(exposed.endKind(), 'rejected'); }
    finally { scroll.endFollow.requestStatus.subscribers.remove(retire); }
    expect(position.pixels, beforeRetirement);
    await tester.pump();
    controller.setPresent(true);
    await tester.pump();
    await tester.pump();
    expect(exposed.toKind(), 'dispatched');
    final retained = exposed.toKind;
    controller.dispose();
    expect(retained, throwsStateError);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  test('undeclared capability and owned-callback errors remain distinct', () {
    final owner = native.NativeOwner<Object?>(() {}, null,
      makeProps: (value) => value, checks: {});
    final scroll = native.NativeScroll(owner);
    owner.scroll = scroll;
    expect(() => scroll.request({'kind':'to','axis':'vertical','position':0.5}), throwsStateError);
    owner.finishSetup({});
    expect(() => scroll.request({'kind':'to','axis':'vertical','position':0.5}), throwsStateError);
    expect(owner.inScope('consumer', () => scroll.request({'kind':'to','axis':'vertical','position':0.5})),
      {'kind':'rejected','reason':'not-declared'});
    owner.close();
    expect(() => owner.inScope('consumer', () => scroll.request({'kind':'to','axis':'vertical','position':0.5})), throwsStateError);
  });

  test('checked native outcome arms project fields and reject malformed inputs', () {
    // Explicit manual host-boundary inputs exercise the actual generated
    // fallback converter. NativeScroll is untouched in the Widget case above.
    // Extra reason is deliberately valid for the rejected arm: the kind must
    // select dispatched/queued and discard that unselected arm's field.
    for (final kind in ['dispatched', 'queued']) {
      final (value, evaluations) = generated.probeCheckedOutcome({'kind':kind, 'reason':'unavailable'});
      final dynamic record = value;
      expect(record.kind.value, kind);
      expect(evaluations, 1);
      expect(() => record.reason, throwsNoSuchMethodError);
    }
    for (final reason in ['not-mounted', 'not-declared', 'unavailable']) {
      final (value, evaluations) = generated.probeCheckedOutcome({'kind':'rejected', 'reason':reason, 'extra':42});
      final dynamic record = value;
      expect(record.kind.value, 'rejected');
      expect(record.reason.value, reason);
      expect(evaluations, 1);
      expect(() => record.extra, throwsNoSuchMethodError);
    }
    for (final input in <Map<String, Object?>>[
      {'kind':'unknown'}, {'kind':'rejected'}, {'kind':'rejected', 'reason':42},
      {'kind':'rejected', 'reason':'unknown'},
    ]) {
      expect(() => generated.probeCheckedOutcome(input), throwsStateError);
    }
  });
  registerPauseFollowingCases();
}

// Additional actual Widget regressions for explicit pause and reader ownership.
// The original three consumer cases remain unchanged.
void registerPauseFollowingCases() {
  for (final kind in ['by-zero', 'page-after', 'to-end-position', 'drag-end-position']) {
    testWidgets('public $kind preserves explicit pause at the actual end', (tester) async {
      final probe = await mountPauseProbe(tester);
      expect(probe.exposed.endKind(), 'dispatched');
      await tester.pumpAndSettle();
      final before = probe.position.pixels;
      expect(before, closeTo(probe.position.maxScrollExtent, 0.001));
      expect(probe.exposed.pauseKind(), 'dispatched');
      expect(probe.scroll.endFollow.state.get(), 'paused');

      expect(ordinaryRequest(probe.exposed, kind), 'dispatched');
      expect(probe.position.pixels, closeTo(before, 0.001));
      expect(probe.scroll.endFollow.state.get(), 'paused');
      await tester.pumpAndSettle();
      expect(probe.position.pixels, closeTo(before, 0.001));
      expect(probe.scroll.endFollow.state.get(), 'paused');

      // Only an explicit to-end request restores follow without reader motion.
      expect(probe.exposed.endKind(), 'dispatched');
      expect(probe.scroll.endFollow.state.get(), 'following');
      expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
    });
  }

  for (final kind in ['to-end-position', 'drag-end-position']) {
    testWidgets('public $kind moves to the end without clearing explicit pause', (tester) async {
      final probe = await mountPauseProbe(tester);
      expect(probe.exposed.toKind(), 'dispatched');
      final before = probe.position.pixels;
      expect(before, greaterThan(probe.position.minScrollExtent));
      expect(before, lessThan(probe.position.maxScrollExtent));
      expect(probe.exposed.pauseKind(), 'dispatched');

      expect(ordinaryRequest(probe.exposed, kind), 'dispatched');
      expect(probe.position.pixels, greaterThan(before));
      expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
      expect(probe.scroll.endFollow.state.get(), 'paused');
      await tester.pumpAndSettle();
      expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
      expect(probe.scroll.endFollow.state.get(), 'paused');

      expect(probe.exposed.endKind(), 'dispatched');
      expect(probe.scroll.endFollow.state.get(), 'following');
    });
  }

  testWidgets('pause during pending publication cancels that live end request', (tester) async {
    final probe = await mountPauseProbe(tester);
    expect(probe.exposed.toKind(), 'dispatched');
    final before = probe.position.pixels;
    final publications = <String>[];
    String? pauseOutcome;
    void pausePending(native.NativeStateChange<String> event) {
      publications.add(event.next);
      if (event.next == 'pending') pauseOutcome = probe.exposed.pauseKind();
    }
    probe.scroll.endFollow.requestStatus.subscribers.add(pausePending);
    try {
      expect(probe.exposed.endKind(), 'rejected');
    } finally {
      probe.scroll.endFollow.requestStatus.subscribers.remove(pausePending);
    }
    expect(pauseOutcome, 'dispatched');
    expect(publications, ['pending', 'rejected']);
    expect(probe.position.pixels, before);
    expect(probe.scroll.endFollow.state.get(), 'paused');
    expect(probe.scroll.endFollow.requestStatus.get(), 'rejected');
    await tester.pumpAndSettle();
    expect(probe.position.pixels, before);

    expect(probe.exposed.endKind(), 'dispatched');
    expect(probe.scroll.endFollow.state.get(), 'following');
    expect(probe.scroll.endFollow.requestStatus.get(), 'applied');
    expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
  });

  testWidgets('paused append stays stationary until actual reader arrival resumes follow', (tester) async {
    final probe = await mountPauseProbe(tester);
    expect(probe.exposed.endKind(), 'dispatched');
    await tester.pumpAndSettle();
    expect(probe.exposed.pauseKind(), 'dispatched');
    final pausedPixels = probe.position.pixels;
    final oldMax = probe.position.maxScrollExtent;
    await probe.append(tester, 400);
    expect(probe.position.maxScrollExtent, greaterThan(oldMax));
    expect(probe.position.pixels, closeTo(pausedPixels, 0.001));
    expect(probe.scroll.endFollow.state.get(), 'paused');

    probe.notifications.clear();
    await tester.drag(probe.verticalView, const Offset(0, -700));
    await tester.pumpAndSettle();
    expect(probe.position.pixels, greaterThan(pausedPixels));
    expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
    expect(probe.notifications.whereType<ScrollUpdateNotification>().any(
      (event) => event.metrics.axis == Axis.vertical && (event.scrollDelta ?? 0) > 0), isTrue);
    expect(probe.scroll.endFollow.state.get(), 'following');

    final arrivedMax = probe.position.maxScrollExtent;
    await probe.append(tester, 400);
    expect(probe.position.maxScrollExtent, greaterThan(arrivedMax));
    expect(probe.position.pixels, closeTo(probe.position.maxScrollExtent, 0.001));
    expect(probe.scroll.endFollow.state.get(), 'following');
  });

  testWidgets('clamped reader intent with no native displacement preserves pause', (tester) async {
    final probe = await mountPauseProbe(tester);
    expect(probe.exposed.endKind(), 'dispatched');
    await tester.pumpAndSettle();
    expect(probe.exposed.pauseKind(), 'dispatched');
    final before = probe.position.pixels;
    final observedPixels = <double>[];
    void observePixels() => observedPixels.add(probe.position.pixels);
    probe.position.addListener(observePixels);
    probe.notifications.clear();
    try {
      await tester.drag(probe.verticalView, const Offset(0, -100));
      await tester.pumpAndSettle();
    } finally {
      probe.position.removeListener(observePixels);
    }
    expect(probe.notifications.whereType<UserScrollNotification>().any(
      (event) => event.metrics.axis == Axis.vertical && event.direction != ScrollDirection.idle), isTrue);
    expect(probe.position.pixels, closeTo(before, 0.001));
    expect(observedPixels.every((pixels) => (pixels - before).abs() < 0.001), isTrue);
    expect(probe.scroll.endFollow.state.get(), 'paused');
  });

  testWidgets('actual nested horizontal motion cannot resume vertical follow', (tester) async {
    final probe = await mountPauseProbe(tester, nestedHorizontal: true);
    final horizontal = probe.horizontalControl!.position;
    expect(horizontal.maxScrollExtent, greaterThan(horizontal.minScrollExtent));
    expect(probe.position.pixels, lessThan(probe.position.maxScrollExtent));
    expect(probe.exposed.pauseKind(), 'dispatched');
    final verticalBefore = probe.position.pixels;
    final horizontalBefore = horizontal.pixels;
    probe.notifications.clear();

    await tester.drag(find.byKey(const ValueKey('native-horizontal-reader')), const Offset(-1600, 0));
    await tester.pumpAndSettle();

    expect(horizontal.pixels, greaterThan(horizontalBefore));
    expect(horizontal.pixels, closeTo(horizontal.maxScrollExtent, 0.001));
    expect(probe.position.pixels, closeTo(verticalBefore, 0.001));
    expect(probe.notifications.whereType<ScrollUpdateNotification>().any(
      (event) => event.metrics.axis == Axis.horizontal && (event.scrollDelta ?? 0) > 0), isTrue);
    expect(probe.scroll.endFollow.state.get(), 'paused');
  });
}

String ordinaryRequest(dynamic exposed, String kind) => switch (kind) {
  'by-zero' => exposed.byZeroKind() as String,
  'page-after' => exposed.pageKind() as String,
  'to-end-position' => exposed.toEndPositionKind() as String,
  'drag-end-position' => exposed.dragEndPositionKind() as String,
  _ => throw ArgumentError.value(kind),
};

class ClampedReaderBehavior extends ScrollBehavior {
  const ClampedReaderBehavior();
  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const ClampingScrollPhysics();
}

class PauseProbe {
  PauseProbe(this.controller, this.extent, this.position, this.notifications, this.horizontalControl);
  final generated.CompiledComponentController controller;
  final ValueNotifier<double> extent;
  final ScrollPosition position;
  final List<ScrollNotification> notifications;
  final ScrollController? horizontalControl;
  dynamic get exposed => controller.getExposes();
  native.NativeScroll get scroll => controller.driver.scroll!;
  Finder get verticalView => find.byWidgetPredicate(
    (widget) => widget is SingleChildScrollView && widget.scrollDirection == Axis.vertical);
  Future<void> append(WidgetTester tester, double amount) async {
    extent.value += amount;
    await tester.pumpAndSettle();
  }
}

Future<PauseProbe> mountPauseProbe(WidgetTester tester, {bool nestedHorizontal = false}) async {
  final controller = generated.CompiledComponentController();
  final extent = ValueNotifier<double>(1600);
  final horizontal = nestedHorizontal ? ScrollController() : null;
  final notifications = <ScrollNotification>[];
  await tester.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: ScrollConfiguration(
      behavior: const ClampedReaderBehavior(),
      child: Center(child: SizedBox(width: 240, height: 200,
        child: NotificationListener<ScrollNotification>(
          onNotification: (event) { notifications.add(event); return false; },
          child: generated.CompiledComponent(
            controller: controller,
            child: ValueListenableBuilder<double>(
              valueListenable: extent,
              builder: (_, height, __) => SizedBox(
                width: 200, height: height,
                child: horizontal == null ? null : Align(
                  alignment: Alignment.topLeft,
                  child: SizedBox(width: 200, height: 140,
                    child: SingleChildScrollView(
                      key: const ValueKey('native-horizontal-reader'),
                      controller: horizontal,
                      scrollDirection: Axis.horizontal,
                      child: const SizedBox(width: 1200, height: 140),
                    )),
                ),
              ),
            ),
          ),
        ),
      )),
    ),
  ));
  await tester.pumpAndSettle();
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    extent.dispose();
    horizontal?.dispose();
  });
  expect(controller.ready, isTrue);
  final verticalView = find.byWidgetPredicate(
    (widget) => widget is SingleChildScrollView && widget.scrollDirection == Axis.vertical);
  expect(verticalView, findsOneWidget);
  final control = tester.widget<SingleChildScrollView>(verticalView).controller!;
  final position = control.position;
  expect(position.hasContentDimensions, isTrue);
  expect(position.viewportDimension, greaterThan(0));
  expect(position.maxScrollExtent, greaterThan(position.minScrollExtent));
  return PauseProbe(controller, extent, position, notifications, horizontal);
}
