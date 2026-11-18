import 'package:flutter/widgets.dart';
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
}
