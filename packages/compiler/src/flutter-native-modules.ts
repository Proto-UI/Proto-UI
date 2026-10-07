export const flutterNativeModulesSource = `
// Concrete Flutter module resources. Config maps are declaration records, never executable IR.
class NativeFocusScopeKey { NativeFocusScopeKey(this.debugName, this.meta); final String debugName; final Map<String, Object?> meta; }
class NativeFocusRovingKey { NativeFocusRovingKey(this.debugName, this.meta); final String debugName; final Map<String, Object?> meta; }
class NativeHostTarget {
  NativeHostTarget(this.key, {this.acceptsRead});
  final GlobalKey key;
  final bool Function()? acceptsRead;
  bool alive = true;
  final ValueNotifier<String> participation = ValueNotifier('participating');
  final ValueNotifier<NativeHostGeometry?> geometry = ValueNotifier(null);
  void Function(PointerEvent)? pointerRoute;
  RenderBox? get physicalBox { if (!alive) return null; final object = key.currentContext?.findRenderObject(); return object is RenderBox && object.attached && object.hasSize ? object : null; }
  RenderBox? get box => acceptsRead?.call() == false ? null : physicalBox;
  Rect? get bounds { final target = box; return target == null ? null : target.localToGlobal(Offset.zero) & target.size; }
  void dispose() { if (!alive) return; alive = false; pointerRoute = null; participation.dispose(); geometry.dispose(); }
}
class NativeHostGeometry {
  const NativeHostGeometry({this.width, this.height, this.offset = Offset.zero});
  final double? width, height;
  final Offset offset;
}
class NativeHostRegion extends StatelessWidget {
  const NativeHostRegion({super.key, required this.target, required this.child, this.ownsKey = true});
  final NativeHostTarget target;
  final Widget child;
  final bool ownsKey;
  @override Widget build(BuildContext context) => ValueListenableBuilder<String>(valueListenable: target.participation, child: ownsKey ? KeyedSubtree(key: target.key, child: child) : child, builder: (_, mode, child) => ValueListenableBuilder<NativeHostGeometry?>(valueListenable: target.geometry, child: child, builder: (_, geometry, child) {
    Widget result = child!;
    if (geometry != null) result = Transform.translate(offset: geometry.offset, child: SizedBox(width: geometry.width, height: geometry.height, child: result));
    if (mode == 'disabled') result = AbsorbPointer(child: result);
    if (mode == 'passthrough') result = IgnorePointer(child: result);
    return result;
  }));
}
class NativeFocusEntry {
  NativeFocusEntry(this.owner);
  final NativeOwner<Object?> owner;
  Map<String, Object?> config = const {};
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); config = {...config, ...patch}; }
  void setDisabled(bool value) { owner.ensureRuntime(); config = {...config, 'disabled': value}; }
  void focus([Map<String, Object?> options = const {}]) {
    owner.ensureRuntime(); if (!owner.ready || config['disabled'] == true) return;
    if (config['strategy'] == 'descendant-first') {
      final descendants = NativeOwner._liveOwners.where((candidate) => candidate != owner && candidate.ready && candidate.focusAvailable && !candidate.focus.disabled && nativeLogicalDescendant(candidate,owner)).toList()..sort(NativeAnatomy.compareOwners);
      if (descendants.isNotEmpty) { final target = descendants.first; target.inScope('native-focus', () => target.focus.focusSelf(options)); return; }
      if (config['fallback'] == 'none') return;
    }
    owner.focus.focusSelf(options);
  }
}
bool nativeLogicalDescendant(NativeOwner<Object?> candidate, NativeOwner<Object?> ancestor) { NativeContextScope? current = candidate.context; while (current != null) { if (current.owner == ancestor) return true; current = current.parent; } return false; }
class NativeFocusScope {
  NativeFocusScope(this.owner) : active = NativeState<bool>(owner,'bool','focus.active',false,const {},observed:true), hasFocused = NativeState<bool>(owner,'bool','focus.hasFocused',false,const {},observed:true) { FocusManager.instance.addListener(_refresh); }
  final NativeOwner<Object?> owner;
  final FocusScopeNode node = FocusScopeNode();
  FocusNode? previous;
  final NativeState<bool> active, hasFocused;
  bool loop = false;
  String orientation = 'both';
  Map<String, Object?> config = const {};
  bool get roving => false;
  List<NativeOwner<Object?>> get members {
    final key = config['key'];
    final values = NativeOwner._liveOwners.where((candidate) {
      if (!candidate.ready || !candidate.focusAvailable || candidate.focus.disabled || !candidate.focus.nav || candidate == owner) return false;
      final declared = roving ? candidate.focus.groupKey : candidate.focus.scopeKey;
      if (declared != null) return key != null && identical(declared,key);
      NativeContextScope? current = candidate.context.parent;
      while (current != null) { if (current.owner == owner) return true; final parent = current.owner; if (parent is NativeOwner<Object?> && (roving ? parent.focusRoving != null : parent.focusScope != null)) return false; current = current.parent; }
      return false;
    }).toList()..sort(NativeAnatomy.compareOwners);
    return values;
  }
  List<FocusNode> get targets => members.map((member) => member.focus.node).toList(growable:false);
  void configure(Map<String, Object?> patch) {
    owner.ensureSetup(); config = {...config, ...patch}; loop = patch['loop'] as bool? ?? loop; orientation = patch['orientation'] as String? ?? orientation;
    final group = patch['group']; if (!roving && group != null && group != false) { final handle = owner.focusRoving ??= NativeFocusRoving(owner); handle.configure(group is Map<String,Object?> ? group : const {}); }
  }
  NativeFocusRoving? getRoving() { owner.ensureAlive(); final existing = owner.focusRoving; if (existing != null) return existing; final handle = owner.focusRoving = NativeFocusRoving(owner); owner.project(); return handle; }
  void _request(NativeOwner<Object?> target, Map<String,Object?> options) { if (options['defer'] == true) { final epoch = owner.epoch; WidgetsBinding.instance.addPostFrameCallback((_) { if (owner.alive && owner.ready && owner.epoch == epoch && target.ready) target.inScope('native-focus', () => target.focus.focusSelf(options)); }); } else target.inScope('native-focus', () => target.focus.focusSelf(options)); }
  void focusFirst([Map<String,Object?> options = const {}]) { owner.ensureRuntime(); final values = members; if (values.isNotEmpty) _request(values.first,options); else if (config['emptyPolicy'] != 'none' && owner.ready) owner.focus.focusSelf(options); }
  void focusLast([Map<String,Object?> options = const {}]) { owner.ensureRuntime(); final values = members; if (values.isNotEmpty) _request(values.last,options); }
  void focusNext() => _move(1);
  void focusPrev() => _move(-1);
  void _move(int delta) { owner.ensureRuntime(); final values = members; if (values.isEmpty) return; final current = values.indexWhere((member) => member.focus.node.hasFocus); int next = current < 0 ? delta > 0 ? 0 : values.length - 1 : current + delta; if (loop) next = next % values.length; if (next >= 0 && next < values.length) _request(values[next],const {'reason':'keyboard'}); }
  void focusSelected([Map<String, Object?> options = const {}]) { owner.ensureRuntime(); final values = members; final selected = values.where((member) => member.focus.rovingSelected).firstOrNull; if (selected != null) _request(selected,options); else focusFirst(options); }
  void activate([Map<String, Object?> options = const {}]) { owner.ensureRuntime(); if (!active.get()) previous = FocusManager.instance.primaryFocus; active.publish(true); final entry = config['entry'] ?? 'first'; if (entry == 'selected') focusSelected(options); else if (entry == 'active') { final current = members.where((member) => member.focus.rovingActive).firstOrNull; if (current != null) _request(current,options); else focusFirst(options); } else if (entry == 'container') owner.focus.focusSelf(options); else if (entry != 'manual') focusFirst(options); owner.project(); }
  void deactivate([Map<String, Object?> options = const {}]) { owner.ensureRuntime(); active.publish(false); if (config['restore'] != 'none') restoreFocus(); owner.project(); }
  void restoreFocus() { owner.ensureRuntime(); final target = previous; if (target != null && target.context != null && target.canRequestFocus) target.requestFocus(); }
  bool isActive() { owner.ensureAlive(); return active.get(); }
  void _refresh() { if (!owner.alive) return; final values = members; final focused = values.any((member) => member.focus.node.hasFocus); hasFocused.publish(focused); if (roving) active.publish(focused); if (roving && config['selectOnFocus'] == true) { for (final member in values) member.focus.rovingSelected = member.focus.node.hasFocus; } }
  KeyEventResult key(KeyEvent event) {
    if (event is! KeyDownEvent || !owner.ready) return KeyEventResult.ignored;
    final navigation = config['navigation'] as String? ?? (roving ? 'arrow' : 'tab');
    final key = event.logicalKey;
    if (key == LogicalKeyboardKey.tab && navigation.contains('tab') && (loop || config['trap'] == true)) { final values = members; if (values.isEmpty) return config['trap'] == true ? KeyEventResult.handled : KeyEventResult.ignored; final delta = HardwareKeyboard.instance.isShiftPressed ? -1 : 1; final current = values.indexWhere((member) => member.focus.node.hasFocus); var next = current+delta; if (next < 0 || next >= values.length) { if (!loop && config['trap'] != true) return KeyEventResult.ignored; next = (next+values.length)%values.length; } _request(values[next],const {'reason':'keyboard'}); return KeyEventResult.handled; }
    if (!navigation.contains('arrow')) return KeyEventResult.ignored;
    if (key == LogicalKeyboardKey.home) { focusFirst(); return KeyEventResult.handled; }
    if (key == LogicalKeyboardKey.end) { focusLast(); return KeyEventResult.handled; }
    if (orientation != 'vertical' && key == LogicalKeyboardKey.arrowRight || orientation != 'horizontal' && key == LogicalKeyboardKey.arrowDown) { focusNext(); return KeyEventResult.handled; }
    if (orientation != 'vertical' && key == LogicalKeyboardKey.arrowLeft || orientation != 'horizontal' && key == LogicalKeyboardKey.arrowUp) { focusPrev(); return KeyEventResult.handled; }
    return KeyEventResult.ignored;
  }
  Widget wrap(Widget child) => FocusScope(node: node, onKeyEvent: (_,event) => owner.inScope('event', () => key(event)), child: FocusTraversalGroup(policy: WidgetOrderTraversalPolicy(), child: child));
  void dispose() { FocusManager.instance.removeListener(_refresh); node.dispose(); active.subscribers.clear(); hasFocused.subscribers.clear(); }
}
class NativeFocusRoving extends NativeFocusScope {
  NativeFocusRoving(super.owner);
  @override bool get roving => true;
  void setLoop(bool value) { owner.ensureRuntime(); loop = value; }
  void setOrientation(String value) { owner.ensureRuntime(); if (!['horizontal', 'vertical', 'both'].contains(value)) throw ArgumentError('Invalid roving orientation'); orientation = value; }
}
class NativeAnatomyFamily {
  NativeAnatomyFamily(this.debugName, this.declaration);
  final String debugName;
  final Map<String, Object?> declaration;
}
final nativeTableFamily = NativeAnatomyFamily('base-table', const {'roles': {'root': {}, 'caption': {}, 'row': {}, 'headerCell': {}, 'cell': {}}});
class NativeTableStates {
  NativeTableStates(NativeOwnerBase owner) : a11yRole = NativeState<String>(owner, 'string', 'tableA11yRole', '', const {}), rowCount = NativeState<double>(owner, 'number.discrete', 'tableRowCount', 0, const {}), columnCount = NativeState<double>(owner, 'number.discrete', 'tableColumnCount', 0, const {}), row = NativeState<double>(owner, 'number.discrete', 'tableRow', -1, const {}), column = NativeState<double>(owner, 'number.discrete', 'tableColumn', -1, const {}), rowSpan = NativeState<double>(owner, 'number.discrete', 'tableRowSpan', 0, const {}), columnSpan = NativeState<double>(owner, 'number.discrete', 'tableColumnSpan', 0, const {});
  final NativeState<String> a11yRole;
  final NativeState<double> rowCount, columnCount, row, column, rowSpan, columnSpan;
  void dispose() { for (final state in <NativeState<Object?>>[a11yRole,rowCount,columnCount,row,column,rowSpan,columnSpan]) state.subscribers.clear(); }
}
class NativeTableDiagnostic {
  const NativeTableDiagnostic(this.code, {this.ref, this.row, this.headerKey});
  final String code;
  final NativeA11yRef? ref;
  final double? row;
  final String? headerKey;
}
class NativeTableCell {
  NativeTableCell(this.ref, this.kind, this.row, this.column, this.rowSpan, this.columnSpan, List<NativeA11yRef> columnHeaders, List<NativeA11yRef> rowHeaders, List<NativeA11yRef> orderedHeaders) : columnHeaders = List.unmodifiable(columnHeaders), rowHeaders = List.unmodifiable(rowHeaders), orderedHeaders = List.unmodifiable(orderedHeaders);
  final NativeA11yRef ref;
  final String kind;
  final double row, column, rowSpan, columnSpan;
  final List<NativeA11yRef> columnHeaders, rowHeaders, orderedHeaders;
}
class NativeTableRow {
  NativeTableRow(this.ref, this.index, List<NativeTableCell> cells) : cells = List.unmodifiable(cells);
  final NativeA11yRef ref;
  final double index;
  final List<NativeTableCell> cells;
}
class NativeTableSnapshot {
  NativeTableSnapshot(this.root, this.caption, this.rowCount, this.columnCount, List<NativeTableRow> rows, List<NativeTableDiagnostic> diagnostics) : rows = List.unmodifiable(rows), diagnostics = List.unmodifiable(diagnostics);
  final NativeA11yRef root;
  final NativeA11yRef? caption;
  final double rowCount, columnCount;
  final List<NativeTableRow> rows;
  final List<NativeTableDiagnostic> diagnostics;
  bool get valid => diagnostics.isEmpty;
}
class NativeTableStructure {
  NativeTableStructure(this.owner, this.role) : states = NativeTableStates(owner) {
    if (!['root','caption','row','headerCell','cell'].contains(role)) throw ArgumentError('Invalid table role');
  }
  final NativeOwner<Object?> owner;
  final String role;
  final NativeTableStates states;
  Map<String, Object?> config = const {};
  NativeTableSnapshot? _snapshot;
  void configure(Map<String, Object?> patch) { owner.ensureRuntime(); config = Map.unmodifiable({...config, ...patch, if (patch['headers'] is List<Object?>) 'headers': List<Object?>.unmodifiable(patch['headers'] as List<Object?>)}); refreshAll(); }
  NativeA11yRef getObjectRef() { owner.ensureAlive(); return owner.accessible.objectRef; }
  NativeTableSnapshot? getSnapshot() { owner.ensureAlive(); return _snapshot; }
  static void refreshAll() {
    for (final participant in NativeOwner._liveOwners) { final table = participant.tableStructure; if (table != null && table.role == 'root' && participant.ready) table._recompute(); }
  }
  void clear() {
    states.a11yRole.publish(''); states.row.publish(0); states.column.publish(0); states.rowSpan.publish(0); states.columnSpan.publish(0);
    states.rowCount.publish(0); states.columnCount.publish(0);
    for (final name in ['columnHeaders','rowHeaders','labelledBy','caption']) owner.accessible.relations[name] = const {'target': <Object?>[]};
    _snapshot = null;
  }
  void _recompute() {
    final rootClaim = NativeAnatomy.claims.where((claim) => claim.owner == owner && identical(claim.family,nativeTableFamily) && claim.role == 'root').firstOrNull;
    if (rootClaim == null) { clear(); return; }
    final claims = NativeAnatomy.claims.where((claim) => identical(claim.family,nativeTableFamily) && claim.owner.ready && owner.anatomy._within(claim.owner, owner, nativeTableFamily) && claim.owner.tableStructure != null).toList()..sort((a,b) => NativeAnatomy.compareOwners(a.owner,b.owner));
    final diagnostics = <NativeTableDiagnostic>[];
    final parts = <NativeTableStructure>[];
    for (final claim in claims) {
      final part = claim.owner.tableStructure!;
      if (claim.role != part.role) diagnostics.add(NativeTableDiagnostic('role-mismatch', ref: part.getObjectRef()));
      else parts.add(part);
    }
    final captions = parts.where((part) => part.role == 'caption').toList();
    final rows = parts.where((part) => part.role == 'row').toList();
    final cells = parts.where((part) => part.role == 'headerCell' || part.role == 'cell').toList();
    if (captions.length > 1) diagnostics.add(const NativeTableDiagnostic('multiple-captions'));
    if (rows.isEmpty) diagnostics.add(const NativeTableDiagnostic('missing-row'));
    final input = <List<NativeTableStructure>>[for (final _ in rows) []];
    for (final cell in cells) {
      NativeContextScope? scope = cell.owner.context.parent;
      int index = -1;
      while (scope != null && scope.owner != owner) { index = rows.indexWhere((row) => row.owner == scope!.owner); if (index >= 0) break; scope = scope.parent; }
      if (index < 0) diagnostics.add(NativeTableDiagnostic('missing-row-parent', ref: cell.getObjectRef()));
      else input[index].add(cell);
    }
    final orderedCells = input.expand((row) => row).toList();
    if (!orderedCells.any((cell) => cell.role == 'headerCell')) diagnostics.add(const NativeTableDiagnostic('missing-header-cell'));
    if (!orderedCells.any((cell) => cell.role == 'cell')) diagnostics.add(const NativeTableDiagnostic('missing-cell'));
    final dimensions = <NativeTableStructure, (int,int)>{};
    final headers = <String,List<NativeTableStructure>>{};
    for (int r = 0; r < rows.length; r++) {
      if (input[r].isEmpty) diagnostics.add(NativeTableDiagnostic('empty-row', ref: rows[r].getObjectRef(), row: r.toDouble()));
      for (final cell in input[r]) {
        final ref = cell.getObjectRef();
        if (cell.role == 'headerCell') {
          final key = cell.config['headerKey'] as String?;
          if (key == null || key.isEmpty) diagnostics.add(NativeTableDiagnostic('missing-header-key',ref: ref,row: r.toDouble()));
          else headers.putIfAbsent(key, () => []).add(cell);
          if (!['row','column'].contains(cell.config['headerKind'])) diagnostics.add(NativeTableDiagnostic('missing-header-kind',ref: ref,row: r.toDouble()));
        }
        final rs = cell.config['rowSpan'] as num? ?? 1, cs = cell.config['columnSpan'] as num? ?? 1;
        if (!rs.isFinite || !cs.isFinite || rs <= 0 || cs <= 0 || rs % 1 != 0 || cs % 1 != 0 || rs > 9007199254740991 || cs > 9007199254740991) diagnostics.add(NativeTableDiagnostic('invalid-span',ref:ref));
        else dimensions[cell] = (rs.toInt(),cs.toInt());
      }
    }
    for (final entry in headers.entries) { if (entry.value.length > 1) diagnostics.add(NativeTableDiagnostic('duplicate-header-key',ref:entry.value.first.getObjectRef(),headerKey:entry.key)); }
    final occupied = <int,List<(int,int)>>{};
    final placement = <NativeTableStructure,(int,int,int,int)>{};
    int columns = 0;
    for (int r = 0; r < rows.length; r++) {
      int cursor = 0;
      for (final cell in input[r]) {
        final size = dimensions[cell]; if (size == null) continue;
        if (r + size.$1 > rows.length) { diagnostics.add(NativeTableDiagnostic('row-span-out-of-range',ref:cell.getObjectRef(),row:r.toDouble())); continue; }
        int column = cursor;
        for (;;) {
          int next = column;
          for (int offset = 0; offset < size.$1; offset++) { for (final interval in occupied[r+offset] ?? <(int,int)>[]) { if (interval.$2 > column && interval.$1 < column + size.$2 && interval.$2 > next) next = interval.$2; } }
          if (next == column) break; column = next;
        }
        if (column + size.$2 > 9007199254740991) { diagnostics.add(NativeTableDiagnostic('column-range-out-of-range',ref:cell.getObjectRef(),row:r.toDouble())); continue; }
        for (int offset = 0; offset < size.$1; offset++) occupied.putIfAbsent(r+offset, () => []).add((column,column+size.$2));
        placement[cell] = (r,column,size.$1,size.$2); cursor = column+size.$2; if (cursor > columns) columns = cursor;
      }
    }
    final projected = <NativeTableStructure,NativeTableCell>{};
    for (int r = 0; r < rows.length; r++) {
      for (final cell in input[r]) {
        final references = cell.config['headers'] as List<Object?>? ?? const [];
        if (cell.role == 'cell' && references.isEmpty) diagnostics.add(NativeTableDiagnostic('missing-cell-headers',ref:cell.getObjectRef(),row:r.toDouble()));
        final source = placement[cell], seen = <String>{};
        final columnHeaders = <NativeA11yRef>[], rowHeaders = <NativeA11yRef>[], ordered = <NativeA11yRef>[];
        for (final raw in references) {
          final key = raw as String; String? failure;
          final matches = headers[key]; final target = matches?.length == 1 ? placement[matches!.single] : null;
          if (key.isEmpty) failure = 'empty-header-reference'; else if (!seen.add(key)) failure = 'duplicate-header-reference'; else if (matches == null) failure = 'missing-header-target'; else if (matches.length != 1) failure = 'ambiguous-header-target'; else if (target == null) failure = 'unprojectable-header-target'; else if (cell.role == 'headerCell' && source != null && (target.$1 > source.$1 || target.$1 == source.$1 && target.$2 >= source.$2)) failure = 'non-upstream-header-target';
          if (failure != null) { diagnostics.add(NativeTableDiagnostic(failure,ref:cell.getObjectRef(),row:r.toDouble(),headerKey:key)); continue; }
          if (source == null) continue;
          final header = matches!.single; final ref = header.getObjectRef(); ordered.add(ref); (header.config['headerKind'] == 'row' ? rowHeaders : columnHeaders).add(ref);
        }
        if (source != null) projected[cell] = NativeTableCell(cell.getObjectRef(),cell.role == 'cell' ? 'cell' : cell.config['headerKind'] == 'row' ? 'row-header' : 'column-header',source.$1.toDouble(),source.$2.toDouble(),source.$3.toDouble(),source.$4.toDouble(),columnHeaders,rowHeaders,ordered);
      }
    }
    final snapshot = NativeTableSnapshot(getObjectRef(),captions.length == 1 ? captions.single.getObjectRef() : null,rows.length.toDouble(),columns.toDouble(),[for (int r = 0; r < rows.length; r++) NativeTableRow(rows[r].getObjectRef(),r.toDouble(),[for (final cell in input[r]) if (projected[cell] != null) projected[cell]!])],diagnostics);
    _snapshot = snapshot;
    if (!snapshot.valid) { for (final claim in claims) { final table = claim.owner.tableStructure!; table.clear(); } _snapshot = snapshot; return; }
    states.a11yRole.publish('table'); states.rowCount.publish(snapshot.rowCount); states.columnCount.publish(snapshot.columnCount);
    owner.accessible.relations['caption'] = {'target': [if (snapshot.caption != null) snapshot.caption!]}; owner.accessible.relations['labelledBy'] = owner.accessible.relations['caption']!;
    if (captions.length == 1) captions.single.states.a11yRole.publish('caption');
    for (int r = 0; r < rows.length; r++) { rows[r].states.a11yRole.publish('row'); rows[r].states.row.publish(r+1.0); }
    for (final entry in projected.entries) {
      final cell = entry.key, view = entry.value; cell.states.a11yRole.publish(view.kind == 'cell' ? 'cell' : view.kind == 'row-header' ? 'rowheader' : 'columnheader'); cell.states.row.publish(view.row+1); cell.states.column.publish(view.column+1); cell.states.rowSpan.publish(view.rowSpan); cell.states.columnSpan.publish(view.columnSpan);
      cell.owner.accessible.relations['columnHeaders'] = {'target':view.columnHeaders}; cell.owner.accessible.relations['rowHeaders'] = {'target':view.rowHeaders}; cell.owner.accessible.relations['labelledBy'] = {'target': [if (view.orderedHeaders.isNotEmpty) ...[...view.orderedHeaders,view.ref]]};
    }
  }
  void dispose() { clear(); states.dispose(); }
}
class NativeAnatomyPart {
  NativeAnatomyPart(this.owner, this.role);
  final NativeOwner<Object?> owner;
  final String role;
  bool hasExpose(String name) { owner.ensureAlive(); return owner._exposeNames.contains(name); }
  Object? getExpose(String name) { owner.ensureAlive(); return owner.publicExposure(name); }
  bool hasHook(String name) { owner.ensureAlive(); return owner.hookNames.contains(name); }
  NativeHostTarget get target => owner.hostTarget;
}
class _AnatomyClaim { _AnatomyClaim(this.owner, this.family, this.role) : part = NativeAnatomyPart(owner,role); final NativeOwner<Object?> owner; final NativeAnatomyFamily family; final String role; final NativeAnatomyPart part; }
class NativeAnatomy {
  NativeAnatomy(this.owner);
  final NativeOwner<Object?> owner;
  static final List<_AnatomyClaim> claims = [];
  static int version = 0;
  final List<void Function()> removals = [];
  static int compareOwners(NativeOwner<Object?> a, NativeOwner<Object?> b) {
    if (identical(a,b)) return 0;
    List<Element> path(BuildContext? context) { if (context is! Element) return const []; final result = <Element>[context]; context.visitAncestorElements((element) { result.add(element); return true; }); return result.reversed.toList(); }
    final left = path(a.logicalContext), right = path(b.logicalContext);
    int shared = 0; while (shared < left.length && shared < right.length && identical(left[shared],right[shared])) shared++;
    if (shared > 0) {
      if (shared == left.length) return -1; if (shared == right.length) return 1;
      int index = 0, li = -1, ri = -1; left[shared-1].visitChildElements((child) { if (identical(child,left[shared])) li = index; if (identical(child,right[shared])) ri = index; index++; });
      if (li >= 0 && ri >= 0) return li.compareTo(ri);
    }
    return a.logicalOrder.compareTo(b.logicalOrder);
  }
  void claim(NativeAnatomyFamily family, Map<String, Object?> declaration) {
    owner.ensureSetup(); final role = declaration['role'] as String;
    final roles = family.declaration['roles'] as Map<String, Object?>?;
    if (roles != null && !roles.containsKey(role)) throw ArgumentError('Undeclared Anatomy role');
    if (claims.any((entry) => entry.owner == owner && entry.family == family)) throw StateError('Duplicate Anatomy claim');
    claims.add(_AnatomyClaim(owner, family, role)); version++;
  }
  NativeOwner<Object?> _root(NativeAnatomyFamily family) {
    NativeContextScope? scope = owner.context;
    while (scope != null) { final matches = claims.where((entry) => entry.owner == scope!.owner && entry.family == family && entry.role == 'root'); if (matches.isNotEmpty) return matches.first.owner; scope = scope.parent; }
    throw StateError('Anatomy root missing: \${family.debugName}');
  }
  bool _within(NativeOwner<Object?> candidate, NativeOwner<Object?> root, NativeAnatomyFamily family) {
    NativeContextScope? current = candidate.context;
    while (current != null) {
      if (current.owner == root) return true;
      if (claims.any((entry) => entry.owner == current!.owner && entry.family == family && entry.role == 'root')) return false;
      current = current.parent;
    }
    return false;
  }
  List<NativeAnatomyPart> parts(NativeAnatomyFamily family, [String? role]) {
    owner.ensureAlive(); final root = _root(family);
    final matching = claims.where((entry) => entry.family == family && entry.owner.ready && (role == null || entry.role == role) && _within(entry.owner, root, family)).toList();
    matching.sort((a,b) => compareOwners(a.owner,b.owner));
    return List.unmodifiable(matching.map((entry) => entry.part));
  }
  bool has(NativeAnatomyFamily family, String role) => parts(family, role).isNotEmpty;
  int orderVersion(NativeAnatomyFamily family) { _root(family); return version; }
  int indexOfSelf(NativeAnatomyFamily family, String role) => parts(family, role).indexWhere((part) => part.owner == owner);
  NativeAnatomyPart? neighbor(NativeAnatomyFamily family, String role, int delta) { final values = parts(family, role); final index = values.indexWhere((part) => part.owner == owner); final next = index + delta; return index < 0 || next < 0 || next >= values.length ? null : values[next]; }
  void Function() subscribeParts(NativeAnatomyFamily family, String role, void Function(List<NativeAnatomyPart>) callback) {
    owner.ensureSetup(); bool active = true; List<NativeOwner<Object?>> previous = [];
    final removal = owner.onCommit(() { if (!active) return; final next = parts(family, role); final identities = next.map((part) => part.owner).toList(); if (identities.length == previous.length && List.generate(identities.length, (index) => identities[index] == previous[index]).every((same) => same)) return; previous = identities; callback(next); });
    removals.add(removal); return () { owner.ensureSetup(); active = false; removal(); };
  }
  void dispose() { claims.removeWhere((entry) => entry.owner == owner); version++; for (final removal in removals) removal(); removals.clear(); }
}
class NativeCollectionSnapshot {
  NativeCollectionSnapshot(Map<String,Object?> values) : values = Map.unmodifiable(values);
  final Map<String,Object?> values;
  double get index => values['index'] as double;
  double get total => values['total'] as double;
  bool get first => values['first'] as bool;
  bool get last => values['last'] as bool;
  Object? operator [](String key) => values[key];
}
class NativeCollection {
  NativeCollection(this.owner) : count = NativeState<double>(owner,'number.discrete','collectionCount',0,const {}) { _offCommit = owner.onCommit(_sync); }
  final NativeOwner<Object?> owner;
  final NativeState<double> count;
  late final void Function() _offCommit;
  NativeAnatomyFamily? family;
  String role = 'item';
  String itemMetaExposeKey = '__collectionItem';
  void configure(Map<String, Object?> patch) {
    owner.ensureSetup(); family = patch['family'] as NativeAnatomyFamily; role = patch['itemRole'] as String? ?? role; itemMetaExposeKey = patch['itemMetaExposeKey'] as String? ?? itemMetaExposeKey;
    final ownerRole = patch['ownerRole'] ?? patch['rootRole']; if (ownerRole is String) owner.anatomy.claim(family!, {'role':ownerRole});
    owner.moduleExpose(patch['exposeCountStateKey'] as String? ?? 'count',count.external);
    owner.moduleExpose(patch['exposeItemsMethodKey'] as String? ?? 'getCollectionItems',() { owner.ensureExternal(); return getItems(); });
    owner.moduleExpose(patch['exposeCountMethodKey'] as String? ?? 'getCollectionCount',() { owner.ensureExternal(); return getCount(); });
  }
  List<NativeCollectionSnapshot> getItems() {
    owner.ensureAlive(); final key = family; if (key == null) return const []; final parts = owner.anatomy.parts(key, role);
    return List<NativeCollectionSnapshot>.unmodifiable([for (int i = 0; i < parts.length; i++) NativeCollectionSnapshot(<String,Object?>{..._meta(parts[i]),'index':i.toDouble(),'total':parts.length.toDouble(),'first':i == 0,'last':i == parts.length-1})]);
  }
  Map<String,Object?> _meta(NativeAnatomyPart part) { final exposed = part.getExpose(itemMetaExposeKey); if (exposed is NativeCollectionSnapshot Function()) return exposed().values; if (exposed is Map<String,Object?> Function()) return exposed(); if (exposed is Map<String,Object?>) return exposed; return const {}; }
  double getCount() { owner.ensureAlive(); final key = family; return key == null ? 0 : owner.anatomy.parts(key,role).length.toDouble(); }
  void _sync() { if (family != null && owner.ready) count.publish(getCount()); }
  void dispose() { _offCommit(); count.subscribers.clear(); }
}
class NativeCollectionItem<P> {
  NativeCollectionItem(this.owner) : collectionIndex = NativeState<double>(owner,'number.discrete','collectionIndex',-1,const {}), collectionTotal = NativeState<double>(owner,'number.discrete','collectionTotal',0,const {}), collectionFirst = NativeState<bool>(owner,'bool','collectionFirst',false,const {}), collectionLast = NativeState<bool>(owner,'bool','collectionLast',false,const {}) { _offCommit = owner.onCommit(_sync); }
  final NativeOwner<P> owner;
  final NativeState<double> collectionIndex, collectionTotal;
  final NativeState<bool> collectionFirst, collectionLast;
  late final void Function() _offCommit;
  NativeAnatomyFamily? family;
  String role = 'item';
  Map<String, Object?> meta = {};
  Map<String,Object?> Function(NativeRun<P>)? getMeta;
  void configure(Map<String, Object?> patch) {
    owner.ensureSetup(); family = patch['family'] as NativeAnatomyFamily; role = patch['role'] as String? ?? role; getMeta = patch['getMeta'] as Map<String,Object?> Function(NativeRun<P>)?; owner.anatomy.claim(family!, {'role': role});
    owner.moduleExpose(patch['exposeIndexStateKey'] as String? ?? 'collectionIndex',collectionIndex.external); owner.moduleExpose(patch['exposeTotalStateKey'] as String? ?? 'collectionTotal',collectionTotal.external); owner.moduleExpose(patch['exposeFirstStateKey'] as String? ?? 'collectionFirst',collectionFirst.external); owner.moduleExpose(patch['exposeLastStateKey'] as String? ?? 'collectionLast',collectionLast.external);
    NativeCollectionSnapshot externalSnapshot() { owner.ensureExternal(); return owner.inScope('expose-method',getSnapshot); }
    owner.moduleExpose(patch['exposeSnapshotMethodKey'] as String? ?? 'getCollectionItem',externalSnapshot); owner.moduleExpose(patch['metaExposeKey'] as String? ?? '__collectionItem',externalSnapshot);
  }
  NativeCollectionSnapshot getSnapshot() {
    owner.ensureAlive(); final callback = getMeta; if (callback != null && owner.ready) meta = owner.invoke(callback);
    final key = family; final parts = key == null ? const <NativeAnatomyPart>[] : owner.anatomy.parts(key,role); final index = parts.indexWhere((part) => part.owner == owner);
    return NativeCollectionSnapshot({...meta,'index':index < 0 && parts.isEmpty ? collectionIndex.get() : index.toDouble(),'total':index < 0 && parts.isEmpty ? collectionTotal.get() : parts.length.toDouble(),'first':index < 0 && parts.isEmpty ? collectionFirst.get() : index == 0,'last':index < 0 && parts.isEmpty ? collectionLast.get() : index >= 0 && index == parts.length-1});
  }
  void _sync() { if (family == null || !owner.ready) return; final value = owner.inScope('collection-sync',getSnapshot); collectionIndex.publish(value['index'] as double); collectionTotal.publish(value['total'] as double); collectionFirst.publish(value['first'] as bool); collectionLast.publish(value['last'] as bool); }
  void dispose() { _offCommit(); collectionIndex.subscribers.clear(); collectionTotal.subscribers.clear(); collectionFirst.subscribers.clear(); collectionLast.subscribers.clear(); }
}
class NativeBoundarySample {
  NativeBoundarySample(this.values);
  final Map<String,Object?> values;
  String? get type => values['type'] as String?;
  Object? get target => values['target'];
  Object? get nativeEvent => values['nativeEvent'];
  Object? get meta => values['meta'];
}
class NativeBoundaryOutsideEvent {
  NativeBoundaryOutsideEvent(this.sample);
  String get classification => 'outside';
  final NativeBoundarySample sample;
}
class NativeBoundary<P> {
  NativeBoundary(this.owner);
  final NativeOwner<P> owner;
  static final List<NativeBoundary<Object?>> stack = [];
  bool stackActive = false, observed = false;
  Map<String, Object?> config = {};
  final Set<NativeHostTarget> regions = {};
  final Set<void Function(NativeBoundaryOutsideEvent)> outside = {};
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); config = {...config, ...patch}; }
  void observe(String observation) { owner.ensureSetup(); if (observation != 'pointer.press') throw ArgumentError('Unsupported Boundary observation'); observed = true; }
  void setStackActive(bool active) { owner.ensureRuntime(); stack.remove(this); stackActive = active; if (active) stack.add(this); }
  void Function() registerRegion(NativeHostTarget target, [Map<String, Object?> options = const {}]) { owner.ensureAlive(); regions.add(target); return () { owner.ensureAlive(); regions.remove(target); }; }
  void unregisterRegion(NativeHostTarget target) { owner.ensureRuntime(); regions.remove(target); }
  String classify([Map<String, Object?> sample = const {}]) {
    owner.ensureAlive(); final target = sample['target'];
    if (target is NativeHostTarget) return target == owner.hostTarget || regions.contains(target) ? 'inside' : 'outside';
    final position = sample['position'];
    if (position is! Offset) return 'unknown';
    final all = [owner.hostTarget, ...regions]; bool ready = false;
    for (final region in all) { final rect = region.bounds; if (rect == null) continue; ready = true; if (rect.contains(position)) return 'inside'; }
    return ready ? 'outside' : 'unknown';
  }
  String notify([Map<String, Object?> sample = const {}]) { owner.ensureRuntime(); final result = classify(sample); if (result == 'outside') { final event = NativeBoundaryOutsideEvent(NativeBoundarySample(Map.unmodifiable(sample))); for (final callback in List.of(outside)) { if (outside.contains(callback)) owner.inScope('event', () => callback(event)); } } return result; }
  void Function() subscribeOutside(void Function(NativeBoundaryOutsideEvent) callback) { owner.ensureAlive(); outside.add(callback); return () { owner.ensureAlive(); outside.remove(callback); }; }
  void pointer(PointerDownEvent event) { if (!observed || !owner.ready || stackActive && stack.isNotEmpty && stack.last != this) return; owner.inScope('event', () => notify({'type': 'pointer.press', 'position': event.position})); }
  void dispose() { stack.remove(this); regions.clear(); outside.clear(); }
}
class NativeHitParticipation {
  NativeHitParticipation(this.owner);
  final NativeOwner<Object?> owner;
  final Set<NativeHostTarget> regions = {};
  final Map<NativeHostTarget, (String, String)> _ownedModes = {};
  Map<String, Object?> config = {};
  void _mode(NativeHostTarget target, String mode) { if (!['participating','disabled','passthrough'].contains(mode)) throw ArgumentError('Invalid hit participation mode'); if (!target.alive) throw StateError('Hit target is disposed'); final previous = _ownedModes[target]?.$1 ?? target.participation.value; _ownedModes[target] = (previous, mode); target.participation.value = mode; }
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); config = {...config, ...patch}; _mode(owner.hostTarget, config['mode'] as String? ?? 'participating'); }
  void Function() registerRegion(NativeHostTarget target, [Map<String, Object?> options = const {}]) { owner.ensureAlive(); regions.add(target); _mode(target, options['mode'] as String? ?? config['mode'] as String? ?? 'participating'); return () { owner.ensureAlive(); _release(target); }; }
  void _release(NativeHostTarget target) { regions.remove(target); final previous = _ownedModes.remove(target); if (previous != null && target.alive && target.participation.value == previous.$2) target.participation.value = previous.$1; }
  void unregisterRegion(NativeHostTarget target) { owner.ensureRuntime(); _release(target); }
  void dispose() { for (final target in List.of(_ownedModes.keys)) _release(target); }
}
class NativePositioning {
  NativePositioning(this.owner) { owner._commitObservers.add(_refresh); }
  final NativeOwner<Object?> owner;
  final ValueNotifier<Offset> offset = ValueNotifier(Offset.zero);
  Map<String, Object?> config = {};
  NativeHostTarget? anchor, content;
  bool connected = false;
  int generation = 0;
  Map<String,Object?>? snapshot;
  void Function(Map<String,Object?>)? onResolved;
  NativeHostGeometry? _previousGeometry, _appliedGeometry;
  void connect(Map<String, Object?> patch) { owner.ensureAlive(); _release(); generation++; config = Map.of(patch['config'] as Map<String,Object?>); anchor = patch['anchor'] as NativeHostTarget?; content = patch['floating'] as NativeHostTarget?; onResolved = patch['onResolved'] as void Function(Map<String,Object?>)?; connected = anchor != null && content != null; _refresh(); }
  void update(Map<String, Object?> patch) { owner.ensureRuntime(); config = Map.of(patch); requestUpdate(); }
  void requestUpdate() {
    owner.ensureRuntime(); _refresh();
  }
  void _refresh() {
    if (!owner.alive || !connected || !owner.ready) return; final a = anchor?.bounds, c = content?.bounds; if (a == null || c == null) { snapshot = null; return; }
    final gap = (config['sideOffset'] as num? ?? 0).toDouble(), cross = (config['alignOffset'] as num? ?? 0).toDouble(); var side = config['side'] as String? ?? 'bottom'; final align = config['align'] as String? ?? 'center'; final strategy = config['strategy'] as String? ?? 'absolute';
    Offset place(String side) { final horizontal = side == 'left' || side == 'right'; final center = horizontal ? a.center.dy-c.height/2 : a.center.dx-c.width/2; final start = horizontal ? a.top : a.left; final end = horizontal ? a.bottom-c.height : a.right-c.width; final along = (align == 'start' ? start : align == 'end' ? end : center)+cross; return side == 'top' ? Offset(along,a.top-c.height-gap) : side == 'left' ? Offset(a.left-c.width-gap,along) : side == 'right' ? Offset(a.right+gap,along) : Offset(along,a.bottom+gap); }
    var result = place(side); final context = owner.logicalContext; final size = context == null ? null : MediaQuery.maybeSizeOf(context); final padding = (config['collisionPadding'] as num? ?? 0).toDouble();
    if (size != null && config['avoidCollisions'] != false) {
      final overflow = side == 'top' ? result.dy < padding : side == 'bottom' ? result.dy+c.height > size.height-padding : side == 'left' ? result.dx < padding : result.dx+c.width > size.width-padding;
      if (overflow) { final opposite = {'top':'bottom','bottom':'top','left':'right','right':'left'}[side]!; final alternate = place(opposite); if (alternate.dx >= padding && alternate.dy >= padding && alternate.dx+c.width <= size.width-padding && alternate.dy+c.height <= size.height-padding) { side = opposite; result = alternate; } }
      result = Offset(result.dx.clamp(padding,(size.width-c.width-padding).clamp(padding,double.infinity)).toDouble(),result.dy.clamp(padding,(size.height-c.height-padding).clamp(padding,double.infinity)).toDouble());
    }
    offset.value = result;
    if (owner.overlay == null || content != owner.hostTarget) {
      final target = content!; final prior = target.geometry.value; if (!identical(prior,_appliedGeometry)) _previousGeometry = prior;
      final nextOffset = (prior?.offset ?? Offset.zero)+result-c.topLeft; final next = NativeHostGeometry(width:prior?.width,height:prior?.height,offset:nextOffset);
      if (prior == null || (prior.offset-nextOffset).distance > 0.01) { _appliedGeometry = next; target.geometry.value = next; }
    }
    final next = <String,Object?>{'side':side,'align':align,'strategy':strategy}; final changed = snapshot == null || snapshot!['side'] != side || snapshot!['align'] != align || snapshot!['strategy'] != strategy; snapshot = Map.unmodifiable(next); if (changed && onResolved != null) owner.inScope('positioning-resolved',() => onResolved!(snapshot!));
  }
  void _release() { final target = content; if (target != null && target.alive && identical(target.geometry.value,_appliedGeometry)) target.geometry.value = _previousGeometry; _previousGeometry = null; _appliedGeometry = null; snapshot = null; }
  void disconnect() { owner.ensureAlive(); generation++; connected = false; _release(); }
  Map<String, Object?>? getSnapshot() { owner.ensureAlive(); return snapshot; }
  void dispose() { connected = false; _release(); owner._commitObservers.remove(_refresh); offset.dispose(); }
}
class NativeOverlay {
  NativeOverlay(this.owner) { open = NativeState<bool>(owner, 'bool', 'overlay.open', false, const {}, observed: true); owner._commitObservers.add(_commit); FocusManager.instance.addListener(_focusChanged); }
  static final List<NativeOverlay> stack = [];
  final NativeOwner<Object?> owner;
  late final NativeState<bool> open;
  final OverlayPortalController portal = OverlayPortalController();
  Map<String, Object?> config = {};
  bool retained = false;
  NativeHostTarget? trigger, anchor, content;
  Map<String, Object?>? presence;
  FocusNode? previousFocus;
  bool _entered = false;
  bool isOpen() => open.get();
  void openOverlay([String? reason]) => _set(true, reason);
  void close([String? reason]) => _set(false, reason);
  void toggle([String? reason]) => _set(!open.get(),reason);
  void _set(bool value, String? reason) { owner.ensureRuntime(); if (owner.disposing) throw StateError('Overlay intent is closed during disposal'); if (value == open.get()) return; if (value) previousFocus = FocusManager.instance.primaryFocus; open.publish(value, reason); if (presence != null) { final callback = presence![value ? 'enter' : 'leave']; if (callback is void Function()) callback(); else throw StateError('Presence binding requires callable enter/leave'); } else if (!retained) owner.present = value; if (!value) _releaseView(); owner.requestHostUpdate(); }
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); config = {...config, ...patch}; if (patch.containsKey('defaultOpen')) open.publish(patch['defaultOpen'] as bool); }
  void updatePosition(Map<String, Object?> patch) { owner.ensureRuntime(); config = {...config,...patch}; _position(); }
  void _position() { if (config['anchored'] == false || (anchor ?? trigger) == null) return; final position = owner.positioning ??= NativePositioning(owner); position.config = {...config,'side':config['placement'] ?? 'bottom'}; position.anchor = anchor ?? trigger; position.content = content ?? owner.hostTarget; position.connected = open.get(); position._refresh(); }
  void registerTrigger(NativeHostTarget target) { owner.ensureAlive(); trigger = target; }
  void registerAnchor(NativeHostTarget target) { owner.ensureAlive(); anchor = target; _position(); }
  void registerAnchorPart(NativeAnatomyPart? part) { owner.ensureAlive(); anchor = part?.target; _position(); }
  void registerContent(NativeHostTarget target) { owner.ensureAlive(); content = target; _position(); }
  Map<String, Object?>? getPositionSnapshot() { owner.ensureAlive(); return owner.positioning?.getSnapshot(); }
  void keepMounted() { owner.ensureSetup(); if (presence != null) throw StateError('Cannot retain a Presence-bound overlay'); retained = true; }
  void bindPresence(Map<String, Object?> binding) { owner.ensureSetup(); if (retained || presence != null) throw StateError('Overlay Presence already bound or retained'); presence = Map.unmodifiable({...binding}); }
  void _commit() { if (!owner.ready || !open.get()) return; if (!stack.contains(this)) stack.add(this); _position(); if (_entered) return; _entered = true; final entry = config['entry'] as String? ?? 'first'; if (entry == 'manual') return; final children = NativeOwner._liveOwners.where((candidate) => candidate.ready && candidate.focusAvailable && !candidate.focus.disabled && nativeLogicalDescendant(candidate,owner)).toList()..sort(NativeAnatomy.compareOwners); final target = entry == 'content' ? owner : entry == 'selected' ? children.where((candidate) => candidate.focus.rovingSelected).firstOrNull ?? children.firstOrNull : children.firstOrNull; if (target != null) target.inScope('overlay-entry',() => target.focus.focusSelf()); }
  void _releaseView() { stack.remove(this); _entered = false; owner.positioning?.disconnect(); final restore = config['restore'] as String? ?? 'trigger'; final target = restore == 'trigger' ? NativeOwner._liveOwners.where((candidate) => identical(candidate.hostTarget,trigger)).firstOrNull?.focus.node : restore == 'previous' ? previousFocus : null; if (target?.context != null && target!.canRequestFocus) target.requestFocus(); }
  void detached() { stack.remove(this); _entered = false; owner.positioning?.disconnect(); }
  bool key(KeyEvent event) { if (!owner.ready || !open.get() || stack.isNotEmpty && stack.last != this || config['closeOnEscape'] == false || event is! KeyDownEvent || event.logicalKey != LogicalKeyboardKey.escape) return false; owner.inScope('event',() => close('escape')); return true; }
  void pointer(PointerDownEvent event) { if (!owner.ready || !open.get() || stack.isNotEmpty && stack.last != this) return; final inTrigger = trigger?.bounds?.contains(event.position) == true, inAnchor = anchor?.bounds?.contains(event.position) == true; final inside = (content ?? owner.hostTarget).bounds?.contains(event.position) == true; if (inTrigger && config['closeOnTriggerPress'] == true || inAnchor && config['closeOnAnchorPress'] == true) owner.inScope('event',() => close(inTrigger ? 'trigger.press' : 'anchor.press')); else if (!inside && !inTrigger && !inAnchor && config['closeOnOutsidePress'] != false) owner.inScope('event',() => close('outside.press')); }
  void _focusChanged() { if (!owner.alive || !owner.ready || !open.get() || !_entered || stack.isNotEmpty && stack.last != this) return; final focused = NativeOwner._liveOwners.where((candidate) => candidate.focus.node.hasPrimaryFocus).firstOrNull; if (focused != null && nativeLogicalDescendant(focused,owner)) return; if (config['closeOnFocusOutside'] == true) owner.inScope('event',() => close('focus.outside')); else if (config['modal'] == true) { final target = NativeOwner._liveOwners.where((candidate) => candidate.ready && candidate.focusAvailable && nativeLogicalDescendant(candidate,owner)).firstOrNull; target?.focus.node.requestFocus(); } }
  Widget wrap(Widget root) {
    final usePortal = config['portal'] != false;
    final visible = owner.surfaceActive && (presence?['present'] is NativeObserved<bool> ? (presence!['present'] as NativeObserved<bool>).get() : open.get());
    if (!usePortal) return Offstage(offstage: !visible, child: root);
    WidgetsBinding.instance.addPostFrameCallback((_) { if (!owner.alive) return; if (visible) portal.show(); else portal.hide(); });
    return OverlayPortal(controller: portal, overlayChildBuilder: (context) {
      Widget content = NativeContextHost(scope: owner.context, child: root);
      final positioning = owner.positioning;
      if (positioning != null) content = ValueListenableBuilder<Offset>(valueListenable: positioning.offset, builder: (_, value, child) => Positioned(left: value.dx, top: value.dy, child: child!), child: content);
      else content = Positioned(left: 0, top: 0, child: content);
      if (config['modal'] == true) return Stack(children: [ModalBarrier(dismissible: config['closeOnOutsidePress'] != false, color: const Color(0x66000000), onDismiss: () => owner.inScope('event', () => close('outside.press'))), content]);
      return content;
    }, child: retained && !visible ? Offstage(offstage: true, child: root) : const SizedBox.shrink());
  }
  void dispose() { stack.remove(this); FocusManager.instance.removeListener(_focusChanged); owner._commitObservers.remove(_commit); portal.hide(); open.subscribers.clear(); }
}
class NativeScrollAxisFacts {
  NativeScrollAxisFacts(NativeOwnerBase owner, String name) : position = NativeState<double>(owner, 'number.range', '$name.position', 0, const {'min': 0, 'max': 1}, observed: true), visibleRatio = NativeState<double>(owner, 'number.range', '$name.visibleRatio', 1, const {'min': 0, 'max': 1}, observed: true), canScrollBefore = NativeState<bool>(owner, 'bool', '$name.canScrollBefore', false, const {}, observed: true), canScrollAfter = NativeState<bool>(owner, 'bool', '$name.canScrollAfter', false, const {}, observed: true), atEnd = NativeState<bool>(owner, 'bool', '$name.atEnd', true, const {}, observed: true);
  final NativeState<double> position, visibleRatio;
  final NativeState<bool> canScrollBefore, canScrollAfter, atEnd;
  void refresh(ScrollController control) {
    if (!control.hasClients || !control.position.hasContentDimensions) return;
    final metrics = control.position;
    final range = (metrics.maxScrollExtent - metrics.minScrollExtent).clamp(0,double.infinity);
    final offset = (metrics.pixels - metrics.minScrollExtent).clamp(0,range);
    position.publish(range > 0 ? offset / range : 0);
    visibleRatio.publish(range + metrics.viewportDimension > 0 ? (metrics.viewportDimension / (range + metrics.viewportDimension)).clamp(0,1).toDouble() : 1);
    canScrollBefore.publish(offset > 0); canScrollAfter.publish(offset < range); atEnd.publish(range - offset <= 1);
  }
  Map<String, Object?> snapshot() => {'position': position.get(), 'visibleRatio': visibleRatio.get(), 'canScrollBefore': canScrollBefore.get(), 'canScrollAfter': canScrollAfter.get(), 'atEnd': atEnd.get()};
  void reset() { position.publish(0); visibleRatio.publish(1); canScrollBefore.publish(false); canScrollAfter.publish(false); atEnd.publish(true); }
  void dispose() { position.subscribers.clear(); visibleRatio.subscribers.clear(); canScrollBefore.subscribers.clear(); canScrollAfter.subscribers.clear(); atEnd.subscribers.clear(); }
}
class NativeScrollFollowFacts {
  NativeScrollFollowFacts(NativeOwnerBase owner) : state = NativeState<String>(owner,'string','scroll.endFollow.state','off',const {},observed:true), requestStatus = NativeState<String>(owner,'string','scroll.endFollow.requestStatus','idle',const {},observed:true);
  final NativeState<String> state, requestStatus;
  void dispose() { state.subscribers.clear(); requestStatus.subscribers.clear(); }
}
class NativeScroll {
  NativeScroll(this.owner) : horizontal = NativeScrollAxisFacts(owner, 'scroll.horizontal'), vertical = NativeScrollAxisFacts(owner, 'scroll.vertical'), axes = NativeState<String>(owner,'string','scroll.axes','vertical',const {},observed:true), projection = NativeState<String>(owner,'string','scroll.projection','unresolved',const {},observed:true), scrolling = NativeState<bool>(owner,'bool','scroll.scrolling',false,const {},observed:true), endFollow = NativeScrollFollowFacts(owner) { _horizontalControl.addListener(_refresh); _verticalControl.addListener(_refresh); _offCommit = owner.onCommit(_refreshChrome); }
  final NativeOwner<Object?> owner;
  final ScrollController _verticalControl = ScrollController(), _horizontalControl = ScrollController();
  final NativeScrollAxisFacts horizontal, vertical;
  final NativeState<String> axes, projection;
  final NativeState<bool> scrolling;
  final NativeScrollFollowFacts endFollow;
  Map<String, Object?> config = {}, chrome = {};
  bool following = false, _mounted = false;
  late final void Function() _offCommit;
  final Map<NativeHostTarget, (NativeHostGeometry?, void Function(PointerEvent)?, NativeHostGeometry?, void Function(PointerEvent))> _chromeOwned = {};
  final Map<int, PointerRoute> _dragRoutes = {};
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); config = {...config, ...patch}; if (!['vertical','horizontal','both'].contains(config['axes'] ?? 'vertical')) throw ArgumentError('Invalid scroll axes'); if (!['auto','system','composed'].contains(config['projection'] ?? 'auto')) throw ArgumentError('Invalid scroll projection'); axes.publish(config['axes'] as String? ?? 'vertical'); _followFacts(); }
  void bindComposedChrome(Map<String, Object?> binding) { owner.ensureSetup(); if (chrome.isNotEmpty && !identical(chrome, binding)) throw StateError('Composed chrome may be bound only once'); chrome = binding; }
  ScrollController _controller(String axis) => axis == 'horizontal' ? _horizontalControl : _verticalControl;
  void _followFacts() { final policy = config['endFollow']; endFollow.state.publish(policy is! Map<String,Object?> || policy['mode'] != 'while-at-end' ? 'off' : !owner.ready ? 'pending' : following ? 'following' : 'paused'); }
  void _refresh() { if (!owner.alive || !owner.ready) return; horizontal.refresh(_horizontalControl); vertical.refresh(_verticalControl); _followFacts(); _refreshChrome(); }
  void _refreshChrome() {
    if (!owner.alive || !owner.ready || chrome.isEmpty || projection.get() != 'composed') return;
    final family = chrome['anatomy'] as NativeAnatomyFamily;
    final root = owner.anatomy._root(family);
    if (owner.context.resolve(chrome['scope']!) != root.context) { _releaseChrome(); return; }
    final tracks = owner.anatomy.parts(family, chrome['scrollbarRole'] as String);
    final thumbs = owner.anatomy.parts(family, chrome['thumbRole'] as String);
    final seen = <NativeHostTarget>{};
    for (final track in tracks) {
      final thumb = thumbs.where((part) { NativeContextScope? parent = part.owner.context.parent; while (parent != null) { if (parent.owner == track.owner) return true; parent = parent.parent; } return false; }).firstOrNull;
      final rect = track.target.bounds;
      if (thumb == null || rect == null || thumb.target.box == null) continue;
      final exposed = track.getExpose(chrome['orientationExpose'] as String);
      final axis = exposed is NativeObserved<Object?> && exposed.get() == 'horizontal' ? 'horizontal' : 'vertical';
      final facts = axis == 'horizontal' ? horizontal : vertical;
      final extent = axis == 'horizontal' ? rect.width : rect.height;
      final length = extent * facts.visibleRatio.get();
      final travel = (extent - length).clamp(0,double.infinity).toDouble();
      final offset = facts.position.get() * travel;
      final old = _chromeOwned[thumb.target];
      final previousGeometry = old == null || thumb.target.geometry.value != old.$3 ? thumb.target.geometry.value : old.$1;
      final previousRoute = old == null || thumb.target.pointerRoute != old.$4 ? thumb.target.pointerRoute : old.$2;
      final pointer = (PointerEvent event) {
        if (event is! PointerDownEvent || !owner.ready) return;
        final initial = event.position;
        final start = facts.position.get().toDouble();
        late final PointerRoute route;
        route = (sample) {
          if (!owner.alive || !owner.ready || sample is PointerUpEvent || sample is PointerCancelEvent) { GestureBinding.instance.pointerRouter.removeRoute(event.pointer, route); _dragRoutes.remove(event.pointer); return; }
          if (sample is PointerMoveEvent && travel > 0) { final delta = axis == 'horizontal' ? sample.position.dx - initial.dx : sample.position.dy - initial.dy; owner.inScope('event', () => request({'kind':'control-drag','axis':axis,'position':(start + delta / travel).clamp(0,1)})); }
        };
        _dragRoutes[event.pointer] = route; GestureBinding.instance.pointerRouter.addRoute(event.pointer, route);
      };
      final desiredOffset = axis == 'horizontal' ? Offset(offset.toDouble(),0) : Offset(0,offset.toDouble());
      final desiredWidth = axis == 'horizontal' ? length.toDouble() : null, desiredHeight = axis == 'vertical' ? length.toDouble() : null;
      final current = thumb.target.geometry.value;
      final next = current != null && current.offset == desiredOffset && current.width == desiredWidth && current.height == desiredHeight ? current : NativeHostGeometry(width: desiredWidth, height: desiredHeight, offset: desiredOffset);
      thumb.target.geometry.value = next; thumb.target.pointerRoute = pointer;
      _chromeOwned[thumb.target] = (previousGeometry, previousRoute, next, pointer); seen.add(thumb.target);
      final oldTrack = _chromeOwned[track.target];
      final trackPreviousRoute = oldTrack == null || track.target.pointerRoute != oldTrack.$4 ? track.target.pointerRoute : oldTrack.$2;
      final trackPointer = (PointerEvent event) {
        if (event is! PointerDownEvent || !owner.ready) return;
        final thumbRect = thumb.target.bounds;
        if (thumbRect == null || thumbRect.contains(event.position)) return;
        final coordinate = axis == 'horizontal' ? event.position.dx : event.position.dy;
        final start = axis == 'horizontal' ? thumbRect.left : thumbRect.top;
        owner.inScope('event', () => request({'kind':'page','axis':axis,'direction':coordinate < start ? 'before' : 'after'}));
      };
      track.target.pointerRoute = trackPointer;
      _chromeOwned[track.target] = (oldTrack == null ? track.target.geometry.value : oldTrack.$1, trackPreviousRoute, track.target.geometry.value, trackPointer); seen.add(track.target);
    }
    for (final target in List.of(_chromeOwned.keys)) { if (!seen.contains(target)) _releaseTarget(target); }
  }
  void _releaseTarget(NativeHostTarget target) { final old = _chromeOwned.remove(target); if (old == null || !target.alive) return; if (target.geometry.value == old.$3) target.geometry.value = old.$1; if (target.pointerRoute == old.$4) target.pointerRoute = old.$2; }
  void _releaseChrome() { for (final target in List.of(_chromeOwned.keys)) _releaseTarget(target); for (final entry in _dragRoutes.entries) GestureBinding.instance.pointerRouter.removeRoute(entry.key,entry.value); _dragRoutes.clear(); }
  void request(Map<String, Object?> request) {
    owner.ensureRuntime(); final axis = request['axis'] as String? ?? 'vertical'; final control = _controller(axis);
    if (!owner.ready || !control.hasClients || axes.get() != 'both' && axes.get() != axis) { if (request['kind'] == 'to-end') endFollow.requestStatus.publish('rejected'); return; }
    final metrics = control.position;
    final kind = request['kind'];
    if (!['by','page','to-end','to','control-drag'].contains(kind)) throw ArgumentError('Unknown Scroll request');
    final destination = kind == 'by' ? metrics.pixels + (request['delta'] as num).toDouble() : kind == 'page' ? metrics.pixels + metrics.viewportDimension * (request['direction'] == 'before' ? -1 : 1) : kind == 'to-end' ? metrics.maxScrollExtent : metrics.minScrollExtent + (metrics.maxScrollExtent - metrics.minScrollExtent) * (request['position'] as num).clamp(0,1);
    if (kind == 'to-end') endFollow.requestStatus.publish('pending');
    control.jumpTo(destination.clamp(metrics.minScrollExtent, metrics.maxScrollExtent).toDouble());
    following = kind == 'to-end' || metrics.pixels >= metrics.maxScrollExtent - 1;
    if (kind == 'to-end') endFollow.requestStatus.publish('applied'); _refresh();
  }
  Map<String, Object?> getSnapshot() { owner.ensureAlive(); return {'axes': axes.get(), 'scrolling': scrolling.get(), 'projection': projection.get(), 'horizontal': horizontal.snapshot(), 'vertical': vertical.snapshot(), 'endFollow': {'state': endFollow.state.get(), 'requestStatus': endFollow.requestStatus.get()}}; }
  Widget wrap(Widget root) {
    Widget result = root;
    final axes = config['axes'] as String? ?? 'vertical';
    if (axes == 'vertical' || axes == 'both') result = SingleChildScrollView(controller: _verticalControl, child: result);
    if (axes == 'horizontal' || axes == 'both') result = SingleChildScrollView(controller: _horizontalControl, scrollDirection: Axis.horizontal, child: result);
    if ((config['requireProjection'] ?? config['projection']) != 'composed') result = Scrollbar(controller: axes == 'horizontal' ? _horizontalControl : _verticalControl, child: result);
    final policy = config['endFollow'];
    if (policy is Map<String, Object?> && policy['mode'] == 'while-at-end') {
      final control = _controller(policy['axis'] as String? ?? 'vertical');
      WidgetsBinding.instance.addPostFrameCallback((_) { if (!owner.alive || !control.hasClients) return; if (following) control.jumpTo(control.position.maxScrollExtent); });
    }
    result = NotificationListener<ScrollMetricsNotification>(onNotification: (event) { if (following) WidgetsBinding.instance.addPostFrameCallback((_) { if (!owner.alive || !owner.ready) return; final axis = config['endFollow']; if (axis is Map<String,Object?>) { final control = _controller(axis['axis'] as String? ?? 'vertical'); if (control.hasClients) control.jumpTo(control.position.maxScrollExtent); } }); _refresh(); return false; }, child: result);
    return NotificationListener<ScrollNotification>(onNotification: (event) { if (event is ScrollStartNotification) scrolling.publish(true); if (event is ScrollEndNotification) scrolling.publish(false); if (event is UserScrollNotification) following = event.metrics.pixels >= event.metrics.maxScrollExtent - 1; _refresh(); return false; }, child: result);
  }
  void mount() { if (!_mounted) { _mounted = true; final preference = config['requireProjection'] ?? config['projection']; projection.publish(preference == 'composed' ? 'composed' : 'system'); final policy = config['endFollow']; following = policy is Map<String,Object?> && policy['mode'] == 'while-at-end' && _controller(policy['axis'] as String).hasClients && _controller(policy['axis'] as String).position.extentAfter <= 1; } _refresh(); }
  void unmount() { _mounted = false; _releaseChrome(); horizontal.reset(); vertical.reset(); scrolling.publish(false); projection.publish('unresolved'); endFollow.requestStatus.publish('idle'); following = false; _followFacts(); }
  void dispose() { _offCommit(); _releaseChrome(); _verticalControl.dispose(); _horizontalControl.dispose(); vertical.dispose(); horizontal.dispose(); axes.subscribers.clear(); projection.subscribers.clear(); scrolling.subscribers.clear(); endFollow.dispose(); }
}
class NativeTextControl<P> {
  NativeTextControl(this.owner) { controller.addListener(_changed); owner.focus.node.addListener(_focusChanged); }
  final NativeOwner<P> owner;
  final TextEditingController controller = TextEditingController();
  Map<String, Object?> config = {};
  final Map<String, Set<void Function(NativeRun<P>, Map<String, Object?>)>> listeners = {};
  bool composing = false, syncing = false, multiline = false, initialized = false;
  String previous = '';
  String committedValue = '';
  bool hadFocus = false;
  String normalize(String value) { final normalized = value.replaceAll('\\r\\n', '\\n').replaceAll('\\r', '\\n'); return multiline ? normalized : normalized.replaceAll('\\n', ''); }
  void Function() on(String type, void Function(NativeRun<P>, Map<String, Object?>) callback) { owner.ensureSetup(); if (!['input','change','compositionstart','compositionupdate','compositionend'].contains(type)) throw ArgumentError('Invalid TextControl event'); final entries = listeners.putIfAbsent(type, () => {}); entries.add(callback); return () { owner.ensureSetup(); entries.remove(callback); }; }
  void sync(Map<String, Object?> patch) {
    owner.ensureRuntime(); config = {...config, ...patch};
    if (!multiline && (patch.containsKey('rows') || patch.containsKey('wrap'))) throw ArgumentError('Multiline fields on single-line TextControl');
    final controlled = config['valueMode'] == 'controlled';
    if (controlled && patch.containsKey('value') || !initialized && patch.containsKey('defaultValue')) {
      final value = normalize((controlled ? patch['value'] : patch['defaultValue']) as String); syncing = true;
      try { if (controller.text != value) controller.value = TextEditingValue(text: value, selection: TextSelection.collapsed(offset: value.length)); previous = value; committedValue = value; } finally { syncing = false; }
    }
    owner.focus.node.canRequestFocus = config['disabled'] != true && !owner.focus.disabled; initialized = true; owner.project();
  }
  Map<String, Object?>? snapshot() { owner.ensureAlive(); return !owner.ready ? null : {'value': normalize(controller.text), 'composing': composing}; }
  void _emit(String type, [String? data]) {
    if (!owner.ready) return;
    final event = <String, Object?>{'type': type, 'value': normalize(controller.text), 'composing': composing, 'data': data, 'inputType': null};
    for (final callback in List.of(listeners[type] ?? <void Function(NativeRun<P>, Map<String, Object?>)>{})) owner.inScope('event', () => owner.invoke((run) => callback(run,event)));
  }
  void _changed() {
    if (!owner.alive || syncing) return;
    final nextComposing = controller.value.composing.isValid && !controller.value.composing.isCollapsed;
    if (nextComposing && !composing) { composing = true; _emit('compositionstart'); }
    else if (nextComposing) _emit('compositionupdate');
    if (!nextComposing && composing) { composing = false; _emit('compositionend'); }
    final value = normalize(controller.text); if (value != previous) { previous = value; _emit('input'); owner.dispatch(NativeInput('input')); }
  }
  void _commitValue() { if (committedValue == normalize(controller.text)) return; committedValue = normalize(controller.text); _emit('change'); owner.dispatch(NativeInput('change')); }
  void _focusChanged() { final next = owner.focus.node.hasFocus; if (hadFocus && !next && owner.ready) _commitValue(); hadFocus = next; }
  Widget widget() {
    final placeholder = config['placeholder'] as String?; final maxLength = (config['maxLength'] as num?)?.toInt();
    final editor = EditableText(controller: controller, focusNode: owner.focus.node, style: const TextStyle(fontSize:16,color:Color(0xff000000)), cursorColor:const Color(0xff000000), backgroundCursorColor:const Color(0xff808080), minLines:multiline ? (config['rows'] as num?)?.toInt() : 1, maxLines:multiline ? null : 1, readOnly:config['readOnly'] == true || config['disabled'] == true, keyboardType:_keyboard(), textInputAction:_action(), autofillHints:config['autoComplete'] == 'off' ? null : config['autoComplete'] is String ? [config['autoComplete'] as String] : const [], inputFormatters:[if (maxLength != null) LengthLimitingTextInputFormatter(maxLength),TextInputFormatter.withFunction((previous,next) { final value = normalize(next.text); if (value == next.text) return next; return next.copyWith(text:value,selection:TextSelection(baseOffset:next.selection.baseOffset.clamp(0,value.length),extentOffset:next.selection.extentOffset.clamp(0,value.length)),composing:TextRange.empty); })], onSubmitted:(_) => _commitValue());
    return Semantics(textField:true,enabled:config['disabled'] != true,readOnly:config['readOnly'] == true,label:config['name'] as String?,child:placeholder == null ? editor : Stack(children:[ValueListenableBuilder<TextEditingValue>(valueListenable:controller,builder:(_,value,__) => value.text.isEmpty ? IgnorePointer(child:Text(placeholder,style:const TextStyle(color:Color(0xff808080)))) : const SizedBox.shrink()),editor]));
  }
  TextInputAction _action() { final name = config['enterKeyHint']; return name == 'done' ? TextInputAction.done : name == 'go' ? TextInputAction.go : name == 'next' ? TextInputAction.next : name == 'previous' ? TextInputAction.previous : name == 'search' ? TextInputAction.search : name == 'send' ? TextInputAction.send : multiline ? TextInputAction.newline : TextInputAction.done; }
  TextInputType _keyboard() { final mode = config['inputMode']; return mode == 'none' ? TextInputType.none : mode == 'numeric' ? TextInputType.number : mode == 'decimal' ? const TextInputType.numberWithOptions(decimal: true) : mode == 'email' ? TextInputType.emailAddress : mode == 'tel' ? TextInputType.phone : mode == 'url' ? TextInputType.url : multiline ? TextInputType.multiline : TextInputType.text; }
  void dispose() { owner.focus.node.removeListener(_focusChanged); controller.removeListener(_changed); controller.dispose(); listeners.clear(); }
}
class NativeImageView<P> {
  NativeImageView(this.owner);
  final NativeOwner<P> owner;
  Map<String, Object?> config = {};
  final Set<void Function(NativeRun<P>, Map<String, Object?>)> listeners = {};
  String status = 'idle', source = '';
  int generation = 0;
  ImageStream? stream;
  ImageStreamListener? streamListener;
  ImageInfo? image;
  void Function() on(String type, void Function(NativeRun<P>, Map<String, Object?>) callback) { owner.ensureSetup(); if (type != 'loadingStatusChange') throw ArgumentError('Invalid ImageView event'); listeners.add(callback); return () { owner.ensureSetup(); listeners.remove(callback); }; }
  void _status(String value) {
    if (value == status) return; final previous = status; status = value;
    final event = <String, Object?>{'status': value, 'previousStatus': previous, 'source': source};
    for (final callback in List.of(listeners)) if (owner.alive) owner.inScope('event', () => owner.invoke((run) => callback(run,event)));
    owner.project();
  }
  void sync(Map<String, Object?> patch) {
    owner.ensureRuntime(); config = {...config, ...patch};
    final next = config['source'] as String? ?? source;
    if (next != source) { source = next; generation++; _release(); _status(source.isEmpty ? 'idle' : 'loading'); if (source.isNotEmpty && owner.ready) _load(generation); }
    owner.project();
  }
  void _load(int ticket) {
    final provider = source.startsWith('http:') || source.startsWith('https:') ? NetworkImage(source) as ImageProvider<Object> : AssetImage(source);
    final nextStream = provider.resolve(const ImageConfiguration()); stream = nextStream;
    final listener = ImageStreamListener((info, _) { if (!owner.alive || !owner.ready || ticket != generation) { info.dispose(); return; } image?.dispose(); image = info; _status('loaded'); }, onError: (Object error, StackTrace? stack) { if (!owner.alive || !owner.ready || ticket != generation) return; _status('error'); FlutterError.reportError(FlutterErrorDetails(exception: error, stack: stack)); });
    streamListener = listener; nextStream.addListener(listener);
  }
  Map<String, Object?>? snapshot() { owner.ensureAlive(); return !owner.ready ? null : {'source': source, 'loadingStatus': status, 'fit': config['fit'] ?? 'contain'}; }
  void mount() { if (source.isNotEmpty && stream == null) { _status('loading'); _load(++generation); } }
  void unmount() { generation++; _release(); }
  Widget widget() {
    final fit = config['fit'] == 'cover' ? BoxFit.cover : config['fit'] == 'fill' ? BoxFit.fill : BoxFit.contain;
    return Semantics(image: true, label: config['a11yMode'] == 'decorative' ? null : config['alternativeText'] as String?, excludeSemantics: config['a11yMode'] == 'decorative', child: RawImage(image: image?.image, scale: image?.scale ?? 1, fit: fit));
  }
  void _release() { final listener = streamListener; if (listener != null) stream?.removeListener(listener); stream = null; streamListener = null; image?.dispose(); image = null; }
  void dispose() { generation++; _release(); listeners.clear(); }
}
class NativeTransitionControls {
  NativeTransitionControls(this.owner, this.machine, {this.external = false});
  final NativeOwner<Object?> owner;
  final NativeTransitionMachine machine;
  final bool external;
  void _invoke(void Function() action) { if (external) { owner.ensureExternal(); owner.inScope('expose-method',action); } else { owner.ensureRuntime(); action(); } }
  void enter() => _invoke(machine.enter);
  void leave() => _invoke(machine.leave);
  void complete() => _invoke(machine.complete);
}
class NativeTransitionMachine {
  NativeTransitionMachine(this.owner) : transitionState = NativeState<String>(owner,'string','transitionState','closed',const {'options': ['closed','entering','entered','leaving']}), isPresent = NativeState<bool>(owner,'bool','isPresent',false,const {});
  final NativeOwner<Object?> owner;
  final NativeState<String> transitionState;
  final NativeState<bool> isPresent;
  bool _viewMounted = false, _targetOpen = false, disposed = false;
  String? _queuedIntent;
  Timer? _pending;
  int _generation = 0;
  bool appearDefault = false;
  double _enterDefault = 300, _leaveDefault = 200;
  String _interruptDefault = 'reverse';
  Map<String, Object?> _props = const {};
  Set<String> _provided = const {};
  void syncProps(Map<String, Object?> props, Set<String> provided) { _props = props; _provided = provided; }
  void configure(Map<String, Object?> config) { owner.ensureSetup(); if (config['appear'] != null) appearDefault = config['appear'] as bool; if (config['enterDuration'] != null) { final value = config['enterDuration'] as num; if (!value.isFinite || value < 0) throw ArgumentError('[NativeTransition] enterDuration must be a finite non-negative number'); _enterDefault = value.toDouble(); } if (config['leaveDuration'] != null) { final value = config['leaveDuration'] as num; if (!value.isFinite || value < 0) throw ArgumentError('[NativeTransition] leaveDuration must be a finite non-negative number'); _leaveDefault = value.toDouble(); } if (config['interrupt'] != null) { final value = config['interrupt'] as String; if (!['reverse','wait','immediate'].contains(value)) throw ArgumentError('Invalid Transition interrupt'); _interruptDefault = value; } }
  void _setState(String state) { transitionState.publish(state); isPresent.publish(state != 'closed'); }
  double _duration(String state) { final context = owner.logicalContext; if (context != null && MediaQuery.maybeOf(context)?.disableAnimations == true) return 0; final key = state == 'entering' ? 'enterDuration' : 'leaveDuration'; return _provided.contains(key) ? (_props[key] as num).toDouble() : state == 'entering' ? _enterDefault : _leaveDefault; }
  void _arm(String state) { _invalidate(); final activeGeneration = _generation; _pending = Timer(Duration(microseconds: (_duration(state)*1000).round()),() { if (disposed || !owner.alive || activeGeneration != _generation || transitionState.get() != state) return; _pending = null; owner.inScope('transition-completion',() => _complete(true)); }); }
  void _invalidate() { _generation++; _pending?.cancel(); _pending = null; }
  void _beginEnter() { setViewPresent(true); if (!_viewMounted) return; _queuedIntent = null; _emit('beforeEnter'); _setState('entering'); _arm('entering'); }
  void _beginLeave() { _queuedIntent = null; _emit('beforeLeave'); _setState('leaving'); _arm('leaving'); }
  void _complete(bool consumeQueue) {
    final current = transitionState.get(); if (current != 'entering' && current != 'leaving') return; _invalidate();
    if (current == 'entering') { _setState('entered'); _emit('afterEnter'); } else { _setState('closed'); _emit('afterLeave'); setViewPresent(false); }
    if (consumeQueue) { final next = _queuedIntent; _queuedIntent = null; if (next == 'enter') enter(); else if (next == 'leave') leave(); }
  }
  void enter() { _targetOpen = true; final current = transitionState.get(); if (current == 'entered') return;
    if (current == 'closed') { _beginEnter(); return; }
    if (current == 'entering') { if (_interrupt() == 'wait') _queuedIntent = null; return; }
    final interrupt = _interrupt();
    if (interrupt == 'wait') _queuedIntent = 'enter'; else if (interrupt == 'immediate') { _complete(false); _beginEnter(); } else { _invalidate(); _beginEnter(); } }
  void leave() { _targetOpen = false; final current = transitionState.get(); if (current == 'closed') { setViewPresent(false); return; }
    if (current == 'leaving') { if (_interrupt() == 'wait') _queuedIntent = null; return; }
    if (current == 'entered') { _beginLeave(); return; }
    final interrupt = _interrupt();
    if (interrupt == 'wait') _queuedIntent = 'leave'; else if (interrupt == 'immediate') { _complete(false); _beginLeave(); } else { _invalidate(); _beginLeave(); } }
  String _interrupt() => _provided.contains('interrupt') ? _props['interrupt'] as String? ?? _interruptDefault : _interruptDefault;
  void setTarget(bool open) { if (open == _targetOpen) return; if (open) enter(); else leave(); }
  void complete() => _complete(true);
  void initialize(bool open, bool appear) { _targetOpen = open; _queuedIntent = null; _invalidate(); if (!open) { _setState('closed'); setViewPresent(false); return; } setViewPresent(true); if (!appear) _setState('entered'); }
  void mounted() { _viewMounted = true; if (_targetOpen && transitionState.get() == 'closed') _beginEnter(); }
  void unmounted() { _viewMounted = false; _invalidate(); _queuedIntent = null; if (transitionState.get() != 'closed') _setState('closed'); }
  void setViewPresent(bool present) { owner.ensureRuntime(); if (owner.disposing) throw StateError('Present intent is closed during disposal'); owner.present = present; owner.requestHostUpdate(); }
  void _emit(String event) { owner.invoke((run) => run.emit(event)); }
  void dispose() { disposed = true; _viewMounted = false; _queuedIntent = null; _invalidate(); transitionState.subscribers.clear(); isPresent.subscribers.clear(); }
}
class NativeTransition {
  NativeTransition(this.owner, this.machine) {
    owner.defineProps({'open':{'type':'boolean','empty':'fallback'},'defaultOpen':{'type':'boolean','empty':'fallback'},'appear':{'type':'boolean','empty':'fallback'},'enterDuration':{'type':'number','empty':'fallback'},'leaveDuration':{'type':'number','empty':'fallback'},'interrupt':{'type':'enum','empty':'fallback','options':['reverse','wait','immediate']}});
    owner.setDefaults({'defaultOpen':false,'appear':false,'enterDuration':300.0,'leaveDuration':200.0,'interrupt':'reverse'});
    controls = NativeTransitionControls(owner,machine);
    final publicControls = NativeTransitionControls(owner,machine,external:true);
    owner.moduleExpose('transitionState',machine.transitionState.external); owner.moduleExpose('isPresent',machine.isPresent.external); owner.moduleExpose('controls',publicControls);
    owner.moduleExpose('enter',publicControls.enter); owner.moduleExpose('leave',publicControls.leave); owner.moduleExpose('complete',publicControls.complete);
    for (final name in ['beforeEnter','afterEnter','beforeLeave','afterLeave']) owner.declareEvent<Null>(name,(value) => value == null);
    owner.on('created',(run) { machine.syncProps(owner._resolved,owner.rawProps.keys.toSet()); machine.initialize((owner.rawProps.containsKey('open') ? owner._resolved['open'] : owner._resolved['defaultOpen']) == true,owner.rawProps.containsKey('appear') ? owner._resolved['appear'] == true : machine.appearDefault); });
    owner.on('mounted',(run) => machine.mounted()); owner.on('unmounted',(run) => machine.unmounted()); owner.on('beforeDispose',(run) => machine.dispose());
    owner.watch(['open','interrupt','enterDuration','leaveDuration'],false,(run,next,previous,info) { machine.syncProps(next,owner.rawProps.keys.toSet()); if (owner.rawProps.containsKey('open')) machine.setTarget(next['open'] == true); });
  }
  final NativeOwner<Object?> owner;
  final NativeTransitionMachine machine;
  late final NativeTransitionControls controls;
  NativeState<String> get transitionState => machine.transitionState;
  NativeState<bool> get isPresent => machine.isPresent;
  void configure(Map<String,Object?> config) => machine.configure(config);
}
`;
