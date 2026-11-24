/** Independent arithmetic from the draft pass contract, without production imports. */
export const shaderSourcePixels = [255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64, 64, 128, 192, 255];
const multiplier = [0.5, 1, 0.25, 0.5];
export function expectedShaderLinearPixels() {
  return shaderSourcePixels.map((value, index) =>
    Math.round(value * multiplier[index % 4] * (index % 4 === 3 ? 1 : multiplier[3]))
  );
}
export function expectedShaderImagePixels() {
  const output = expectedShaderLinearPixels();
  return output.map((value, index) => {
    if (index % 4 === 3) return value;
    const alpha = output[index - (index % 4) + 3] / 255;
    const linear = alpha === 0 ? 0 : value / 255 / alpha;
    return Math.round(
      255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055)
    );
  });
}

/** Scene oracle starts from measured canvas sRGB, then crosses each quantization boundary. */
export function expectedShaderSceneImagePixels(replacement = false) {
  const input = replacement
    ? [0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255]
    : [255, 0, 0, 255, 0, 128, 0, 255, 0, 0, 64, 255, 64, 128, 192, 255];
  const linear = input.map((byte, index) => {
    if (index % 4 === 3) return byte;
    const channel = byte / 255;
    return Math.round(
      255 * (channel < 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4))
    );
  });
  const output = linear.map((value, index) =>
    Math.round(value * multiplier[index % 4] * (index % 4 === 3 ? 1 : multiplier[3]))
  );
  return output.map((value, index) => {
    if (index % 4 === 3) return value;
    const alpha = output[index - (index % 4) + 3] / 255;
    const channel = alpha ? value / (255 * alpha) : 0;
    return Math.round(
      255 * (channel < 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055)
    );
  });
}
