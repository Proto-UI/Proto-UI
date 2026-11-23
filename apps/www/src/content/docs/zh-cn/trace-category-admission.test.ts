// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeTrackEventCategories, missingTraceCategories } from './trace-category-admission';

const field = (number: number, value: Uint8Array) =>
  Buffer.concat([Buffer.from([number * 8 + 2, value.length]), value]);
const category = (name: string) => field(1, field(1, Buffer.from(name)));
const descriptor = (...parts: Uint8Array[]) => Buffer.concat(parts).toString('base64');

describe('native trace category admission', () => {
  it('decodes complete category messages with unrelated fields and repeated names', () => {
    const bytes = descriptor(
      category('cc'),
      field(
        1,
        Buffer.concat([field(2, Buffer.from('v8 is a description')), field(1, Buffer.from('gpu'))])
      ),
      category('cc'),
      field(2, Buffer.from('unknown descriptor field'))
    );
    expect(decodeTrackEventCategories(bytes)).toEqual(['cc', 'gpu']);
  });

  it('requires every original category even when legacy discovery is empty', () => {
    const required = ['devtools.timeline', 'blink.user_timing', 'v8', 'cc', 'gpu'];
    expect(missingTraceCategories(required, [])).toEqual(required);
    const names = decodeTrackEventCategories(descriptor(...required.map(category)));
    expect(missingTraceCategories(required, names)).toEqual([]);
    expect(
      missingTraceCategories(
        required,
        names.filter((name) => name !== 'gpu')
      )
    ).toEqual(['gpu']);
  });

  it('does not admit a category mentioned only in a description or tag', () => {
    const names = decodeTrackEventCategories(
      descriptor(
        field(
          1,
          Buffer.concat([
            field(1, Buffer.from('other')),
            field(2, Buffer.from('gpu')),
            field(3, Buffer.from('cc')),
          ])
        )
      )
    );
    expect(missingTraceCategories(['gpu', 'cc'], names)).toEqual(['gpu', 'cc']);
  });

  it('rejects duplicate singular names instead of admitting the overwritten category', () => {
    const malformed = descriptor(
      field(1, Buffer.concat([field(1, Buffer.from('gpu')), field(1, Buffer.from('other'))]))
    );
    expect(() => decodeTrackEventCategories(malformed)).toThrow('Duplicate category name field');
  });

  it.each([
    'not base64!',
    descriptor(Buffer.from([10, 8, 10, 3, 97])),
    descriptor(Buffer.from([10, 2, 8, 1])),
    descriptor(Buffer.from([0])),
    descriptor(Buffer.from([10, 3, 10, 1, 255])),
    descriptor(Buffer.from([128])),
    descriptor(Buffer.from([17, 0])),
    descriptor(Buffer.from([128, 128, 128, 128, 128, 128, 128, 127])),
  ])('fails closed on malformed native descriptor %s', (encoded) => {
    expect(() => decodeTrackEventCategories(encoded)).toThrow();
  });
});
