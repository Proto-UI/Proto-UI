const HEX = '0123456789abcdef';

function byteHex(value: number): string {
  return HEX[value >>> 4] + HEX[value & 15];
}

/** UTF-8 identifiers retain Node's replacement semantics without requiring host globals. */
export function utf8Hex(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index++) {
    let point = value.codePointAt(index)!;
    if (point > 0xffff) index++;
    else if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) result += byteHex(point);
    else if (point < 0x800) {
      result += byteHex(0xc0 | (point >>> 6)) + byteHex(0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      result +=
        byteHex(0xe0 | (point >>> 12)) +
        byteHex(0x80 | ((point >>> 6) & 0x3f)) +
        byteHex(0x80 | (point & 0x3f));
    } else {
      result +=
        byteHex(0xf0 | (point >>> 18)) +
        byteHex(0x80 | ((point >>> 12) & 0x3f)) +
        byteHex(0x80 | ((point >>> 6) & 0x3f)) +
        byteHex(0x80 | (point & 0x3f));
    }
  }
  return result;
}
