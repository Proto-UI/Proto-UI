/** Portable presentation inputs. Native document and interaction semantics belong to the consumer. */
export interface TextRootProps {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  tone?: 'default' | 'muted' | 'inherit';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  font?: 'body' | 'heading' | 'mono';
  /** `size` preserves the selected size's line box; other values explicitly override it. */
  leading?: 'size' | 'tighter' | 'tight' | 'snug' | 'normal' | 'relaxed';
  tracking?: 'normal' | 'tight' | 'tighter';
  emphasis?: 'normal' | 'italic';
  decoration?: 'none' | 'underline' | 'line-through';
}

export type TextRootExposes = {};
