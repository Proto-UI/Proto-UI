export class HostValueError extends TypeError {
  readonly code = 'invalid-host-value';

  constructor(expected: string, origin: string) {
    super(`${origin} requires ${expected}.`);
    this.name = 'HostValueError';
  }
}

// In Unicode mode a valid surrogate pair matches a single astral code point.
const loneSurrogate = /[\uD800-\uDFFF]/u;

export function readText(value: unknown, origin: string): string {
  if (typeof value !== 'string' || loneSurrogate.test(value)) {
    throw new HostValueError('well-formed Unicode text', origin);
  }
  return value;
}

export function readBool(value: unknown, origin: string): boolean {
  if (typeof value !== 'boolean') throw new HostValueError('a boolean', origin);
  return value;
}

export function readNumber(value: unknown, origin: string): number {
  if (typeof value !== 'number') throw new HostValueError('a binary64 number', origin);
  return value;
}

export function readUnit(value: unknown, origin: string): undefined {
  if (value !== undefined) throw new HostValueError('undefined', origin);
  return undefined;
}

export function readCallback<T extends (...args: never[]) => unknown>(
  callback: T | undefined,
  origin: string
): T | undefined {
  if (callback !== undefined && typeof callback !== 'function') {
    throw new HostValueError('a callback or undefined', origin);
  }
  return callback;
}

/** Only used at module initialization for NaNs with a noncanonical bit pattern. */
export function numberFromBits(high: number, low: number): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setUint32(0, high);
  bits.setUint32(4, low);
  return bits.getFloat64(0);
}
