/** Private Web read boundary. Missing data is not a failed property read. */
export type PointerSampleFieldRead =
  | Readonly<{ readable: true; value: unknown }>
  | Readonly<{ readable: false; value: undefined }>;

export function readPointerSampleField(
  native: unknown,
  field: 'pointerType' | 'buttons'
): PointerSampleFieldRead {
  if ((typeof native !== 'object' || native === null) && typeof native !== 'function')
    return { readable: false, value: undefined };
  try {
    return { readable: true, value: (native as Record<string, unknown>)[field] };
  } catch {
    return { readable: false, value: undefined };
  }
}
