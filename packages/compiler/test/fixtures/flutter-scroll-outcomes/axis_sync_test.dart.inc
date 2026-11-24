// Appended by the repository fixture, in the same real generated consumer.
void registerAxisSyncCases() {
  test('axes sync preserves setup policy and runtime authority', () {
    var invalidations = 0;
    final owner = native.NativeOwner<Object?>(() { invalidations++; }, null,
      makeProps: (value) => value, checks: {});
    final scroll = native.NativeScroll(owner);
    owner.scroll = scroll;
    scroll.configure({'axes':'vertical','projection':'system',
      'endFollow':{'mode':'while-at-end','axis':'vertical'}});
    expect(() => scroll.sync({'axes':'horizontal'}), throwsStateError);
    owner.finishSetup({});
    expect(() => scroll.sync({'axes':'horizontal'}), throwsStateError);
    for (final axes in <Object?>['diagonal', 1, false]) {
      expect(() => owner.inScope('consumer', () => scroll.sync({'axes':axes})), throwsArgumentError);
    }
    expect(scroll.config['axes'], 'vertical');
    owner.inScope('consumer', () => scroll.sync({'axes':'horizontal',
      'projection':'composed','endFollow':{'mode':'off'}}));
    expect(scroll.config, {'axes':'horizontal','projection':'system',
      'endFollow':{'mode':'while-at-end','axis':'vertical'}});
    owner.inScope('consumer', () => scroll.sync({}));
    expect(scroll.config['axes'], 'horizontal');
    expect(invalidations, 0); // Detached intent did not move a native surface.
    owner.close();
    expect(() => owner.inScope('consumer', () => scroll.sync({'axes':'vertical'})), throwsStateError);
  });

  testWidgets('emitted axis callbacks rebuild only the current physical scroll surface', (tester) async {
    final controller = generated.CompiledComponentController();
    await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 240, height: 200,
        child: generated.CompiledComponent(controller: controller,
          child: const SizedBox(width: 1600, height: 1600))))));
    await tester.pumpAndSettle();
    final exposed = controller.getExposes();
    final scroll = controller.driver.scroll!;
    final vertical = tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView));
    final oldPosition = vertical.controller!.position;
    expect(oldPosition.maxScrollExtent, greaterThan(0));
    expect(exposed.toKind(), 'dispatched');
    await tester.pumpAndSettle();
    final oldPixels = oldPosition.pixels;
    exposed.syncExtra();
    expect(scroll.axes.get(), 'vertical'); // The old native view still owns facts.
    expect(exposed.toKind(), 'rejected'); // New intent cannot move the old axis.
    await tester.pumpAndSettle();
    final horizontal = tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView));
    expect(horizontal.scrollDirection, Axis.horizontal);
    expect(horizontal.controller!.position.maxScrollExtent, greaterThan(0));
    expect(tester.getSize(find.byWidget(horizontal)), const Size(240, 200));
    expect(horizontal.controller!.position.viewportDimension, 240);
    expect(horizontal.clipBehavior, Clip.hardEdge);
    expect(identical(horizontal.controller!.position, oldPosition), isFalse);
    expect(vertical.controller!.hasClients, isFalse);
    expect(oldPosition.pixels, oldPixels);
    expect(scroll.axes.get(), 'horizontal');
    expect(scroll.projection.get(), 'system');
    expect(scroll.config['endFollow'], {'mode':'while-at-end','axis':'vertical'});
    expect(exposed.toKind(), 'rejected');
    expect(exposed.wrongAxisKind(), 'dispatched');
    await tester.pumpAndSettle();
    final stable = tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView));
    exposed.syncOmitted();
    exposed.syncHorizontal();
    await tester.pumpAndSettle();
    expect(identical(tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView)), stable), isTrue);
    controller.setPresent(false);
    exposed.syncBoth();
    await tester.pumpAndSettle();
    expect(find.byType(SingleChildScrollView), findsNothing);
    expect(oldPosition.pixels, oldPixels);
    controller.setPresent(true);
    await tester.pumpAndSettle();
    expect(find.byType(SingleChildScrollView), findsNWidgets(2));
    expect(scroll.axes.get(), 'both');
    final retained = exposed.syncVertical;
    controller.dispose();
    expect(retained, throwsStateError);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('axis replacement during pending request prevents old native movement', (tester) async {
    final probe = await mountPauseProbe(tester);
    expect(probe.exposed.toKind(), 'dispatched');
    await tester.pumpAndSettle();
    final before = probe.position.pixels;
    final publications = <String>[];
    final scroll = probe.controller.driver.scroll!;
    void replace(native.NativeStateChange<String> event) {
      publications.add(event.next);
      if (event.next == 'pending') probe.exposed.syncHorizontal();
    }
    scroll.endFollow.requestStatus.subscribers.add(replace);
    try { expect(probe.exposed.endKind(), 'rejected'); }
    finally { scroll.endFollow.requestStatus.subscribers.remove(replace); }
    expect(publications, ['pending','rejected']);
    expect(probe.position.pixels, before);
    await tester.pumpAndSettle();
    expect(tester.widget<SingleChildScrollView>(find.byType(SingleChildScrollView)).scrollDirection, Axis.horizontal);
    probe.controller.dispose();
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
