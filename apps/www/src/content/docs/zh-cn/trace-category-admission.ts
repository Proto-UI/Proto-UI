/** Read only Perfetto's advertised category names, never infer them from a
 * successful start call or a substring in a binary descriptor.
 * Schema: https://github.com/google/perfetto/blob/main/protos/perfetto/common/track_event_descriptor.proto
 * TrackEventDescriptor.available_categories = 1; TrackEventCategory.name = 1.
 */
export function decodeTrackEventCategories(encoded: string): string[] {
  if (
    typeof encoded !== 'string' ||
    encoded.length > 1_400_000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  )
    throw new Error('Invalid or oversized track-event descriptor');
  const bytes = Buffer.from(encoded, 'base64');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const categories = new Set<string>();
  const fields = (message: Uint8Array, visit: (field: number, data: Uint8Array) => void) => {
    let cursor = 0;
    const varint = () => {
      let value = 0;
      for (let shift = 0; shift <= 49; shift += 7) {
        if (cursor >= message.length) throw new Error('Truncated descriptor varint');
        const byte = message[cursor++];
        value += (byte & 127) * 2 ** shift;
        if (!Number.isSafeInteger(value)) throw new Error('Descriptor varint overflow');
        if (!(byte & 128)) return value;
      }
      throw new Error('Descriptor varint overflow');
    };
    while (cursor < message.length) {
      const tag = varint();
      const field = Math.floor(tag / 8),
        wire = tag % 8;
      if (field < 1 || field > 0x1fffffff) throw new Error('Invalid descriptor field');
      if (wire === 2) {
        const length = varint();
        if (length > message.length - cursor) throw new Error('Truncated descriptor field');
        visit(field, message.subarray(cursor, cursor + length));
        cursor += length;
      } else {
        // Field 1 is always length-delimited in both messages. Never treat a
        // malformed category/name as an unknown forward-compatible field.
        if (field === 1) throw new Error('Invalid category wire type');
        if (wire === 0) varint();
        else if (wire === 1 || wire === 5) cursor += wire === 1 ? 8 : 4;
        else throw new Error('Unsupported descriptor wire type');
        if (cursor > message.length) throw new Error('Truncated descriptor field');
      }
    }
  };
  fields(bytes, (field, category) => {
    if (field !== 1) return;
    let seenName = false;
    fields(category, (field, name) => {
      if (field !== 1) return;
      if (seenName) throw new Error('Duplicate category name field');
      seenName = true;
      const value = decoder.decode(name);
      if (!value || value.length > 1024 || /\s|\u0000/.test(value))
        throw new Error('Invalid advertised trace category');
      categories.add(value);
    });
  });
  return [...categories].sort();
}

export function missingTraceCategories(requested: readonly string[], available: readonly string[]) {
  const names = new Set(available);
  return requested.filter((name) => !names.has(name));
}
