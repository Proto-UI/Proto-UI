export type SelfHitSample = {
  same: boolean;
  connected: boolean;
  marked: boolean;
  checked: string | null;
  disabled: string | null;
  focused: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  events: { type: string; trusted: boolean }[];
  text: string | null;
};
export function mount(runtime: string): Promise<SelfHitSample>;
export function expanded(value: boolean): SelfHitSample;
export function disabled(value: boolean): void;
export function dispose(): void;
export function sample(): SelfHitSample;
