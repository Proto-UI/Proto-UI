/** Shared passive paint. The caller retains its own Button or native-link owner. */
export const bootstrapButtonFill = {
  default: 'bg-[linear-gradient(#fff,#e6e6e6)] text-foreground border-border',
  primary: 'bg-[linear-gradient(#08c,#04c)] text-primary-foreground border-primary',
};
export const bootstrapButtonActiveFill = {
  default: 'bg-[#e6e6e6]',
  primary: 'bg-[#04c]',
};
export const bootstrapButtonRaised =
  'shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]';
export const bootstrapButtonPressed =
  'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]';
