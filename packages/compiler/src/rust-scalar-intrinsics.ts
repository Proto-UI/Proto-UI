/**
 * ECMAScript Math.round for an already checked number, evaluated once.
 * Rust f64::round resolves negative ties differently. floor(x + .5) also loses
 * information immediately below .5 and at the exact-integer precision limit.
 */
export function rustMathRound(input: string): string {
  return `{ let input: f64 = ${input}; if !input.is_finite() || input == 0.0 || input.abs() >= 4503599627370496.0 { input } else if input >= -0.5 && input < 0.0 { -0.0 } else { let lower = input.floor(); if input - lower >= 0.5 { lower + 1.0 } else { lower } } }`;
}
