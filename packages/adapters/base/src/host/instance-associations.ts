/** Keep the separately typed Adapter input out of even custom getProps projections. */
export function withoutInstanceAssociations<T extends Record<string, unknown>>(
  input: T | null | undefined
): T {
  if (!input) return {} as T;
  if (!Object.hasOwn(input, 'instanceAssociations')) return input;
  const props = { ...input };
  delete props.instanceAssociations;
  return props;
}
