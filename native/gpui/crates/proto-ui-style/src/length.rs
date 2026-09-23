//! Evaluates the length forms the recorded vocabulary and themes use.
//!
//! The fixtures were surveyed rather than guessed: the only units present are
//! `px`, `rem`, `em`, `%` and unitless, and the only functions over them are
//! `calc`, `min` and `max`. Anything else is reported.
//!
//! A percentage stays symbolic. `calc(100% - 1px)` is a real value with no
//! single pixel answer until something supplies the basis it is a percentage
//! *of*, and that basis differs per property: `width: 100%` is of the
//! container while `translate: -50%` is of the element's own size. Resolving
//! it here would mean guessing which, so [`Dimension`] keeps both parts and
//! the host applies the basis it knows.

/// A length as `px + percent`, which is what `calc()` mixing them produces.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Dimension {
    pub px: f32,
    pub percent: f32,
}

impl Dimension {
    pub const ZERO: Self = Self {
        px: 0.0,
        percent: 0.0,
    };

    pub const fn px(value: f32) -> Self {
        Self {
            px: value,
            percent: 0.0,
        }
    }

    pub const fn percent(value: f32) -> Self {
        Self {
            px: 0.0,
            percent: value,
        }
    }

    /// True when the value needs no percentage basis.
    pub fn is_absolute(self) -> bool {
        self.percent == 0.0
    }

    /// Resolves against a basis, which is the size the percentage refers to.
    pub fn resolve(self, basis_px: f32) -> f32 {
        self.px + self.percent / 100.0 * basis_px
    }
}

/// Font sizes a relative unit needs. `rem` is relative to the root, `em` to
/// the element.
#[derive(Debug, Clone, Copy)]
pub struct LengthContext {
    pub root_font_size_px: f32,
    pub font_size_px: f32,
}

impl Default for LengthContext {
    /// The browser default the recorded values were authored against.
    fn default() -> Self {
        Self {
            root_font_size_px: 16.0,
            font_size_px: 16.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LengthError {
    /// A unit or function this module does not implement.
    Unsupported(String),
    /// The form was recognised but its contents did not parse.
    Malformed(String),
    /// `min`/`max` compared values whose order depends on a percentage basis.
    NeedsBasis(String),
    /// Multiplication or division that is not by a unitless number.
    InvalidArithmetic(String),
}

/// Evaluates one value. Any `var()` must already have been substituted.
pub fn evaluate(value: &str, context: LengthContext) -> Result<Dimension, LengthError> {
    let text = value.trim();
    let mut parser = Parser {
        input: text,
        position: 0,
        original: text,
        context,
    };
    let result = parser.expression()?;
    parser.skip_whitespace();
    if parser.position != parser.input.len() {
        return Err(LengthError::Malformed(text.to_string()));
    }
    match result {
        Value::Length(dimension) => Ok(dimension),
        // CSS accepts a unitless zero only as a bare length token. Inside
        // calc()/min()/max(), zero retains number type just like any other
        // number, so checking the original top-level syntax is necessary.
        Value::Number(number)
            if number == 0.0 && text.parse::<f32>().is_ok_and(|literal| literal == 0.0) =>
        {
            Ok(Dimension::ZERO)
        }
        Value::Number(_) => Err(LengthError::Unsupported(text.to_string())),
    }
}

/// Whether a value is shaped like a length, so a caller can tell a keyword
/// such as `flex` apart from something this module is expected to handle.
pub fn looks_like_length(value: &str) -> bool {
    let text = value.trim();
    if text.starts_with("calc(") || text.starts_with("min(") || text.starts_with("max(") {
        return true;
    }
    let mut chars = text.chars();
    let first = match chars.next() {
        Some(c) => c,
        None => return false,
    };
    if !(first.is_ascii_digit() || first == '-' || first == '.') {
        return false;
    }
    // A bare number is only a length when it is zero; `700` is a font weight.
    let digits_end = text
        .find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-'))
        .unwrap_or(text.len());
    let unit = &text[digits_end..];
    if unit.is_empty() {
        return text.parse::<f32>().is_ok_and(|number| number == 0.0);
    }
    matches!(unit, "px" | "rem" | "em" | "%")
}

/// A bare number and a length are different things: `calc(2px * 3)` is a
/// length while `calc(2px * 3px)` is not, and only tracking the unit keeps
/// those apart.
#[derive(Debug, Clone, Copy)]
enum Value {
    Number(f32),
    Length(Dimension),
}

struct Parser<'a> {
    input: &'a str,
    position: usize,
    original: &'a str,
    context: LengthContext,
}

impl<'a> Parser<'a> {
    fn malformed(&self) -> LengthError {
        LengthError::Malformed(self.original.to_string())
    }

    fn invalid(&self) -> LengthError {
        LengthError::InvalidArithmetic(self.original.to_string())
    }

    fn skip_whitespace(&mut self) -> bool {
        let start = self.position;
        while self.input[self.position..].starts_with(char::is_whitespace) {
            self.position += 1;
        }
        self.position != start
    }

    fn rest(&self) -> &'a str {
        &self.input[self.position..]
    }

    fn eat(&mut self, token: &str) -> bool {
        self.skip_whitespace();
        if self.rest().starts_with(token) {
            self.position += token.len();
            return true;
        }
        false
    }

    fn expression(&mut self) -> Result<Value, LengthError> {
        let mut left = self.term()?;
        loop {
            let has_space_before = self.skip_whitespace();
            let operator = if has_space_before
                && self.rest().starts_with('+')
                && self.rest()[1..].starts_with(char::is_whitespace)
            {
                '+'
            } else if has_space_before
                && self.rest().starts_with('-')
                && self.rest()[1..].starts_with(char::is_whitespace)
            {
                '-'
            } else {
                break;
            };
            self.position += 1;
            self.skip_whitespace();
            let right = self.term()?;
            let sign = if operator == '+' { 1.0 } else { -1.0 };
            left = match (left, right) {
                (Value::Number(a), Value::Number(b)) => Value::Number(a + sign * b),
                (Value::Length(a), Value::Length(b)) => Value::Length(Dimension {
                    px: a.px + sign * b.px,
                    percent: a.percent + sign * b.percent,
                }),
                // CSS `calc()` is typed: a `<number>` and a `<length>` do
                // not add, and a bare zero is no exception inside a sum. A
                // browser rejects `calc(0 + 4px)`, so accepting it here would
                // make this evaluator a different language from the one the
                // recorded values were authored in.
                _ => return Err(self.invalid()),
            };
        }
        Ok(left)
    }

    fn term(&mut self) -> Result<Value, LengthError> {
        let mut left = self.factor()?;
        loop {
            let before_whitespace = self.position;
            self.skip_whitespace();
            let operator = if self.rest().starts_with('*') {
                Some('*')
            } else if self.rest().starts_with('/') {
                Some('/')
            } else {
                None
            };
            let Some(operator) = operator else {
                // Leave whitespace before a lower-precedence + or - for the
                // expression parser, which must verify it precedes the token.
                self.position = before_whitespace;
                break;
            };
            self.position += 1;
            let right = self.factor()?;
            left = match (operator, left, right) {
                ('*', Value::Number(a), Value::Number(b)) => Value::Number(a * b),
                ('*', Value::Length(length), Value::Number(scalar))
                | ('*', Value::Number(scalar), Value::Length(length)) => {
                    Value::Length(scale(length, scalar))
                }
                ('/', Value::Number(a), Value::Number(b)) if b != 0.0 => Value::Number(a / b),
                ('/', Value::Length(length), Value::Number(scalar)) if scalar != 0.0 => {
                    Value::Length(scale(length, 1.0 / scalar))
                }
                _ => return Err(self.invalid()),
            };
        }
        Ok(left)
    }

    fn factor(&mut self) -> Result<Value, LengthError> {
        self.skip_whitespace();
        for name in ["calc", "min", "max"] {
            if self.rest().starts_with(name) && self.rest()[name.len()..].starts_with('(') {
                self.position += name.len() + 1;
                return self.function(name);
            }
        }
        if self.eat("(") {
            let inner = self.expression()?;
            if !self.eat(")") {
                return Err(self.malformed());
            }
            return Ok(inner);
        }
        self.number()
    }

    fn function(&mut self, name: &str) -> Result<Value, LengthError> {
        let mut arguments = vec![self.expression()?];
        while self.eat(",") {
            arguments.push(self.expression()?);
        }
        if !self.eat(")") {
            return Err(self.malformed());
        }
        if name == "calc" {
            if arguments.len() != 1 {
                return Err(self.malformed());
            }
            return Ok(arguments[0]);
        }

        let pick = if name == "min" { f32::min } else { f32::max };
        if arguments
            .iter()
            .all(|value| matches!(value, Value::Number(_)))
        {
            let numbers: Vec<f32> = arguments
                .iter()
                .map(|value| match value {
                    Value::Number(n) => *n,
                    Value::Length(_) => unreachable!(),
                })
                .collect();
            return Ok(Value::Number(
                numbers.iter().copied().fold(numbers[0], pick),
            ));
        }

        let mut lengths = Vec::with_capacity(arguments.len());
        for value in &arguments {
            match value {
                Value::Length(dimension) if dimension.is_absolute() => lengths.push(dimension.px),
                // Comparing a percentage against a pixel value has no answer
                // without the basis, so it is reported rather than guessed.
                Value::Length(_) => return Err(LengthError::NeedsBasis(self.original.to_string())),
                Value::Number(_) => return Err(self.invalid()),
            }
        }
        Ok(Value::Length(Dimension::px(
            lengths.iter().copied().fold(lengths[0], pick),
        )))
    }

    fn number(&mut self) -> Result<Value, LengthError> {
        self.skip_whitespace();
        let rest = self.rest();
        let mut end = 0;
        let bytes = rest.as_bytes();
        if end < bytes.len() && (bytes[end] == b'-' || bytes[end] == b'+') {
            end += 1;
        }
        while end < bytes.len() && (bytes[end].is_ascii_digit() || bytes[end] == b'.') {
            end += 1;
        }
        if end == 0 || rest[..end].chars().all(|c| !c.is_ascii_digit()) {
            return Err(self.malformed());
        }
        let magnitude: f32 = rest[..end].parse().map_err(|_| self.malformed())?;

        let unit_end = rest[end..]
            .find(|c: char| !c.is_ascii_alphabetic() && c != '%')
            .map(|offset| end + offset)
            .unwrap_or(rest.len());
        let unit = &rest[end..unit_end];
        self.position += unit_end;

        match unit {
            "" => Ok(Value::Number(magnitude)),
            "px" => Ok(Value::Length(Dimension::px(magnitude))),
            "rem" => Ok(Value::Length(Dimension::px(
                magnitude * self.context.root_font_size_px,
            ))),
            "em" => Ok(Value::Length(Dimension::px(
                magnitude * self.context.font_size_px,
            ))),
            "%" => Ok(Value::Length(Dimension::percent(magnitude))),
            other => Err(LengthError::Unsupported(other.to_string())),
        }
    }
}

fn scale(length: Dimension, scalar: f32) -> Dimension {
    Dimension {
        px: length.px * scalar,
        percent: length.percent * scalar,
    }
}
