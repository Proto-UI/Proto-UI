declare function __puiHashCreate(): number;
declare function __puiHashUpdate(id: number, serialized: string): void;
declare function __puiHashDigest(id: number): string;

/** Only the canonical compiler's synchronous SHA-256 interface is bound to the host. */
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new TypeError(`Unavailable compiler digest: ${algorithm}`);
  let id = __puiHashCreate();
  return {
    update(value: string) {
      if (id < 0) throw new TypeError('Compiler digest has already been consumed.');
      if (typeof value !== 'string')
        throw new TypeError('Compiler digests require UTF-8 string input.');
      // QuickJS's host string accessor is NUL-terminated. JSON transports every
      // UTF-16 code unit before the host applies the canonical UTF-8 encoding.
      __puiHashUpdate(id, JSON.stringify(value));
      return this;
    },
    digest(encoding: string) {
      if (encoding !== 'hex') throw new TypeError('Compiler digest output must be hexadecimal.');
      if (id < 0) throw new TypeError('Compiler digest has already been consumed.');
      const current = id;
      id = -1;
      return __puiHashDigest(current);
    },
  };
}
