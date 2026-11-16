/** Framework-only opaque input normalization; shared association admission remains strict. */
export const nativeVue2AssociationsArtifact = {
  path: '.proto-ui/interaction/vue2-associations-v1.ts',
  kind: 'source' as const,
  contents: String.raw`import { validateNativeInstanceAssociations as validateInstanceAssociations } from './control-label-v1';
type InstanceAssociations = Readonly<{controlLabel?: object | null}>;

type Vue2Observable = (value: object) => object;
type Vue2ObserverConstructor = new (...args: never[]) => object;
const observerConstructors = new WeakMap<Vue2Observable, Vue2ObserverConstructor>();

/** Strip only the owning Vue2 runtime's proven reactive-wrapper metadata. */
export function normalizeVue2InstanceAssociations(
  input: unknown,
  observable: Vue2Observable | undefined
): InstanceAssociations {
  if (!input || typeof input !== 'object') return validateInstanceAssociations(input);
  const descriptor = Object.getOwnPropertyDescriptor(input, '__ob__');
  if (!descriptor) return validateInstanceAssociations(input);
  if (
    Object.getPrototypeOf(input) !== Object.prototype ||
    Object.getOwnPropertySymbols(input).length ||
    Object.getOwnPropertyNames(input).some((key) => key !== 'controlLabel' && key !== '__ob__') ||
    descriptor.enumerable ||
    !Object.hasOwn(descriptor, 'value') ||
    typeof observable !== 'function'
  )
    return validateInstanceAssociations(input);

  let Observer = observerConstructors.get(observable);
  if (!Observer) {
    // Discover from this component's actual Vue constructor, never from an
    // input object's self-described constructor or a different bundled Vue.
    const probe = observable({});
    const observed = Object.getOwnPropertyDescriptor(probe, '__ob__')?.value as object | undefined;
    const constructor = observed && Object.getPrototypeOf(observed)?.constructor;
    if (typeof constructor !== 'function') return validateInstanceAssociations(input);
    Observer = constructor as Vue2ObserverConstructor;
    observerConstructors.set(observable, Observer);
  }
  const observer = descriptor.value as object | null;
  if (
    !(observer instanceof Observer) ||
    Object.getOwnPropertyDescriptor(observer, 'value')?.value !== input
  )
    return validateInstanceAssociations(input);

  // Read from the original wrapper so Vue dependency tracking, getter receiver
  // and the original thrown error survive normalization.
  return validateInstanceAssociations(
    Object.hasOwn(input, 'controlLabel')
      ? { controlLabel: Reflect.get(input, 'controlLabel', input) }
      : {}
  );
}
`,
};
