// packages/modules/expose/src/kernel.ts

export type ExposeEntry = {
  key: string;
  value: unknown;
};

export class ExposeKernel {
  private map = new Map<string, unknown>();

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): unknown | undefined {
    return this.map.get(key);
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  keys(): string[] {
    return Array.from(this.map.keys());
  }

  entries(): ExposeEntry[] {
    return Array.from(this.map.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }

  toRecord(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.map) {
      Object.defineProperty(out, k, {
        value: v,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return out;
  }

  clear(): void {
    this.map.clear();
  }
}
