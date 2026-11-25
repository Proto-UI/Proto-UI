mod behavior;
mod check;
mod component;
mod ir;
mod names;
mod wire_error;

use std::io::{self, Read, Write};
use std::process::ExitCode;

fn compile(input: &[u8]) -> Result<String, String> {
    let program: ir::Component = serde_json::from_slice(input)
        .map_err(|error| wire_error::diagnostic(input, error))?;
    let checked = check::Checked::new(&program)?;
    let ast = component::generate(&checked)?;
    Ok(prettyplease::unparse(&ast))
}

fn run() -> Result<(), String> {
    let mut input = Vec::new();
    io::stdin().lock().read_to_end(&mut input).map_err(|e| format!("reading GPUI compiler input: {e}"))?;
    let output = compile(&input)?;
    io::stdout().lock().write_all(output.as_bytes()).map_err(|e| format!("writing generated Rust: {e}"))
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
