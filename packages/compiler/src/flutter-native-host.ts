import { flutterNativeModulesSource } from './flutter-native-modules';

export const flutterNativeSource = `// Editable target-native host helpers. No Proto Runtime, Adapter, JS engine or semantic IR.
import 'dart:async';
import 'dart:collection';
import 'dart:ui' show SemanticsRole;
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/material.dart' show Scrollbar;

${flutterNativeModulesSource}

class NativeVoid { const NativeVoid(); }
class NativeOptional<T> {
  const NativeOptional.absent() : present = false, _value = null;
  const NativeOptional.value(T value) : present = true, _value = value;
  final bool present;
  final Object? _value;
  T get value { if (!present) throw StateError('Optional data field is absent'); return _value as T; }
}
Object? nativeValue(Object? value) => value is NativeOptional<Object?> ? value.present ? value.value : const NativeVoid() : value;
NativeOptional<T> nativeIndex<T>(List<T> values, int index) => index >= 0 && index < values.length ? NativeOptional.value(values[index]) : const NativeOptional<Never>.absent();
NativeOptional<R> nativeAccess<T, R>(T? receiver, NativeOptional<R> Function(T) read) => receiver == null ? const NativeOptional<Never>.absent() : read(receiver);
NativeOptional<T> nativeOptionalResult<T>(Object? value) { value = nativeValue(value); return value is NativeVoid ? const NativeOptional<Never>.absent() : NativeOptional.value(value as T); }
NativeOptional<T> nativeOptionalNullable<T>(T? value) => value == null ? const NativeOptional<Never>.absent() : NativeOptional.value(value);
Object? nativeCoalesce(Object? left, Object? Function() right) { final value = nativeValue(left); return value == null || value is NativeVoid ? right() : value; }
Map<String, Object?> nativeConfig<T>(T value, Map<String, Object?> Function(T) project) => project(value);
R nativeProject<T, R>(T value, R Function(T) project) => project(value);
bool nativeTruthy(Object? value) { value = nativeValue(value); return value is! NativeVoid && value != null && value != false && value != '' && (value is! num || value != 0 && !value.isNaN); }
double nativeNumber(Object? value) {
  value = nativeValue(value);
  if (value is NativeVoid) return double.nan;
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  if (value is bool) return value ? 1 : 0;
  if (value is String) {
    final text = value.trim(); if (text.isEmpty) return 0;
    if (RegExp(r'^0[xX][0-9a-fA-F]+$').hasMatch(text)) return BigInt.parse(text.substring(2),radix:16).toDouble();
    if (RegExp(r'^0[bB][01]+$').hasMatch(text)) return BigInt.parse(text.substring(2),radix:2).toDouble();
    if (RegExp(r'^0[oO][0-7]+$').hasMatch(text)) return BigInt.parse(text.substring(2),radix:8).toDouble();
    if (!RegExp(r'^[+-]?(?:Infinity|(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$').hasMatch(text)) return double.nan;
    return double.tryParse(text) ?? double.nan;
  }
  throw ArgumentError('Only admitted scalar values may undergo numeric coercion');
}
String nativeString(Object? value) {
  value = nativeValue(value);
  if (value is NativeVoid) return 'undefined';
  if (value == null) return 'null';
  if (value is num) { if (value == 0) return '0'; final text = value.toDouble().toString(); return text.endsWith('.0') ? text.substring(0,text.length-2) : text; }
  if (value is bool || value is String) return value.toString();
  throw ArgumentError('Only admitted scalar values may undergo string coercion');
}
bool nativeSame(Object? left, Object? right) { left = nativeValue(left); right = nativeValue(right); return left is NativeVoid || right is NativeVoid ? left is NativeVoid && right is NativeVoid : left is num && right is num ? left == right : left is String && right is String || left is bool && right is bool || left == null || right == null ? left == right : identical(left, right); }
bool nativeIdentitySame(Object? left, Object? right) { if (left is num && right is num) { if (left.isNaN || right.isNaN) return left.isNaN && right.isNaN; if (left == 0 && right == 0) return 1 / left == 1 / right; } return nativeSame(left, right); }
Object? nativeLogical(Object? left, Object? Function() right, bool and) => nativeTruthy(left) == and ? right() : left;
Object nativeAdd(Object? left, Object? right) { left = nativeValue(left); right = nativeValue(right); return left is String || right is String ? nativeString(left) + nativeString(right) : nativeNumber(left) + nativeNumber(right); }
bool nativeCompare(Object? left, Object? right, String operator) {
  left = nativeValue(left); right = nativeValue(right);
  if (left is String && right is String) { final comparison = left.compareTo(right); return operator == '<' ? comparison < 0 : operator == '<=' ? comparison <= 0 : operator == '>' ? comparison > 0 : comparison >= 0; }
  final a = nativeNumber(left), b = nativeNumber(right);
  return operator == '<' ? a < b : operator == '<=' ? a <= b : operator == '>' ? a > b : a >= b;
}
class NativeEmptyRecord { const NativeEmptyRecord(); }
class NativeProvided<T> {
  const NativeProvided.absent() : present = false, value = null;
  const NativeProvided.value(this.value) : present = true;
  final bool present;
  final T? value;
}
class NativeStateChange<T> {
  const NativeStateChange(this.prev, this.next, this.reason);
  String get type => 'next';
  final T prev;
  final T next;
  final Object? reason;
}
class NativeStateWatchEvent<T> {
  const NativeStateWatchEvent.next(this.prev, this.next, this.reason) : type = 'next';
  const NativeStateWatchEvent.disconnect() : type = 'disconnect', prev = null, next = null, reason = null;
  final String type;
  final T? prev, next;
  final Object? reason;
}
abstract class NativeObserved<T> {
  T get();
  void Function() subscribe(void Function(NativeStateChange<T>) callback);
  void unsubscribe(void Function() removal);
  Map<String, Object?> get spec;
  NativeObserved<T> get external;
}
class _ExternalState<T> implements NativeObserved<T> {
  _ExternalState(this.source);
  final NativeState<T> source;
  @override T get() { source.owner.ensureExternal(); return source.value; }
  @override Map<String, Object?> get spec { source.owner.ensureExternal(); return source.spec; }
  @override NativeObserved<T> get external => this;
  @override void Function() subscribe(void Function(NativeStateChange<T>) callback) {
    source.owner.ensureExternal();
    source.subscribers.add(callback);
    bool active = true;
    return () { source.owner.ensureExternal(); if (active) { active = false; source.subscribers.remove(callback); } };
  }
  @override void unsubscribe(void Function() removal) { source.owner.ensureExternal(); removal(); }
}
class NativeState<T> implements NativeObserved<T> {
  NativeState(this.owner, this.kind, this.semantic, T initial, Map<String, Object?> options, {this.observed = false}) : spec = Map.unmodifiable({...options, 'kind': kind}), value = initial {
    value = normalize(initial, initial: true);
    externalView = _ExternalState<T>(this);
  }
  final NativeOwnerBase owner;
  final String kind;
  final String semantic;
  final bool observed;
  @override final Map<String, Object?> spec;
  T value;
  late final NativeObserved<T> externalView;
  final Set<void Function(NativeStateChange<T>)> subscribers = {};
  @override NativeObserved<T> get external => externalView;
  @override T get() { owner.ensureAlive(); return value; }
  T normalize(T candidate, {bool initial = false}) {
    Object? next = candidate;
    if (kind == 'bool' && next is! bool || (kind == 'string' || kind == 'enum') && next is! String || kind.startsWith('number') && (next is! num || next.isNaN)) throw ArgumentError('Invalid State value for $semantic');
    final options = spec['options'];
    if (kind == 'enum' && (options is! List<Object?> || !options.contains(next))) throw RangeError('Enum State value outside options: $semantic');
    if (options is List<Object?> && options.isNotEmpty && !options.contains(next)) throw RangeError('State outside options: $semantic');
    if (next is num) {
      final min = spec['min'] as num?;
      final max = spec['max'] as num?;
      if (kind == 'number.range' && initial && spec['clamp'] == true) next = next.clamp(min ?? double.negativeInfinity, max ?? double.infinity);
      final numeric = next as num;
      if (kind == 'number.range' || kind == 'number.discrete' && (options is! List<Object?> || options.isEmpty)) {
        if (min != null && numeric < min || max != null && numeric > max) throw RangeError('State outside range: $semantic');
        final step = spec['step'] as num?;
        if (kind == 'number.discrete' && step != null && step > 0 && ((numeric - (min ?? 0)) / step) % 1 != 0) throw RangeError('State violates step: $semantic');
      }
    }
    return (next is num ? next.toDouble() : next) as T;
  }
  void set(T next, [Object? reason]) { owner.ensureRuntime(); if (observed) throw StateError('Observed State has no write authority'); publish(normalize(next), reason); }
  void setDefault(T next) { owner.ensureSetup(); if (observed) throw StateError('Observed State has no default authority'); value = normalize(next,initial:true); }
  void publish(T next, [Object? reason]) {
    if (nativeIdentitySame(value, next)) return;
    final previous = value; value = next;
    owner.project();
    final event = NativeStateChange<T>(previous, next, reason);
    owner.enqueue(() { for (final callback in List.of(subscribers)) { if (subscribers.contains(callback) && owner.alive && !owner.disposing) owner.inScope('state-observer', () => callback(event)); } });
  }
  @override void Function() subscribe(void Function(NativeStateChange<T>) callback) => externalView.subscribe(callback);
  @override void unsubscribe(void Function() removal) => externalView.unsubscribe(removal);
}
abstract class NativeEventBase { void emit(Object? payload); void clear(); }
class NativeEvent<T> implements NativeEventBase {
  NativeEvent(this.owner, this.accepts);
  final NativeOwnerBase owner;
  final bool Function(Object?) accepts;
  final Set<void Function(T)> _subscribers = {};
  void Function() subscribe(void Function(T) callback) { owner.ensureExternal(); _subscribers.add(callback); return () { owner.ensureExternal(); _subscribers.remove(callback); }; }
  @override void emit(Object? payload) { if (!accepts(payload)) throw ArgumentError('Exposed event payload violates its checked signature'); final value = payload as T; for (final callback in List.of(_subscribers)) { if (_subscribers.contains(callback)) owner.inScope('expose-observer', () => callback(value)); } }
  @override void clear() => _subscribers.clear();
}

class NativeContextKey<T> {
  NativeContextKey(this.debugName, this.accepts);
  final String debugName;
  final bool Function(Object?) accepts;
}
abstract class _ContextCellBase { Object? get erasedValue; void write(Object? value); }
class _ContextCell<T> implements _ContextCellBase {
  _ContextCell(this.value);
  T value;
  @override Object? get erasedValue => value;
  @override void write(Object? next) { value = next as T; }
}
class _ContextSubscription {
  _ContextSubscription(this.optional, this.callback);
  final bool optional;
  final void Function(Object?, Object?)? callback;
  bool active = true;
}
class NativeContextScope {
  NativeContextScope(this.owner, this.parent) { _live.add(this); }
  static final Set<NativeContextScope> _live = {};
  static final Queue<void Function()> _notifications = Queue();
  static bool _dispatching = false;
  final NativeOwnerBase owner;
  NativeContextScope? parent;
  final Map<Object, _ContextCellBase> _providers = Map.identity();
  final Map<Object, List<_ContextSubscription>> _subscriptions = Map.identity();
  NativeContextScope? resolve(Object key) {
    NativeContextScope? current = this;
    final visited = <NativeContextScope>{};
    while (current != null) {
      if (!visited.add(current)) throw StateError('Cyclic logical Context ancestry');
      if (!current.owner.alive) return null;
      if (current._providers.containsKey(key)) return current;
      current = current.parent;
    }
    return null;
  }
  void provide<T>(NativeContextKey<T> key, T value) {
    owner.ensureSetup();
    if (_providers.containsKey(key)) throw StateError('Duplicate Context provider');
    if (!key.accepts(value)) throw ArgumentError('Invalid Context value: \${key.debugName}');
    _providers[key] = _ContextCell<T>(value);
  }
  void Function() subscribe<T>(NativeContextKey<T> key, bool optional, [void Function(T?, T?)? callback]) {
    owner.ensureSetup();
    if (!optional && resolve(key) == null) throw StateError('Required Context provider missing: \${key.debugName}');
    final entries = _subscriptions.putIfAbsent(key, () => []);
    if (entries.any((entry) => entry.optional != optional)) throw StateError('Conflicting Context subscription mode');
    final entry = _ContextSubscription(optional, callback == null ? null : (next, prev) => callback(next as T?, prev as T?));
    entries.add(entry);
    return () { owner.ensureAlive(); entry.active = false; };
  }
  void _subscribed(Object key, bool optional) {
    owner.ensureAlive();
    if (!_subscriptions.containsKey(key) || !_subscriptions[key]!.any((entry) => entry.optional == optional)) throw StateError('Context access requires declared subscription');
  }
  T read<T>(NativeContextKey<T> key) {
    _subscribed(key, false);
    final provider = resolve(key);
    if (provider == null) throw StateError('Required Context provider missing');
    return provider._providers[key]!.erasedValue as T;
  }
  T? tryRead<T>(NativeContextKey<T> key) { _subscribed(key, true); return resolve(key)?._providers[key]?.erasedValue as T?; }
  void update<T>(NativeContextKey<T> key, T Function(T) next) { owner.ensureRuntime(); if (!_providers.containsKey(key)) _subscribed(key, false); final provider = resolve(key); if (provider == null) throw StateError('Required Context provider missing'); _write(key, next, provider); }
  bool tryUpdate<T>(NativeContextKey<T> key, T Function(T) next) { owner.ensureRuntime(); _subscribed(key, true); final provider = resolve(key); if (provider == null) return false; _write(key, next, provider); return true; }
  void _write<T>(NativeContextKey<T> key, T Function(T) next, NativeContextScope provider) {
    final cell = provider._providers[key]!;
    final previous = cell.erasedValue as T;
    final value = next(previous);
    owner.ensureAlive();
    if (!provider.owner.alive || !key.accepts(value)) throw ArgumentError('Invalid Context transition');
    cell.write(value);
    for (final scope in List.of(_live)) {
      if (!scope.owner.alive || scope.resolve(key) != provider) continue;
      for (final entry in scope._subscriptions[key] ?? <_ContextSubscription>[]) {
        if (!entry.active || entry.callback == null) continue;
        _notifications.add(() { if (entry.active && scope.owner.alive) entry.callback!(value, previous); });
      }
    }
    if (_dispatching) return;
    _dispatching = true;
    Object? failure;
    StackTrace? trace;
    try { while (_notifications.isNotEmpty) { try { _notifications.removeFirst()(); } catch (error, stack) { failure ??= error; trace ??= stack; } } }
    finally { _dispatching = false; }
    if (failure != null) Error.throwWithStackTrace(failure, trace!);
  }
  void dispose() { _live.remove(this); for (final entries in _subscriptions.values) { for (final entry in entries) { entry.active = false; } } _subscriptions.clear(); _providers.clear(); parent = null; }
}
class NativeContextHost extends InheritedWidget {
  const NativeContextHost({super.key, required this.scope, required super.child, this.active = true});
  final NativeContextScope scope;
  final bool active;
  static NativeContextScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<NativeContextHost>()?.scope;
  @override bool updateShouldNotify(NativeContextHost oldWidget) => oldWidget.scope != scope || oldWidget.active != active;
}

class NativeStyleHandle {
  const NativeStyleHandle(this.tokens, this.groups);
  final List<String> tokens;
  final List<String> groups;
}
class _StyleChunk {
  _StyleChunk(this.handles, [this.test]);
  final List<NativeStyleHandle> handles;
  final bool Function()? test;
  bool active = true;
}
class NativeRule { NativeRule(this._dispose); final void Function() _dispose; void dispose() => _dispose(); }
class NativeStyle {
  NativeStyle(this.owner);
  final NativeOwnerBase owner;
  final List<_StyleChunk> _base = [], _rules = [];
  final Map<String, String?> _patch = {};
  void Function() use(List<NativeStyleHandle> handles) { owner.ensureSetup(); final entry = _StyleChunk(List.unmodifiable(handles)); _base.add(entry); return () { owner.ensureSetup(); entry.active = false; }; }
  NativeRule rule(bool Function() test, List<NativeStyleHandle> handles) { owner.ensureSetup(); final entry = _StyleChunk(List.unmodifiable(handles), test); _rules.add(entry); return NativeRule(() { owner.ensureSetup(); entry.active = false; }); }
  void patch(List<NativeStyleHandle> handles) { owner.ensureRuntime(); for (final handle in handles) { for (int i = 0; i < handle.tokens.length; i++) { _patch[handle.groups[i]] = handle.tokens[i]; } } owner.project(); }
  void suppress(List<NativeStyleHandle> handles) { owner.ensureRuntime(); for (final handle in handles) { for (final group in handle.groups) { _patch[group] = null; } } owner.project(); }
  void clearPatch() { owner.ensureRuntime(); _patch.clear(); owner.project(); }
  List<String> tokens() {
    final merged = <String, String>{};
    for (final chunk in [..._base, ..._rules]) { if (!chunk.active || chunk.test != null && (!owner.surfaceActive || !chunk.test!())) continue; for (final handle in chunk.handles) { for (int i = 0; i < handle.tokens.length; i++) { merged[handle.groups[i]] = handle.tokens[i]; } } }
    for (final entry in _patch.entries) { merged.remove(entry.key); if (entry.value != null) merged[entry.key] = entry.value!; }
    return List.unmodifiable(merged.values);
  }
  void dispose() { _base.clear(); _rules.clear(); _patch.clear(); }
}

class NativeInput {
  NativeInput(this.type, {this.key, this.ctrlKey = false, this.metaKey = false, this.altKey = false, this.shiftKey = false, this.repeat = false, this.pointer, this.globalPosition, this.localPosition, this.keyboardEvent, this.pointerEvent});
  final String type;
  final String? key;
  final bool ctrlKey, metaKey, altKey, shiftKey, repeat;
  final int? pointer;
  final Offset? globalPosition, localPosition;
  final KeyEvent? keyboardEvent;
  final PointerEvent? pointerEvent;
  bool defaultPrevented = false;
  bool _active = true, _passive = false;
  NativeInput get control => this;
  void requestDefaultActionPrevention() { if (!_active || _passive) throw StateError('Default action prevention outside live cancellable input'); defaultPrevented = true; }
}
class NativeFocus {
  NativeFocus(this.owner) {
    focused = NativeState<bool>(owner, 'bool', 'focus.focused', false, const {}, observed: true);
    focusVisible = NativeState<bool>(owner, 'bool', 'focus.focusVisible', false, const {}, observed: true);
    focusable = NativeState<bool>(owner, 'bool', 'focus.focusable', false, const {}, observed: true);
    node.addListener(_changed);
    FocusManager.instance.addHighlightModeListener(_highlightChanged);
  }
  final NativeOwnerBase owner;
  final FocusNode node = FocusNode();
  late final NativeState<bool> focused, focusVisible, focusable;
  bool disabled = false, autoFocus = false, nav = true;
  NativeFocusScopeKey? scopeKey;
  NativeFocusRovingKey? groupKey;
  void configure(Map<String, Object?> patch) { owner.ensureSetup(); disabled = patch['disabled'] as bool? ?? disabled; autoFocus = patch['autoFocus'] as bool? ?? autoFocus; if (patch.containsKey('navParticipation')) nav = patch['navParticipation'] != 'none'; scopeKey = patch['scopeKey'] as NativeFocusScopeKey? ?? scopeKey; groupKey = patch['groupKey'] as NativeFocusRovingKey? ?? groupKey; refresh(); }
  void setDisabled(bool value) { owner.ensureRuntime(); disabled = value; node.canRequestFocus = !value && owner.focusAvailable; if (value) node.unfocus(); refresh(); owner.project(); }
  void focusSelf([Map<String,Object?> options = const {}]) { owner.ensureRuntime(); if (!owner.ready || disabled) return; node.requestFocus(); if (options['preventScroll'] != true) { final context = node.context; if (context != null) Scrollable.ensureVisible(context); } }
  void focus([Map<String, Object?> options = const {}]) => focusSelf(options);
  bool isFocused() { owner.ensureAlive(); return focused.get(); }
  void blur() { owner.ensureRuntime(); node.unfocus(); }
  bool rovingSelected = false, rovingActive = false;
  void setNavParticipation(String value) { owner.ensureRuntime(); if (!['auto','none'].contains(value)) throw ArgumentError('Invalid focus navigation participation'); nav = value != 'none'; node.skipTraversal = !nav; refresh(); owner.project(); }
  void setRovingStatus(Map<String, Object?> status) { owner.ensureRuntime(); rovingSelected = status['selected'] as bool? ?? rovingSelected; rovingActive = status['active'] as bool? ?? rovingActive; owner.project(); }
  void refresh() { focusable.publish(owner.ready && owner.focusAvailable && !disabled && nav); }
  void _highlightChanged(FocusHighlightMode mode) { if (owner.alive) focusVisible.publish(node.hasFocus && mode == FocusHighlightMode.traditional); }
  void _changed() { if (!owner.alive) return; focused.publish(node.hasFocus); focusVisible.publish(node.hasFocus && FocusManager.instance.highlightMode == FocusHighlightMode.traditional); owner.dispatch(NativeInput(node.hasFocus ? 'nav.focus' : 'nav.blur')); }
  void dispose() { FocusManager.instance.removeHighlightModeListener(_highlightChanged); node.removeListener(_changed); node.dispose(); focused.subscribers.clear(); focusVisible.subscribers.clear(); focusable.subscribers.clear(); }
}
class NativeAccessible {
  NativeAccessible(this.owner);
  final NativeOwnerBase owner;
  final Map<String, NativeObserved<Object?>> states = {};
  final Map<String, String> actions = {};
  Object? roleValue;
  bool contentName = false;
  late final NativeA11yRef objectRef = NativeA11yRef()..bind(this);
  Object? _identifier, _name, _description, _heading;
  Object? resolve(Object? value) => value is NativeObserved<Object?> ? value.get() : value;
  String? get identifier => resolve(_identifier) as String?;
  String? get textName => resolve(_name) as String?;
  String? get textDescription => resolve(_description) as String?;
  num? get heading => resolve(_heading) as num?;
  final Map<String, Map<String, Object?>> relations = {};
  Map<String, Object?> treeBehavior = {};
  void id(Object? value) { owner.ensureSetup(); _identifier = value; }
  void name(Object? value) { owner.ensureSetup(); _name = value; contentName = false; }
  void description(Object? value) { owner.ensureSetup(); _description = value; }
  void relation(String key, Map<String, Object?> spec) { owner.ensureSetup(); if (spec['mode'] == 'append' && relations.containsKey(key)) { final prior = relations[key]!['target']; final next = spec['target']; relations[key] = {...spec, 'target': [if (prior is List<Object?>) ...prior else prior, if (next is List<Object?>) ...next else next]}; } else relations[key] = Map.unmodifiable(spec); }
  void tree(Map<String, Object?> patch) { owner.ensureSetup(); treeBehavior = {...treeBehavior, ...patch}; }
  void level(Object value) { owner.ensureSetup(); final current = resolve(value); if (current is! num || !current.isFinite || current < 1 || current % 1 != 0) throw ArgumentError('Invalid semantic heading level'); _heading = value; }
  void state<T>(String name, NativeObserved<T> handle) { owner.ensureSetup(); states[name] = handle; }
  void action(String name, [Map<String, Object?> options = const {}]) { owner.ensureSetup(); actions[name] = options['event'] as String? ?? name; }
  void role(Object value) { owner.ensureSetup(); if (value is! String && value is! NativeObserved<String>) throw ArgumentError('Invalid AX role'); roleValue = value; }
  void nameFromContent() { owner.ensureSetup(); contentName = true; }
  Object? value(String name) => states[name]?.get();
  Widget wrap(Widget child) {
    final role = roleValue is NativeObserved<String> ? (roleValue as NativeObserved<String>).get() : roleValue;
    final controls = relations['controls']?['target'];
    final controlsNodes = _relationIds(controls).toSet();
    final nativeRole = SemanticsRole.values.where((value) => value.name.toLowerCase() == role?.toString().toLowerCase()).firstOrNull;
    final labelledBy = _relationText((relations['labelledBy'] ?? relations['labelledby'])?['target']);
    final describedBy = _relationText((relations['describedBy'] ?? relations['describedby'])?['target']);
    Widget result = Semantics(container: true, explicitChildNodes: !contentName,
      identifier: identifier ?? owner.hostTarget.key.toString(), label: labelledBy.isEmpty ? textName : labelledBy.join(' '), hint: describedBy.isEmpty ? textDescription : describedBy.join(' '), headingLevel: heading?.toInt(), controlsNodes: controlsNodes.isEmpty ? null : controlsNodes, role: nativeRole,
      button: role == 'button', textField: role == 'textbox', slider: role == 'slider', link: role == 'link', image: role == 'img', header: role == 'heading',
      enabled: value('disabled') == true ? false : null, checked: value('checked') is bool ? value('checked') as bool : null, mixed: value('checked') == 'mixed', selected: value('selected') as bool?, expanded: value('expanded') as bool?, toggled: value('pressed') is bool ? value('pressed') as bool : null,
      readOnly: value('readOnly') as bool?, scopesRoute: value('modal') == true,
      liveRegion: value('live') == 'polite' || value('live') == 'assertive', hidden: resolve(treeBehavior['hidden']) == true || value('hidden') == true,
      onTap: actions.containsKey('activate') || role == 'button' ? () => owner.semanticAction(actions['activate'] ?? 'press.commit') : null,
      onIncrease: actions.containsKey('increment') ? () => owner.semanticAction(actions['increment']!) : null,
      onDecrease: actions.containsKey('decrement') ? () => owner.semanticAction(actions['decrement']!) : null,
      child: child);
    if (resolve(treeBehavior['mergeChildren']) == true || contentName) result = MergeSemantics(child: result);
    return result;
  }
  List<String> _relationIds(Object? target) {
    target = resolve(target);
    if (target is String) return target.split(RegExp(r'\\s+')).where((id) => id.isNotEmpty).toList();
    if (target is NativeA11yRef) { final accessible = target.accessible; return accessible == null || !accessible.owner.alive ? const [] : [accessible.identifier ?? accessible.owner.hostTarget.key.toString()]; }
    if (target is NativeHostTarget) return [target.key.toString()];
    if (target is List<Object?>) return [for (final item in target) ..._relationIds(item)];
    return const [];
  }
  List<String> _relationText(Object? target) {
    final ids = _relationIds(target);
    return [for (final participant in NativeOwner._liveOwners) if (participant.alive && ids.contains(participant.accessible.identifier ?? participant.hostTarget.key.toString())) participant.accessible.textName ?? nativeContentText(participant._projection)];
  }
}
class NativeA11yRef {
  NativeAccessible? _accessible;
  NativeAccessible? get accessible => _accessible;
  void bind(NativeAccessible target) { if (_accessible != null && _accessible != target && _accessible!.owner.alive) throw StateError('Semantic object ref already has a live owner'); _accessible = target; }
}
String nativeContentText(Widget? widget) {
  if (widget is Text) return widget.data ?? widget.textSpan?.toPlainText() ?? '';
  if (widget is NativeElement) return widget.children.map(nativeContentText).join('');
  if (widget is _NativeSlot) return nativeContentText(widget.owner.suppliedChild.value);
  if (widget is Flex) return widget.children.map(nativeContentText).join('');
  if (widget is Wrap) return widget.children.map(nativeContentText).join('');
  return '';
}
class _Listener {
  _Listener(this.callback, this.global, this.once, this.passive);
  final void Function(NativeInput) callback;
  final bool global, once, passive;
  bool active = true;
}
abstract class NativeOwnerBase {
  bool get alive;
  bool get disposing;
  bool get ready;
  bool get surfaceActive;
  bool get focusAvailable;
  NativeHostTarget get hostTarget;
  void ensureAlive();
  void ensureExternal();
  void ensureSetup();
  void ensureRuntime();
  T inScope<T>(String scope, T Function() callback);
  void project();
  void enqueue(void Function() callback);
  void dispatch(NativeInput event, {bool globalOnly = false});
  void semanticAction(String event);
}
class NativeRun<P> {
  NativeRun(this.owner, this._valid);
  final NativeOwner<P> owner;
  final bool Function() _valid;
  void check() { owner.ensureAlive(); if (!_valid()) throw StateError('Callback handle is stale'); }
  P get props { check(); return owner.props; }
  Map<String, Object?> get rawProps { check(); return owner.rawProps; }
  bool isProvided(String key) { check(); return owner.rawProps.containsKey(key); }
  NativeContextScope get context { check(); return owner.context; }
  NativeAnatomy get anatomy { check(); return owner.anatomy; }
  NativeHostTarget? getHost() { check(); return owner.ready ? owner.hostTarget : null; }
  NativeStyle get style { check(); return owner.style; }
  void update() { check(); owner.requestUpdate(); }
  void setPresent(bool value) { check(); owner.ensureRuntime(); if (owner.disposing) throw StateError('Present intent is closed during disposal'); owner.present = value; owner.requestHostUpdate(); }
  void emit(String name, [Object? payload]) { check(); owner.emit(name, payload); }
}
class NativeFrame<P> {
  NativeFrame(this.owner, this.child);
  final NativeOwner<P> owner;
  final Widget? child;
  bool active = true, slotUsed = false;
  void check() { owner.ensureAlive(); if (!active) throw StateError('Renderer handle is stale'); }
  P get props { check(); return owner.props; }
  Map<String, Object?> get rawProps { check(); return owner.rawProps; }
  bool isProvided(String key) { check(); return owner.rawProps.containsKey(key); }
  NativeContextScope get context { check(); return owner.context; }
  Widget slot() { check(); if (slotUsed) throw StateError('Only one anonymous supplied-child slot is allowed'); slotUsed = true; return _NativeSlot(owner: owner); }
  Widget el(String tag, [Object? a, Object? b]) {
    check();
    final hasProps = a is Map<String, Object?>;
    final children = nativeChildList(hasProps ? b : a);
    final style = hasProps ? a['style'] as NativeStyleHandle? : null;
    return NativeElement(owner, tag, children, style?.tokens ?? const []);
  }
}
class NativeElement extends StatelessWidget {
  const NativeElement(this.owner, this.tag, this.children, this.tokens, {super.key});
  final NativeOwner<Object?> owner;
  final String tag;
  final List<Widget> children;
  final List<String> tokens;
  @override Widget build(BuildContext context) {
    bool horizontal = tag.toLowerCase() == 'row';
    bool flex = tag.toLowerCase() == 'row' || tag.toLowerCase() == 'column';
    CrossAxisAlignment cross = CrossAxisAlignment.start;
    MainAxisAlignment main = MainAxisAlignment.start;
    double gap = 0;
    for (final token in tokens) {
      if (token == 'flex' || token == 'inline-flex') { flex = true; horizontal = true; }
      if (token == 'flex-col') { flex = true; horizontal = false; }
      if (token == 'flex-row') { flex = true; horizontal = true; }
      if (token == 'items-center') cross = CrossAxisAlignment.center;
      if (token == 'items-end') cross = CrossAxisAlignment.end;
      if (token == 'items-stretch') cross = CrossAxisAlignment.stretch;
      if (token == 'justify-center') main = MainAxisAlignment.center;
      if (token == 'justify-end') main = MainAxisAlignment.end;
      if (token == 'justify-between') main = MainAxisAlignment.spaceBetween;
      if (token == 'justify-around') main = MainAxisAlignment.spaceAround;
      if (token == 'justify-evenly') main = MainAxisAlignment.spaceEvenly;
      if (token.startsWith('gap-')) { final amount = double.tryParse(token.substring(4)); if (amount == null) throw ArgumentError('Unmapped Flutter gap: $token'); gap = amount * 4; }
    }
    final spaced = <Widget>[for (int index = 0; index < children.length; index++) ...[if (index != 0 && gap != 0) SizedBox(width: horizontal ? gap : null, height: horizontal ? null : gap), children[index]]];
    Widget layout;
    final kind = tag.toLowerCase();
    if (kind == 'input' || kind == 'textarea') {
      final control = owner.textControl;
      if (control == null) throw StateError('Native text Root requires asTextControl');
      control.multiline = kind == 'textarea'; layout = control.widget();
    } else if (kind == 'img' || kind == 'image') {
      final image = owner.imageView;
      if (image == null) throw StateError('Native image Root requires asImageView');
      layout = image.widget();
    } else if (kind == 'stack') layout = Stack(children: spaced);
    else if (flex) layout = Flex(direction: horizontal ? Axis.horizontal : Axis.vertical, mainAxisSize: MainAxisSize.min, mainAxisAlignment: main, crossAxisAlignment: cross, children: spaced);
    else if (['span','text','p','label','a','strong','em','small','code','li'].contains(kind)) layout = Wrap(children: spaced);
    else if (['column','div','section','root','button','main','ul','ol','nav','article','header','footer','aside','form','table','tbody','thead','tr','td','th','h1','h2','h3','h4','h5','h6'].contains(kind)) layout = Column(mainAxisSize: MainAxisSize.min, mainAxisAlignment: main, crossAxisAlignment: cross, children: spaced);
    else throw ArgumentError('No Flutter layout mapping for authored element: $tag');
    layout = nativeStyleWidget(layout, tokens, layoutApplied: true);
    if (tokens.contains('select-none')) layout = SelectionContainer.disabled(child: layout);
    if (tokens.contains('cursor-pointer')) layout = MouseRegion(cursor: SystemMouseCursors.click, child: layout);
    return layout;
  }
}
List<Widget> nativeChildList(Object? value) {
  if (value == null) return const [];
  if (value is Widget) return [value];
  if (value is String || value is num) return [Text(nativeString(value))];
  if (value is List<Object?>) return [for (final item in value) ...nativeChildList(item)];
  throw ArgumentError('Template child must be Widget, text, number, array or null');
}
Widget nativeChildren(Object? value) {
  final children = nativeChildList(value);
  if (children.isEmpty) return const SizedBox.shrink();
  return children.length == 1 ? children.single : Column(mainAxisSize: MainAxisSize.min, children: children);
}
class _NativeSlot extends StatelessWidget {
  const _NativeSlot({required this.owner});
  final NativeOwner<Object?> owner;
  @override Widget build(BuildContext context) => ValueListenableBuilder<Widget?>(valueListenable: owner.suppliedChild, builder: (_, child, __) => child ?? const SizedBox.shrink());
}
class _NativePhysicalRoot<P> extends StatefulWidget {
  const _NativePhysicalRoot({required this.owner, required this.version, required this.child});
  final NativeOwner<P> owner;
  final int version;
  final Widget child;
  @override State<_NativePhysicalRoot<P>> createState() => _NativePhysicalRootState<P>();
}
class _NativePhysicalRootState<P> extends State<_NativePhysicalRoot<P>> {
  void _schedule() { final version = widget.version; WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) widget.owner._commit(version); }); }
  @override void initState() { super.initState(); _schedule(); }
  @override void didUpdateWidget(covariant _NativePhysicalRoot<P> oldWidget) { super.didUpdateWidget(oldWidget); _schedule(); }
  @override void activate() { super.activate(); _schedule(); }
  @override void deactivate() { widget.owner._physicalDetach(); super.deactivate(); }
  @override Widget build(BuildContext context) => widget.child;
}
class _PropWatch<P> {
  _PropWatch(this.keys, this.raw, this.callback);
  final List<String>? keys;
  final bool raw;
  final void Function(NativeRun<P>, Map<String, Object?>, Map<String, Object?>, Map<String, Object?>) callback;
  bool active = true;
}
class NativeOwner<P> implements NativeOwnerBase {
  NativeOwner(this.invalidate, NativeContextScope? parent, {required this.makeProps, required this.checks}) {
    context = NativeContextScope(this, parent); style = NativeStyle(this); focus = NativeFocus(this); accessible = NativeAccessible(this);
    anatomy = NativeAnatomy(this); hostTarget = NativeHostTarget(rootKey, acceptsRead: () => ready); _liveOwners.add(this);
    FocusManager.instance.addEarlyKeyEventHandler(_earlyKey);
    GestureBinding.instance.pointerRouter.addGlobalRoute(_globalPointer);
    _typedProps = makeProps(_resolved);
  }
  final void Function() invalidate;
  final P Function(Map<String, Object?>) makeProps;
  final Map<String, bool Function(Object?)> checks;
  late final NativeContextScope context;
  late final NativeStyle style;
  late final NativeFocus focus;
  late final NativeAccessible accessible;
  late final NativeAnatomy anatomy;
  late final NativeHostTarget hostTarget;
  final GlobalKey rootKey = GlobalKey();
  static final Set<NativeOwner<Object?>> _liveOwners = {};
  static int _order = 0;
  final int logicalOrder = _order++;
  BuildContext? logicalContext;
  final Set<String> hookNames = {};
  NativeFocusEntry? focusEntry;
  NativeFocusScope? focusScope;
  NativeFocusRoving? focusRoving;
  NativeCollection? collection;
  NativeCollectionItem<P>? collectionItem;
  NativeBoundary<P>? boundary;
  NativeHitParticipation? hitParticipation;
  NativeOverlay? overlay;
  NativeScroll? scroll;
  NativeTextControl<P>? textControl;
  NativeImageView<P>? imageView;
  NativePositioning? positioning;
  NativeTransition? transition;
  NativeTableStructure? tableStructure;
  final Set<void Function()> _commitObservers = {};
  @override bool alive = true;
  @override bool disposing = false;
  bool setup = true, present = true, attached = true, dirty = true, queued = false, committed = false, trigger = false;
  @override bool get focusAvailable => hookNames.contains('asFocusable') || hookNames.contains('asFocusEntry') || hookNames.contains('asFocusScope') || trigger || textControl != null;
  bool _ready = false;
  @override bool get surfaceActive => alive && !disposing && attached && present && (context.parent?.owner.surfaceActive ?? true);
  @override bool get ready => _ready && surfaceActive;
  set ready(bool value) { _ready = value; }
  int epoch = 0, _ticket = 0, _renderVersion = 0, _committedVersion = -1;
  String? scope;
  late P _typedProps;
  P get props { ensureAlive(); return _typedProps; }
  Map<String, Object?> rawProps = const {}, _resolved = const {};
  final Map<String, Map<String, Object?>> _specs = {};
  final Map<String, Object?> _previousValid = {};
  final List<Map<String, Object?>> _defaults = [];
  final List<_PropWatch<P>> _watchers = [];
  final Map<String, List<void Function(NativeRun<P>)>> _life = {};
  final Map<String, NativeEventBase> _events = {};
  final Set<String> _exposeNames = {};
  final Map<String,Object?> _moduleExposes = {};
  Set<String> _semantics = {};
  final List<void Function()> _cleanups = [];
  final Queue<void Function()> _emissions = Queue();
  bool _emitting = false;
  final Map<String, List<_Listener>> _listeners = {};
  final Set<int> _pressedPointers = {};
  bool _keyboardPress = false;
  Widget? _projection;
  final ValueNotifier<Widget?> suppliedChild = ValueNotifier(null);
  Widget Function(NativeFrame<P>)? renderer;
  @override void ensureAlive() { if (!alive) throw StateError('Logical owner is terminally disposed'); }
  @override void ensureExternal() { ensureAlive(); if (disposing) throw StateError('Logical owner is disposing'); }
  @override void ensureSetup() { ensureAlive(); if (!setup) throw StateError('Setup-only authority is closed'); }
  @override void ensureRuntime() { ensureAlive(); if (setup || scope == null || scope == 'render' || disposing && scope != 'before-dispose' && scope != 'unmounted') throw StateError('Operation requires an owned callback'); }
  @override T inScope<T>(String origin, T Function() callback) { ensureAlive(); final previous = scope; scope = origin; try { return callback(); } finally { scope = previous; } }
  T invoke<T>(T Function(NativeRun<P>) callback) {
    ensureAlive(); bool active = true; final run = NativeRun<P>(this, () => active);
    try { return callback(run); } finally { active = false; }
  }
  @override void enqueue(void Function() callback) {
    _emissions.add(callback); if (_emitting) return; _emitting = true;
    Object? failure; StackTrace? trace;
    try { while (_emissions.isNotEmpty && alive) { try { _emissions.removeFirst()(); } catch (error, stack) { failure ??= error; trace ??= stack; } } } finally { _emitting = false; }
    if (failure != null) Error.throwWithStackTrace(failure, trace!);
  }
  bool _hostQueued = false, _hostTerminalRequested = false;
  void requestHostUpdate({bool terminal = false}) {
    _hostTerminalRequested = _hostTerminalRequested || terminal;
    if (_hostQueued) return;
    _hostQueued = true;
    scheduleMicrotask(() { _hostQueued = false; final terminal = _hostTerminalRequested; _hostTerminalRequested = false; if ((alive && !disposing || terminal) && attached) invalidate(); });
  }
  @override void project() { if (alive && !disposing && !setup) requestHostUpdate(); }
  NativeState<T> state<T>(String kind, String semantic, T initial, [Map<String, Object?> options = const {}]) {
    ensureSetup(); if (semantic.isEmpty || !_semantics.add(semantic)) throw ArgumentError('State semantic must be nonempty and unique in its frame');
    final handle = NativeState<T>(this, kind, semantic, initial, options);
    _cleanups.add(handle.subscribers.clear); return handle;
  }
  void Function() watchState<T>(NativeObserved<T> state, void Function(NativeRun<P>,NativeStateWatchEvent<T>) callback) {
    ensureSetup(); bool active = true;
    final source = state is _ExternalState<T> ? state.source : state as NativeState<T>;
    void observer(NativeStateChange<T> change) { if (active && alive && !setup && !disposing) inScope('state-watch',() => invoke((run) => callback(run,NativeStateWatchEvent.next(change.prev,change.next,change.reason)))); }
    source.subscribers.add(observer);
    void release() { if (!active) return; active = false; source.subscribers.remove(observer); }
    _cleanups.add(release);
    return () { ensureAlive(); release(); };
  }
  T withFrame<T>(T Function() callback) {
    ensureSetup(); final previous = _semantics; _semantics = {};
    try { return callback(); } finally { _semantics = previous; }
  }
  void declareExpose(String name) { ensureSetup(); if (!_exposeNames.add(name)) throw StateError('Duplicate expose: $name'); }
  Object? publicExposure(String name) { ensureAlive(); return _moduleExposes.containsKey(name) ? _moduleExposes[name] : _events[name]; }
  void moduleExpose(String name, Object? value) { declareExpose(name); _moduleExposes[name] = value; }
  T install<T>(String name, T Function() create) { ensureSetup(); hookNames.add(name); return create(); }
  NativeTableStructure declareTableStructure(String role) { ensureSetup(); final current = tableStructure; if (current != null && current.role != role) throw StateError('Table role already declared'); return tableStructure ??= NativeTableStructure(this,role); }
  NativeTransition declareTransition() { ensureSetup(); return transition ??= NativeTransition(this,NativeTransitionMachine(this)); }
  void declareTextControl(bool multiline) { ensureSetup(); if (textControl != null) throw StateError('Duplicate static TextControl declaration'); textControl = NativeTextControl<P>(this)..multiline = multiline; }
  void declareImageView(Map<String, Object?> config) { ensureSetup(); if (imageView != null) throw StateError('Duplicate static ImageView declaration'); final module = NativeImageView<P>(this); module.config = Map.unmodifiable(config); module.source = config['source'] as String; imageView = module; }
  void Function() onCommit(void Function() callback) { ensureSetup(); _commitObservers.add(callback); return () { _commitObservers.remove(callback); }; }
  void declareEvent<T>(String name, bool Function(Object?) accepts) { declareExpose(name); _events[name] = NativeEvent<T>(this, accepts); }
  NativeEvent<T> event<T>(String name) { ensureExternal(); final event = _events[name]; if (event == null) throw StateError('Undeclared event'); return event as NativeEvent<T>; }
  void emit(String name, Object? value) { ensureRuntime(); final event = _events[name]; if (event == null) throw StateError('Undeclared event'); event.emit(value); }
  void on(String phase, void Function(NativeRun<P>) callback) { ensureSetup(); _life.putIfAbsent(phase, () => []).add(callback); }
  void _fire(String phase) {
    Object? failure; StackTrace? trace;
    final origin = phase == 'beforeDispose' ? 'before-dispose' : phase;
    if (phase == 'unmounted') { overlay?.detached(); tableStructure?.clear(); scheduleMicrotask(() { if (!alive) return; NativeTableStructure.refreshAll(); for (final participant in List.of(_liveOwners)) { if (participant.ready) { for (final observer in List.of(participant._commitObservers)) observer(); } } }); }
    for (final callback in List.of(_life[phase] ?? <void Function(NativeRun<P>)>[])) { try { inScope(origin, () => invoke(callback)); } catch (error, stack) { failure ??= error; trace ??= stack; } }
    if (failure != null) Error.throwWithStackTrace(failure, trace!);
  }
  void defineProps(Map<String, Object?> declarations) {
    ensureSetup();
    final merged = <String, Map<String, Object?>>{..._specs};
    for (final entry in declarations.entries) {
      if (!checks.containsKey(entry.key)) throw ArgumentError('Unknown prop declaration');
      final value = entry.value as Map<String, Object?>;
      final previous = merged[entry.key];
      if (previous != null && previous['type'] != value['type']) throw ArgumentError('Conflicting prop types');
      final priorRange = previous?['range'] as Map<String, Object?>?;
      final range = value['range'] as Map<String, Object?>?;
      if (priorRange != null && range != null && ((range['min'] as num? ?? double.negativeInfinity) > (priorRange['min'] as num? ?? double.negativeInfinity) || (range['max'] as num? ?? double.infinity) < (priorRange['max'] as num? ?? double.infinity))) throw ArgumentError('Conflicting prop ranges');
      int rank(Object? policy) => policy == 'accept' ? 0 : policy == 'error' ? 2 : 1;
      if (previous != null && value.containsKey('empty') && rank(value['empty']) > rank(previous['empty'])) throw ArgumentError('Conflicting prop empty policy');
      merged[entry.key] = {...?previous, ...value, 'empty': previous?['empty'] ?? value['empty'] ?? 'fallback', if (previous != null && previous.containsKey('default')) 'default': previous['default']};
    }
    _specs.clear(); _specs.addAll(merged); _resolved = _resolve(false); _typedProps = makeProps(_resolved);
  }
  void setDefaults(Map<String, Object?> values) { ensureSetup(); for (final key in values.keys) { if (!_specs.containsKey(key)) throw ArgumentError('Undeclared prop default'); } _defaults.insert(0, Map.unmodifiable(values)); _resolved = _resolve(false); _typedProps = makeProps(_resolved); }
  bool _valid(String name, Object? value) {
    if (checks[name]?.call(value) != true) return false;
    final spec = _specs[name]!;
    final options = spec['options']; if (options is List<Object?> && !options.contains(value)) return false;
    final range = spec['range'];
    if (range is Map<String, Object?> && value is num && (value < (range['min'] as num? ?? double.negativeInfinity) || value > (range['max'] as num? ?? double.infinity))) return false;
    return true;
  }
  Map<String, Object?> _resolve(bool strict) {
    final next = <String, Object?>{};
    for (final entry in _specs.entries) {
      final name = entry.key, spec = entry.value;
      final provided = rawProps.containsKey(name), raw = rawProps[name];
      if (provided && raw != null && _valid(name, raw)) { final value = raw is num ? raw.toDouble() : raw; next[name] = value; _previousValid[name] = value; continue; }
      if (provided && raw == null && spec['empty'] == 'accept') { next[name] = null; continue; }
      bool found = false; Object? fallback;
      if (provided && _previousValid.containsKey(name) && _valid(name, _previousValid[name])) { fallback = _previousValid[name]; found = true; }
      final layers = [..._defaults, if (spec.containsKey('default')) <String, Object?>{name: spec['default']}];
      if (!found) { for (final layer in layers) { if (!layer.containsKey(name)) continue; final value = layer[name]; if (value == null && (!strict || spec['empty'] != 'error') || value != null && _valid(name, value)) { fallback = value; found = true; break; } } }
      if (!found && strict && spec['empty'] == 'error') throw ArgumentError('Prop has no valid fallback: $name');
      next[name] = fallback;
      if (provided && fallback != null) _previousValid[name] = fallback;
    }
    return Map.unmodifiable(next);
  }
  void Function() watch(List<String>? keys, bool raw, void Function(NativeRun<P>, Map<String, Object?>, Map<String, Object?>, Map<String, Object?>) callback) {
    ensureSetup(); final watcher = _PropWatch<P>(keys == null ? null : List.unmodifiable(keys), raw, callback); _watchers.add(watcher); return () { ensureAlive(); watcher.active = false; };
  }
  bool _hydrated = false;
  void applyProps(Map<String, Object?> next) {
    ensureExternal(); final previous = _resolved, previousRaw = rawProps;
    final incoming = Map<String,Object?>.unmodifiable(next);
    final priorValid = Map<String,Object?>.of(_previousValid);
    rawProps = incoming;
    try { _resolved = _resolve(true); }
    catch (error, stack) { rawProps = previousRaw; _previousValid.clear(); _previousValid.addAll(priorValid); Error.throwWithStackTrace(error, stack); }
    _typedProps = makeProps(_resolved); transition?.machine.syncProps(_resolved, rawProps.keys.toSet()); project();
    if (!_hydrated) { _hydrated = true; return; }
    final changed = <String>[for (final key in _specs.keys) if (!nativeIdentitySame(previous[key], _resolved[key])) key];
    final rawKeys = {...previousRaw.keys, ...rawProps.keys};
    final rawChanged = <String>[for (final key in rawKeys) if (previousRaw.containsKey(key) != rawProps.containsKey(key) || !nativeIdentitySame(previousRaw[key], rawProps[key])) key];
    final snapshot = _resolved, rawSnapshot = rawProps;
    for (final watcher in List.of(_watchers)) {
      final all = watcher.raw ? rawChanged : changed;
      final matched = watcher.keys == null ? all : all.where(watcher.keys!.contains).toList();
      if (!watcher.active || matched.isEmpty) continue;
      final info = <String, Object?>{'changedKeysAll': List<String>.unmodifiable(all), 'changedKeysMatched': List<String>.unmodifiable(matched)};
      inScope('props-watch', () => invoke((run) => watcher.callback(run, watcher.raw ? rawSnapshot : snapshot, watcher.raw ? previousRaw : previous, info)));
    }
  }
  void finishSetup(Map<String, Object?> initial) { applyProps(initial); setup = false; if (overlay != null && !overlay!.retained && overlay!.presence == null) present = overlay!.isOpen(); _fire('created'); }
  void requestUpdate() { ensureExternal(); dirty = true; if (queued || !attached || !present) return; queued = true; final ticket = ++_ticket; scheduleMicrotask(() { if (!alive || disposing || ticket != _ticket) return; queued = false; if (attached && present) invalidate(); }); }
  void externalPresent(bool value) { ensureExternal(); present = value; requestHostUpdate(); }
  void deactivate() { if (!alive) return; attached = false; ready = false; _ticket++; queued = false; scheduleMicrotask(() { if (alive && !attached) _detach(); }); }
  void activate() { if (!alive) return; attached = true; requestHostUpdate(); }
  Widget build(Widget? child) {
    if (!alive || disposing) return const SizedBox.shrink();
    suppliedChild.value = child;
    final visible = surfaceActive;
    if (!visible) {
      ready = false;
      final ticket = _ticket;
      WidgetsBinding.instance.addPostFrameCallback((_) { if (alive && !disposing && !surfaceActive && ticket == _ticket) { if (committed) { committed = false; epoch++; imageView?.unmount(); scroll?.unmount(); focus.node.unfocus(); _fire('unmounted'); } dirty = true; } });
      if (_projection == null) return NativeContextHost(scope: context, active: false, child: const SizedBox.shrink());
    }
    if (visible && (_projection == null || dirty)) {
      final frame = NativeFrame<P>(this, child);
      try { _projection = inScope('render', () => renderer?.call(frame) ?? const SizedBox.shrink()); }
      finally { frame.active = false; }
      dirty = false; _renderVersion++;
    }
    Widget root = _projection!;
    if (textControl != null && root is! NativeElement) root = textControl!.widget();
    if (imageView != null && root is! NativeElement) root = imageView!.widget();
    if (root is! NativeElement) root = NativeElement(this, 'root', [root], const []);
    root = nativeStyleWidget(root, style.tokens());
    if (scroll != null) root = scroll!.wrap(root);
    root = accessible.wrap(root);
    root = Focus(focusNode: textControl == null ? focus.node : null, canRequestFocus: visible && focusAvailable && !focus.disabled, skipTraversal: !visible || !focusAvailable || !focus.nav, descendantsAreFocusable: visible, descendantsAreTraversable: visible, child: root);
    if (focusRoving != null) root = focusRoving!.wrap(root);
    if (focusScope != null) root = focusScope!.wrap(root);
    root = MouseRegion(onEnter: (event) => dispatch(NativeInput('pointer.enter', pointer: event.pointer)), onExit: (event) => dispatch(NativeInput('pointer.leave', pointer: event.pointer)), child: root);
    root = Listener(behavior: HitTestBehavior.translucent, onPointerDown: _pointerDown, onPointerMove: _pointerMove, onPointerUp: _pointerUp, onPointerCancel: _pointerCancel, child: root);
    root = KeyedSubtree(key: rootKey, child: root);
    root = NativeHostRegion(target: hostTarget, ownsKey: false, child: root);
    root = _NativePhysicalRoot<P>(owner: this, version: _renderVersion, child: root);
    if (overlay != null) root = overlay!.wrap(root);
    return NativeContextHost(scope: context, active: visible, child: Offstage(offstage: !visible, child: root));
  }
  void _commit(int version) {
    if (!alive || disposing || !surfaceActive || version != _renderVersion || hostTarget.physicalBox == null) return;
    ready = true;
    focus.refresh(); scroll?.mount();
    final updated = _committedVersion != version; _committedVersion = version;
    if (!committed) { committed = true; epoch++; imageView?.mount(); _fire('mounted'); if (focus.autoFocus && !focus.disabled) focus.node.requestFocus(); }
    else if (updated) _fire('updated');
    for (final owner in List.of(_liveOwners)) { if (owner.alive && owner.ready) { for (final observer in List.of(owner._commitObservers)) observer(); } }
    NativeTableStructure.refreshAll();
  }
  void _physicalDetach() {
    if (!alive || disposing) return;
    ready = false;
    scheduleMicrotask(() { if (!alive || disposing || hostTarget.physicalBox != null) return; if (committed) { committed = false; epoch++; imageView?.unmount(); scroll?.unmount(); _fire('unmounted'); } });
  }
  void _detach() {
    ready = false; _ticket++; queued = false; _pressedPointers.clear(); _keyboardPress = false;
    if (committed) { committed = false; epoch++; imageView?.unmount(); scroll?.unmount(); focus.node.unfocus(); _fire('unmounted'); }
    _projection = null; dirty = true;
  }
  void asTrigger() { ensureSetup(); hookNames.add('asTrigger'); trigger = true; }
  void Function() listen(String type, void Function(NativeRun<P>, NativeInput) callback, {bool global = false, Map<String, Object?> options = const {}}) {
    ensureSetup();
    final entry = _Listener((event) => inScope('event', () => invoke((run) => callback(run, event))), global, options['once'] == true, options['passive'] == true);
    _listeners.putIfAbsent(type, () => []).add(entry); return () { ensureAlive(); entry.active = false; };
  }
  @override void dispatch(NativeInput event, {bool globalOnly = false}) {
    if (!alive || disposing || !ready || !present || !attached) return;
    final hostNames = <String, String>{'key.down': 'keydown', 'key.up': 'keyup', 'pointer.down': 'pointerdown', 'pointer.move': 'pointermove', 'pointer.up': 'pointerup', 'pointer.cancel': 'pointercancel', 'pointer.enter': 'pointerenter', 'pointer.leave': 'pointerleave', 'nav.focus': 'focus', 'nav.blur': 'blur', 'input': 'input', 'change': 'change'};
    final hostName = hostNames[event.type];
    final routes = <(String, NativeInput)>[(event.type, event), if (hostName != null) ('host:$hostName', NativeInput(hostName, key: event.key, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, shiftKey: event.shiftKey, repeat: event.repeat, pointer: event.pointer, globalPosition: event.globalPosition, localPosition: event.localPosition, keyboardEvent: event.keyboardEvent, pointerEvent: event.pointerEvent))];
    try { for (final route in routes) {
      final input = route.$2;
      try { for (final entry in List.of(_listeners[route.$1] ?? <_Listener>[])) {
        if (!alive || disposing || !ready || !present) break;
        if (!entry.active || globalOnly && !entry.global || !globalOnly && entry.global) continue;
        input._passive = entry.passive; if (entry.once) entry.active = false; entry.callback(input);
      } } finally { input._active = false; event.defaultPrevented = event.defaultPrevented || input.defaultPrevented; }
    } }
    finally { event._active = false; event._passive = false; }
  }
  @override void semanticAction(String type) { dispatch(NativeInput(type)); }
  NativeInput _pointerEvent(String type, PointerEvent event) => NativeInput(type, pointer: event.pointer, globalPosition: event.position, localPosition: event.localPosition, pointerEvent: event);
  void _pointerDown(PointerDownEvent event) { final input = _pointerEvent('pointer.down', event); dispatch(input); if (input.defaultPrevented) return; if (trigger && !focus.disabled && event.buttons == kPrimaryButton) { final start = _pointerEvent('press.start', event); dispatch(start); if (start.defaultPrevented) return; _pressedPointers.add(event.pointer); if (focusAvailable) focus.node.requestFocus(); } if (ready) hostTarget.pointerRoute?.call(event); }
  void _pointerMove(PointerMoveEvent event) { dispatch(_pointerEvent('pointer.move', event)); }
  void _pointerUp(PointerUpEvent event) { final input = _pointerEvent('pointer.up', event); dispatch(input); if (_pressedPointers.remove(event.pointer)) { dispatch(_pointerEvent('press.end', event)); if (!input.defaultPrevented && !focus.disabled) dispatch(_pointerEvent('press.commit', event)); } }
  void _pointerCancel(PointerCancelEvent event) { dispatch(_pointerEvent('pointer.cancel', event)); if (_pressedPointers.remove(event.pointer)) dispatch(_pointerEvent('press.cancel', event)); }
  NativeInput _keyEvent(KeyEvent event) => NativeInput(event is KeyUpEvent ? 'key.up' : 'key.down', key: event.logicalKey == LogicalKeyboardKey.space ? ' ' : event.logicalKey.keyLabel, ctrlKey: HardwareKeyboard.instance.isControlPressed, altKey: HardwareKeyboard.instance.isAltPressed, metaKey: HardwareKeyboard.instance.isMetaPressed, shiftKey: HardwareKeyboard.instance.isShiftPressed, repeat: event is KeyRepeatEvent, keyboardEvent: event);
  KeyEventResult _key(KeyEvent event, NativeInput input) {
    input._active = true; dispatch(input);
    if (trigger && !focus.disabled && !input.defaultPrevented && (event.logicalKey == LogicalKeyboardKey.space || event.logicalKey == LogicalKeyboardKey.enter)) {
      if (event is KeyDownEvent && !_keyboardPress) { _keyboardPress = true; dispatch(NativeInput('press.start', key: input.key)); }
      if (event is KeyUpEvent && _keyboardPress) { _keyboardPress = false; dispatch(NativeInput('press.end', key: input.key)); dispatch(NativeInput('press.commit', key: input.key)); }
    }
    return input.defaultPrevented ? KeyEventResult.handled : KeyEventResult.ignored;
  }
  KeyEventResult _earlyKey(KeyEvent event) { final input = _keyEvent(event); dispatch(input, globalOnly: true); if (overlay?.key(event) == true) return KeyEventResult.handled; if (focus.node.hasFocus) return _key(event, input); return input.defaultPrevented ? KeyEventResult.handled : KeyEventResult.ignored; }
  void _globalPointer(PointerEvent event) { if (event is PointerDownEvent) { boundary?.pointer(event); overlay?.pointer(event); } final type = event is PointerDownEvent ? 'pointer.down' : event is PointerUpEvent ? 'pointer.up' : event is PointerMoveEvent ? 'pointer.move' : event is PointerCancelEvent ? 'pointer.cancel' : null; if (type != null) dispatch(_pointerEvent(type, event), globalOnly: true); }
  void close() {
    if (!alive || disposing) return; disposing = true;
    Object? failure; StackTrace? trace;
    try { _detach(); } catch (error, stack) { failure = error; trace = stack; }
    try { _fire('beforeDispose'); } catch (error, stack) { failure ??= error; trace ??= stack; }
    finally {
      alive = false; ready = false; epoch++; _ticket++;
      FocusManager.instance.removeEarlyKeyEventHandler(_earlyKey); GestureBinding.instance.pointerRouter.removeGlobalRoute(_globalPointer);
      final resources = <void Function()>[focus.dispose, if (focusScope != null) focusScope!.dispose, if (focusRoving != null) focusRoving!.dispose, context.dispose, style.dispose, anatomy.dispose, if (boundary != null) boundary!.dispose, if (hitParticipation != null) hitParticipation!.dispose, if (overlay != null) overlay!.dispose, if (scroll != null) scroll!.dispose, if (textControl != null) textControl!.dispose, if (imageView != null) imageView!.dispose, if (positioning != null) positioning!.dispose, if (tableStructure != null) tableStructure!.states.dispose, if (transition != null) transition!.machine.dispose, if (collection != null) collection!.dispose, if (collectionItem != null) collectionItem!.dispose, hostTarget.dispose, ..._cleanups, ..._events.values.map((event) => event.clear), suppliedChild.dispose];
      for (final release in resources) { try { release(); } catch (error, stack) { failure ??= error; trace ??= stack; } }
      _liveOwners.remove(this); _commitObservers.clear();
      _events.clear(); _moduleExposes.clear(); _life.clear(); _watchers.clear(); _listeners.clear(); _emissions.clear(); _cleanups.clear(); _projection = null; renderer = null;
    }
    if (failure != null) Error.throwWithStackTrace(failure, trace!);
  }
}

Widget nativeStyleWidget(Widget child, List<String> tokens, {bool layoutApplied = false}) {
  if (child is NativeElement) return NativeElement(child.owner, child.tag, child.children, [...child.tokens, ...tokens], key: child.key);
  Color? background, foreground;
  EdgeInsets padding = EdgeInsets.zero;
  double? width, height, opacity, radius;
  FontWeight? weight;
  double? fontSize;
  bool hidden = false;
  final colors = <String, Color>{'black': const Color(0xff000000), 'white': const Color(0xffffffff), 'transparent': const Color(0x00000000), 'red-500': const Color(0xffef4444), 'blue-500': const Color(0xff3b82f6), 'blue-600': const Color(0xff2563eb), 'green-500': const Color(0xff22c55e), 'gray-100': const Color(0xfff3f4f6), 'gray-500': const Color(0xff6b7280), 'gray-900': const Color(0xff111827)};
  double? scale(String value) { if (value == 'px') return 1; return double.tryParse(value)?.toDouble() == null ? null : double.parse(value) * 4; }
  for (final token in tokens) {
    if (token == 'hidden') { hidden = true; continue; }
    if (token.startsWith('bg-')) { background = colors[token.substring(3)]; if (background == null) throw ArgumentError('Unmapped Flutter color: $token'); continue; }
    if (token.startsWith('text-')) {
      const sizes = <String, double>{'xs': 12, 'sm': 14, 'base': 16, 'lg': 18, 'xl': 20, '2xl': 24};
      final value = token.substring(5); if (sizes.containsKey(value)) fontSize = sizes[value]; else { foreground = colors[value]; if (foreground == null) throw ArgumentError('Unmapped Flutter text style: $token'); } continue;
    }
    if (token == 'font-bold') { weight = FontWeight.bold; continue; }
    if (token == 'font-normal') { weight = FontWeight.normal; continue; }
    if (token.startsWith('opacity-')) { opacity = double.parse(token.substring(8)) / 100; continue; }
    if (token.startsWith('p-')) { final value = scale(token.substring(2)); if (value == null) throw ArgumentError('Unmapped Flutter spacing: $token'); padding = EdgeInsets.all(value); continue; }
    if (token.startsWith('px-')) { final value = scale(token.substring(3)); if (value == null) throw ArgumentError('Unmapped Flutter spacing'); padding = padding.copyWith(left: value, right: value); continue; }
    if (token.startsWith('py-')) { final value = scale(token.substring(3)); if (value == null) throw ArgumentError('Unmapped Flutter spacing'); padding = padding.copyWith(top: value, bottom: value); continue; }
    if (token.startsWith('w-')) { width = token == 'w-full' ? double.infinity : scale(token.substring(2)); if (width == null) throw ArgumentError('Unmapped Flutter width'); continue; }
    if (token.startsWith('h-')) { height = token == 'h-full' ? double.infinity : scale(token.substring(2)); if (height == null) throw ArgumentError('Unmapped Flutter height'); continue; }
    if (token == 'rounded' || token.startsWith('rounded-')) { radius = token == 'rounded' ? 4 : token == 'rounded-full' ? 999 : token == 'rounded-lg' ? 8 : token == 'rounded-md' ? 6 : token == 'rounded-sm' ? 2 : token == 'rounded-none' ? 0 : null; if (radius == null) throw ArgumentError('Unmapped Flutter radius'); continue; }
    if (layoutApplied && (token.startsWith('items-') || token.startsWith('justify-') || token.startsWith('gap-') || ['flex','flex-row','flex-col','inline-flex','block','inline-block','cursor-pointer','select-none'].contains(token))) continue;
    if (token == 'outline-none') continue;
    throw ArgumentError('No Flutter style mapping for token: $token');
  }
  Widget result = DefaultTextStyle.merge(style: TextStyle(color: foreground, fontWeight: weight, fontSize: fontSize), child: child);
  result = Container(width: width, height: height, padding: padding, decoration: background != null || radius != null ? BoxDecoration(color: background, borderRadius: radius == null ? null : BorderRadius.circular(radius)) : null, child: result);
  if (opacity != null) result = Opacity(opacity: opacity.clamp(0, 1).toDouble(), child: result);
  if (hidden) result = Offstage(offstage: true, child: result);
  return result;
}
`;
