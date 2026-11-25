mod behavior;
mod check;
mod component;
mod context;
mod externs;
mod ir;
mod names;
mod native_data;
mod view;
mod wire_error;

use std::io::{self, Read, Write};
use std::process::ExitCode;

fn compile(input: &[u8], registrations: &std::collections::BTreeMap<String, String>) -> Result<String, String> {
    let program: ir::Unit = serde_json::from_slice(input)
        .map_err(|error| wire_error::diagnostic(input, error))?;
    let links = check::Links::new(&program)?;
    let bodies = (0..program.bodies.len()).map(|i| check::Checked::new(&program, &links, i))
        .collect::<Result<Vec<_>, _>>()?;
    let (reached, natives) = externs::bindings(&bodies, registrations)?;
    let mut ast = syn::File { shebang: None, attrs: Vec::new(), items: Vec::new() };
    if links.scoped {
        names::check_linked_names(&bodies)?;
        ast.items.extend(context::scope(&bodies[0])?);
    }
    for body in &bodies {
        ast.items.extend(component::generate(body)?.items);
    }
    ast.items.extend(native_data::aliases(&bodies, &reached)?);
    if links.scoped { ast = context::publish(&bodies[0], ast.items)?; }
    ast.items.extend(natives);
    Ok(prettyplease::unparse(&ast))
}

fn run() -> Result<(), String> {
    let registrations = externs::arguments(std::env::args_os().skip(1))?;
    let mut input = Vec::new();
    io::stdin().lock().read_to_end(&mut input).map_err(|e| format!("reading GPUI compiler input: {e}"))?;
    let output = compile(&input, &registrations)?;
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
