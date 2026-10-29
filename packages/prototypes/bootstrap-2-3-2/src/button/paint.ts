/** Shared passive paint. The caller retains its own Button or native-link owner. */
export const bootstrapButtonRaised =
  'shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]';
export const bootstrapButtonPressed =
  'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]';

/** Complete, finite background recipes: one semantic bg owner per state. */
export const bootstrapButtonRestFill = {
  default: 'bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x]',
  primary: 'bg-[#006dcc_linear-gradient(#08c,#04c)_0_0_repeat-x]',
  warning: 'bg-[#faa732_linear-gradient(#fbb450,#f89406)_0_0_repeat-x]',
  danger: 'bg-[#da4f49_linear-gradient(#ee5f5b,#bd362f)_0_0_repeat-x]',
  success: 'bg-[#5bb75b_linear-gradient(#62c462,#51a351)_0_0_repeat-x]',
  info: 'bg-[#49afcd_linear-gradient(#5bc0de,#2f96b4)_0_0_repeat-x]',
  inverse: 'bg-[#363636_linear-gradient(#444,#222)_0_0_repeat-x]',
};
export const bootstrapButtonInteractiveFill = {
  default: 'bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x]',
  primary: 'bg-[#04c_linear-gradient(#08c,#04c)_0_-15px_repeat-x]',
  warning: 'bg-[#f89406_linear-gradient(#fbb450,#f89406)_0_-15px_repeat-x]',
  danger: 'bg-[#bd362f_linear-gradient(#ee5f5b,#bd362f)_0_-15px_repeat-x]',
  success: 'bg-[#51a351_linear-gradient(#62c462,#51a351)_0_-15px_repeat-x]',
  info: 'bg-[#2f96b4_linear-gradient(#5bc0de,#2f96b4)_0_-15px_repeat-x]',
  inverse: 'bg-[#222_linear-gradient(#444,#222)_0_-15px_repeat-x]',
};
export const bootstrapButtonFlatFill = {
  default: 'bg-[#e6e6e6_none_0_0_repeat-x]',
  primary: 'bg-[#04c_none_0_0_repeat-x]',
  warning: 'bg-[#f89406_none_0_0_repeat-x]',
  danger: 'bg-[#bd362f_none_0_0_repeat-x]',
  success: 'bg-[#51a351_none_0_0_repeat-x]',
  info: 'bg-[#2f96b4_none_0_0_repeat-x]',
  inverse: 'bg-[#222_none_0_0_repeat-x]',
};

export const bootstrapButtonPressedFill = {
  default: 'bg-[#e6e6e6_none_0_-15px_repeat-x]',
  primary: 'bg-[#04c_none_0_-15px_repeat-x]',
  warning: 'bg-[#f89406_none_0_-15px_repeat-x]',
  danger: 'bg-[#bd362f_none_0_-15px_repeat-x]',
  success: 'bg-[#51a351_none_0_-15px_repeat-x]',
  info: 'bg-[#2f96b4_none_0_-15px_repeat-x]',
  inverse: 'bg-[#222_none_0_-15px_repeat-x]',
};
