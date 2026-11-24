// Compiler-time Rust AST construction. No source snippets or quote/parse_quote
// templates enter this builder, and no HIR evaluator is emitted.
use proc_macro2::{Ident, Span};
use serde_json::{json, Value as Json};
use std::io::{self, Read};
use syn::punctuated::Punctuated;
use syn::*;

type Result<T> = std::result::Result<T, String>;
fn ident(name: &str) -> Ident {
    Ident::new(name, Span::call_site())
}
fn text<'a>(v: &'a Json, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Json::as_str)
        .ok_or_else(|| "Missing string: ".to_owned() + key)
}
fn list<'a>(v: &'a Json, key: &str) -> Result<&'a Vec<Json>> {
    v.get(key)
        .and_then(Json::as_array)
        .ok_or_else(|| "Missing array: ".to_owned() + key)
}
fn punct<T, P: Default>(values: impl IntoIterator<Item = T>) -> Punctuated<T, P> {
    values.into_iter().collect()
}
fn path(name: &str) -> Path {
    Path {
        leading_colon: None,
        segments: punct(name.split("::").map(|part| PathSegment {
            ident: ident(part),
            arguments: PathArguments::None,
        })),
    }
}
fn ty(name: &str) -> Type {
    Type::Path(TypePath {
        qself: None,
        path: path(name),
    })
}
fn generic(name: &str, args: Vec<Type>) -> Type {
    let mut p = path(name);
    p.segments.last_mut().unwrap().arguments =
        PathArguments::AngleBracketed(AngleBracketedGenericArguments {
            colon2_token: None,
            lt_token: Default::default(),
            gt_token: Default::default(),
            args: punct(args.into_iter().map(GenericArgument::Type)),
        });
    Type::Path(TypePath {
        qself: None,
        path: p,
    })
}
fn reference_type(t: Type, mutable: bool) -> Type {
    Type::Reference(TypeReference {
        and_token: Default::default(),
        lifetime: None,
        mutability: mutable.then(Default::default),
        elem: Box::new(t),
    })
}
fn impl_trait(name: &str) -> Type {
    Type::ImplTrait(TypeImplTrait {
        impl_token: Default::default(),
        bounds: punct(vec![TypeParamBound::Trait(TraitBound {
            paren_token: None,
            modifier: TraitBoundModifier::None,
            lifetimes: None,
            path: path(name),
        })]),
    })
}
fn name(value: &str) -> Expr {
    Expr::Path(ExprPath {
        attrs: vec![],
        qself: None,
        path: path(value),
    })
}
fn literal(lit: Lit) -> Expr {
    Expr::Lit(ExprLit { attrs: vec![], lit })
}
fn string(value: &str) -> Expr {
    literal(Lit::Str(LitStr::new(value, Span::call_site())))
}
fn boolean(value: bool) -> Expr {
    literal(Lit::Bool(LitBool::new(value, Span::call_site())))
}
fn float(value: f64) -> Expr {
    if value.is_nan() {
        return name("f64::NAN");
    }
    if value == f64::INFINITY {
        return name("f64::INFINITY");
    }
    if value == f64::NEG_INFINITY {
        return name("f64::NEG_INFINITY");
    }
    let positive = literal(Lit::Float(LitFloat::new(
        &(value.abs().to_string() + "f64"),
        Span::call_site(),
    )));
    if value.is_sign_negative() {
        unary("-", positive)
    } else {
        positive
    }
}
fn call(function: Expr, args: Vec<Expr>) -> Expr {
    Expr::Call(ExprCall {
        attrs: vec![],
        func: Box::new(function),
        paren_token: Default::default(),
        args: punct(args),
    })
}
fn method(receiver: Expr, method: &str, args: Vec<Expr>) -> Expr {
    Expr::MethodCall(ExprMethodCall {
        attrs: vec![],
        receiver: Box::new(receiver),
        dot_token: Default::default(),
        method: ident(method),
        turbofish: None,
        paren_token: Default::default(),
        args: punct(args),
    })
}
fn member(receiver: Expr, field: &str) -> Expr {
    Expr::Field(ExprField {
        attrs: vec![],
        base: Box::new(receiver),
        dot_token: Default::default(),
        member: Member::Named(ident(field)),
    })
}
fn borrow(expr: Expr) -> Expr {
    Expr::Reference(ExprReference {
        attrs: vec![],
        and_token: Default::default(),
        mutability: None,
        expr: Box::new(expr),
    })
}
fn unary(operator: &str, operand: Expr) -> Expr {
    if operator == "+" {
        return operand;
    }
    Expr::Unary(ExprUnary {
        attrs: vec![],
        op: if operator == "!" {
            UnOp::Not(Default::default())
        } else {
            UnOp::Neg(Default::default())
        },
        expr: Box::new(operand),
    })
}
fn binary(operator: &str, left: Expr, right: Expr) -> Result<Expr> {
    let op = match operator {
        "+" => BinOp::Add(Default::default()),
        "-" => BinOp::Sub(Default::default()),
        "*" => BinOp::Mul(Default::default()),
        "/" => BinOp::Div(Default::default()),
        "%" => BinOp::Rem(Default::default()),
        "===" => BinOp::Eq(Default::default()),
        "!==" => BinOp::Ne(Default::default()),
        "<" => BinOp::Lt(Default::default()),
        "<=" => BinOp::Le(Default::default()),
        ">" => BinOp::Gt(Default::default()),
        ">=" => BinOp::Ge(Default::default()),
        "&&" => BinOp::And(Default::default()),
        "||" => BinOp::Or(Default::default()),
        _ => return Err("Unsupported scalar operator: ".to_owned() + operator),
    };
    Ok(Expr::Binary(ExprBinary {
        attrs: vec![],
        left: Box::new(left),
        op,
        right: Box::new(right),
    }))
}
fn assign(left: Expr, right: Expr) -> Expr {
    Expr::Assign(ExprAssign {
        attrs: vec![],
        left: Box::new(left),
        eq_token: Default::default(),
        right: Box::new(right),
    })
}
fn block(stmts: Vec<Stmt>) -> Block {
    Block {
        brace_token: Default::default(),
        stmts,
    }
}
fn block_expr(stmts: Vec<Stmt>) -> Expr {
    Expr::Block(ExprBlock {
        attrs: vec![],
        label: None,
        block: block(stmts),
    })
}
fn statement(expr: Expr) -> Stmt {
    Stmt::Expr(expr, Some(Default::default()))
}
fn tail(expr: Expr) -> Stmt {
    Stmt::Expr(expr, None)
}
fn pattern(name: &str, mutable: bool) -> Pat {
    Pat::Ident(PatIdent {
        attrs: vec![],
        by_ref: None,
        mutability: mutable.then(Default::default),
        ident: ident(name),
        subpat: None,
    })
}
fn local(name: &str, value: Expr, mutable: bool) -> Stmt {
    Stmt::Local(Local {
        attrs: vec![],
        let_token: Default::default(),
        pat: pattern(name, mutable),
        init: Some(LocalInit {
            eq_token: Default::default(),
            expr: Box::new(value),
            diverge: None,
        }),
        semi_token: Default::default(),
    })
}
fn unit() -> Expr {
    Expr::Tuple(ExprTuple {
        attrs: vec![],
        paren_token: Default::default(),
        elems: Punctuated::new(),
    })
}
fn ok_unit() -> Expr {
    call(name("Ok"), vec![unit()])
}
fn return_expr(value: Expr) -> Expr {
    Expr::Return(ExprReturn {
        attrs: vec![],
        return_token: Default::default(),
        expr: Some(Box::new(value)),
    })
}
fn conditional(condition: Expr, yes: Vec<Stmt>, no: Option<Vec<Stmt>>) -> Expr {
    Expr::If(ExprIf {
        attrs: vec![],
        if_token: Default::default(),
        cond: Box::new(condition),
        then_branch: block(yes),
        else_branch: no.map(|stmts| (Default::default(), Box::new(block_expr(stmts)))),
    })
}
fn some(value: Expr) -> Expr {
    call(name("Some"), vec![value])
}
fn cloned(value: Expr) -> Expr {
    method(value, "clone", vec![])
}
fn if_some(variable: &str, value: Expr, yes: Vec<Stmt>, no: Vec<Stmt>) -> Expr {
    let pat = Pat::TupleStruct(PatTupleStruct {
        attrs: vec![],
        qself: None,
        path: path("Some"),
        paren_token: Default::default(),
        elems: punct(vec![pattern(variable, false)]),
    });
    conditional(
        Expr::Let(ExprLet {
            attrs: vec![],
            let_token: Default::default(),
            pat: Box::new(pat),
            eq_token: Default::default(),
            expr: Box::new(value),
        }),
        yes,
        Some(no),
    )
}
fn try_expr(value: Expr) -> Expr {
    Expr::Try(ExprTry {
        attrs: vec![],
        expr: Box::new(value),
        question_token: Default::default(),
    })
}
fn closure(parameters: &[&str], statements: Vec<Stmt>) -> Expr {
    Expr::Closure(ExprClosure {
        attrs: vec![],
        lifetimes: None,
        constness: None,
        movability: None,
        asyncness: None,
        capture: None,
        or1_token: Default::default(),
        inputs: punct(parameters.iter().map(|p| pattern(p, false))),
        or2_token: Default::default(),
        output: ReturnType::Default,
        body: Box::new(block_expr(statements)),
    })
}
fn field_name(prefix: &str, source: &str) -> String {
    prefix.to_owned()
        + &source
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect::<String>()
}
fn self_field(prefix: &str, source: &str) -> Expr {
    member(name("self"), &field_name(prefix, source))
}
fn scalar(v: &Json) -> Result<Expr> {
    if let Some(s) = v.as_str() {
        return Ok(method(string(s), "to_owned", vec![]));
    }
    if let Some(b) = v.as_bool() {
        return Ok(boolean(b));
    }
    if let Some(n) = v.as_f64() {
        return Ok(float(n));
    }
    match v.get("$number").and_then(Json::as_str) {
        Some("nan") => Ok(float(f64::NAN)),
        Some("+infinity") => Ok(float(f64::INFINITY)),
        Some("-infinity") => Ok(float(f64::NEG_INFINITY)),
        Some("-zero") => Ok(float(-0.0)),
        _ => Err("Unsupported scalar literal.".to_owned()),
    }
}
fn value_type(decl: &Json) -> Result<&'static str> {
    match text(decl, "kind")? {
        "bool" | "boolean" => Ok("bool"),
        "number" | "number.discrete" => Ok("f64"),
        "string" | "enum" => Ok("String"),
        _ => Err("Unsupported native scalar declaration.".to_owned()),
    }
}
fn expression(v: &Json) -> Result<Expr> {
    Ok(match text(v, "kind")? {
        "literal" => scalar(&v["value"])?,
        "state" => method(self_field("state_", text(v, "name")?), "clone", vec![]),
        "prop" => method(
            cloned(self_field("resolved_prop_", text(v, "name")?)),
            "expect",
            vec![string("Compiler proved a non-empty prop fallback")],
        ),
        "local" => method(
            name(&field_name("local_", text(v, "name")?)),
            "clone",
            vec![],
        ),
        "unary" => unary(text(v, "operator")?, expression(&v["operand"])?),
        "binary" => {
            let left = expression(&v["left"])?;
            let right = expression(&v["right"])?;
            let op = text(v, "operator")?;
            binary(
                op,
                left,
                if op == "+" && text(v, "valueType")? == "string" {
                    borrow(right)
                } else {
                    right
                },
            )?
        }
        "conditional" => conditional(
            expression(&v["condition"])?,
            vec![tail(expression(&v["then"])?)],
            Some(vec![tail(expression(&v["otherwise"])?)]),
        ),
        _ => return Err("Unknown value expression.".to_owned()),
    })
}
fn rule(v: &Json) -> Result<Expr> {
    Ok(match text(v, "kind")? {
        "true" => boolean(true),
        "false" => boolean(false),
        "not" => unary("!", rule(&v["expr"])?),
        "all" | "any" => {
            let all = text(v, "kind")? == "all";
            let mut result = boolean(all);
            for item in list(v, "exprs")? {
                result = binary(if all { "&&" } else { "||" }, result, rule(item)?)?;
            }
            result
        }
        "cmp" => {
            let key = text(v, "key")?;
            let comparison = |left: Expr| -> Result<Expr> {
                let right = scalar(&v["value"])?;
                if text(v, "operator")? == "eq" {
                    return binary("===", left, right);
                }
                binary(
                    "&&",
                    binary(
                        "&&",
                        method(left.clone(), "is_finite", vec![]),
                        method(right.clone(), "is_finite", vec![]),
                    )?,
                    binary(">=", left, right)?,
                )
            };
            match text(v, "source")? {
                "state" => comparison(self_field("state_", key))?,
                "prop" => method(
                    cloned(self_field("resolved_prop_", key)),
                    "is_some_and",
                    vec![closure(&["value"], vec![tail(comparison(name("value"))?)])],
                ),
                _ => return Err("Host meta rule has no native input.".to_owned()),
            }
        }
        _ => return Err("Unknown rule condition.".to_owned()),
    })
}
fn action_body(items: &[Json]) -> Result<Vec<Stmt>> {
    let mut statements = Vec::new();
    for item in items {
        statements.push(match text(item, "kind")? {
            "return" => statement(return_expr(ok_unit())),
            "local" => local(
                &field_name("local_", text(item, "name")?),
                expression(&item["value"])?,
                false,
            ),
            "state-set" => {
                let call = method(
                    name("self"),
                    &field_name("set_state_", text(item, "stateName")?),
                    vec![expression(&item["value"])?],
                );
                statement(Expr::Try(ExprTry {
                    attrs: vec![],
                    expr: Box::new(call),
                    question_token: Default::default(),
                }))
            }
            "if" => statement(conditional(
                expression(&item["condition"])?,
                action_body(list(item, "then")?)?,
                Some(action_body(list(item, "otherwise")?)?),
            )),
            _ => return Err("Unknown action statement.".to_owned()),
        });
    }
    Ok(statements)
}
fn parameter(name: &str, t: Type) -> FnArg {
    FnArg::Typed(PatType {
        attrs: vec![],
        pat: Box::new(pattern(name, false)),
        colon_token: Default::default(),
        ty: Box::new(t),
    })
}
fn receiver(mutable: bool) -> FnArg {
    FnArg::Receiver(Receiver {
        attrs: vec![],
        reference: Some((Default::default(), None)),
        mutability: mutable.then(Default::default),
        self_token: Default::default(),
        colon_token: None,
        ty: Box::new(reference_type(ty("Self"), mutable)),
    })
}
fn function(
    name: &str,
    params: Vec<FnArg>,
    output: Type,
    statements: Vec<Stmt>,
    public: bool,
) -> ImplItem {
    ImplItem::Fn(ImplItemFn {
        attrs: vec![],
        vis: if public {
            Visibility::Public(Default::default())
        } else {
            Visibility::Inherited
        },
        defaultness: None,
        sig: Signature {
            constness: None,
            asyncness: None,
            unsafety: None,
            abi: None,
            fn_token: Default::default(),
            ident: ident(name),
            generics: Generics::default(),
            paren_token: Default::default(),
            inputs: punct(params),
            variadic: None,
            output: ReturnType::Type(Default::default(), Box::new(output)),
        },
        block: block(statements),
    })
}
fn implementation(name: &str, trait_name: Option<&str>, items: Vec<ImplItem>) -> Item {
    Item::Impl(ItemImpl {
        attrs: vec![],
        defaultness: None,
        unsafety: None,
        impl_token: Default::default(),
        generics: Generics::default(),
        trait_: trait_name.map(|t| (None, path(t), Default::default())),
        self_ty: Box::new(ty(name)),
        brace_token: Default::default(),
        items,
    })
}
fn structure(name: &str, fields: Vec<(String, Type, bool)>) -> Item {
    Item::Struct(ItemStruct {
        attrs: vec![],
        vis: Visibility::Public(Default::default()),
        struct_token: Default::default(),
        ident: ident(name),
        generics: Generics::default(),
        fields: Fields::Named(FieldsNamed {
            brace_token: Default::default(),
            named: punct(fields.into_iter().map(|(name, t, public)| Field {
                attrs: vec![],
                vis: if public {
                    Visibility::Public(Default::default())
                } else {
                    Visibility::Inherited
                },
                mutability: FieldMutability::None,
                ident: Some(ident(&name)),
                colon_token: Some(Default::default()),
                ty: t,
            })),
        }),
        semi_token: None,
    })
}
fn construct(name: &str, fields: Vec<(String, Expr)>) -> Expr {
    Expr::Struct(ExprStruct {
        attrs: vec![],
        qself: None,
        path: path(name),
        brace_token: Default::default(),
        fields: punct(fields.into_iter().map(|(name, expr)| FieldValue {
            attrs: vec![],
            member: Member::Named(ident(&name)),
            colon_token: Some(Default::default()),
            expr,
        })),
        dot2_token: None,
        rest: None,
    })
}
fn native_styles(mut node: Expr, styles: &[Json]) -> Result<Expr> {
    for style in styles {
        let args = if let Some(color) = style.get("color").and_then(Json::as_u64) {
            vec![call(
                name("gpui::rgb"),
                vec![literal(Lit::Int(LitInt::new(
                    &color.to_string(),
                    Span::call_site(),
                )))],
            )]
        } else if let Some(weight) = style.get("weight").and_then(Json::as_str) {
            vec![name(&("gpui::FontWeight::".to_owned() + weight))]
        } else {
            vec![]
        };
        node = method(node, text(style, "method")?, args);
    }
    Ok(node)
}
fn declaration<'a>(plan: &'a Json, collection: &str, name: &str) -> Result<&'a Json> {
    list(plan, collection)?
        .iter()
        .find(|p| p["name"].as_str() == Some(name))
        .ok_or_else(|| "Undeclared native field: ".to_owned() + name)
}
fn display_value(v: Expr, rust_type: &str) -> Expr {
    if rust_type == "f64" {
        method(
            method(call(name("ryu_js::Buffer::new"), vec![]), "format", vec![v]),
            "to_owned",
            vec![],
        )
    } else if rust_type == "String" {
        method(v, "clone", vec![])
    } else {
        call(name("String::new"), vec![])
    }
}
fn element(node: &Json, plan: &Json) -> Result<Expr> {
    let mut result = native_styles(call(name("gpui::div"), vec![]), list(node, "styles")?)?;
    for child in list(node, "children")? {
        let child_expr = match text(child, "kind")? {
            "text" => method(string(text(child, "value")?), "to_owned", vec![]),
            "element" => element(&child["node"], plan)?,
            "state-read" => {
                let key = text(child, "stateName")?;
                let rust_type = value_type(declaration(plan, "states", key)?)?;
                if rust_type == "bool" {
                    return Err("Boolean state is not a template child.".to_owned());
                }
                display_value(self_field("state_", key), rust_type)
            }
            "prop-read" => {
                let key = text(child, "propName")?;
                let rust_type = value_type(declaration(plan, "props", key)?)?;
                if rust_type == "bool" {
                    return Err("Boolean prop is not a template child.".to_owned());
                }
                method(
                    cloned(self_field("resolved_prop_", key)),
                    "map_or_else",
                    vec![
                        name("String::new"),
                        closure(
                            &["value"],
                            vec![tail(display_value(name("value"), rust_type))],
                        ),
                    ],
                )
            }
            _ => return Err("Unsupported native child.".to_owned()),
        };
        result = method(result, "child", vec![child_expr]);
    }
    Ok(result)
}
fn validity(decl: &Json, candidate: Expr, state: bool) -> Result<Expr> {
    let kind = text(decl, "kind")?;
    let mut valid = boolean(true);
    if kind == "number" || kind == "number.discrete" {
        valid = if state {
            unary("!", method(candidate.clone(), "is_nan", vec![]))
        } else {
            method(candidate.clone(), "is_finite", vec![])
        };
    }
    if let Some(options) = decl
        .get("options")
        .and_then(Json::as_array)
        .filter(|v| !v.is_empty())
    {
        let mut allowed = boolean(false);
        for option in options {
            allowed = binary(
                "||",
                allowed,
                binary("===", candidate.clone(), scalar(option)?)?,
            )?;
        }
        valid = binary("&&", valid, allowed)?;
        if state {
            return Ok(valid);
        }
    }
    if kind == "number" || kind == "number.discrete" {
        let range = if state { decl } else { &decl["range"] };
        if let Some(min) = range.get("min") {
            valid = binary(
                "&&",
                valid,
                unary("!", binary("<", candidate.clone(), scalar(min)?)?),
            )?;
        }
        if let Some(max) = range.get("max") {
            valid = binary(
                "&&",
                valid,
                unary("!", binary(">", candidate.clone(), scalar(max)?)?),
            )?;
        }
    }
    Ok(valid)
}
fn validation(decl: &Json, candidate: Expr, state: bool) -> Result<Vec<Stmt>> {
    let valid = validity(decl, candidate, state)?;
    Ok(vec![statement(conditional(
        unary("!", valid),
        vec![statement(return_expr(call(
            name("Err"),
            vec![method(
                string(&("Invalid native value for ".to_owned() + text(decl, "name")?)),
                "to_owned",
                vec![],
            )],
        )))],
        None,
    ))])
}
fn prop_resolution(decl: &Json) -> Result<Stmt> {
    let key = text(decl, "name")?;
    let default_value = if decl["resolvedDefault"].is_null() {
        name("None")
    } else {
        some(scalar(&decl["resolvedDefault"])?)
    };
    let previous = self_field("previous_prop_", key);
    let fallback = || -> Vec<Stmt> {
        vec![
            local(
                "fallback",
                method(cloned(previous.clone()), "or", vec![default_value.clone()]),
                false,
            ),
            statement(assign(previous.clone(), cloned(name("fallback")))),
            tail(name("fallback")),
        ]
    };
    let accepted = vec![
        statement(assign(previous.clone(), some(cloned(name("value"))))),
        tail(some(name("value"))),
    ];
    let provided = if_some(
        "value",
        name("raw"),
        vec![tail(conditional(
            validity(decl, name("value"), false)?,
            accepted,
            Some(fallback()),
        ))],
        if decl["empty"] == "accept" {
            vec![tail(name("None"))]
        } else {
            fallback()
        },
    );
    let resolved = if_some(
        "raw",
        cloned(member(
            member(name("self"), "props"),
            &field_name("prop_", key),
        )),
        vec![tail(provided)],
        vec![tail(default_value)],
    );
    Ok(local(&field_name("resolved_", key), resolved, false))
}
fn result_type(inner: Type) -> Type {
    generic("Result", vec![inner, ty("String")])
}
fn unit_type() -> Type {
    Type::Tuple(TypeTuple {
        paren_token: Default::default(),
        elems: Punctuated::new(),
    })
}
fn build(plan: &Json) -> Result<File> {
    if plan["protocolVersion"] != 1 {
        return Err("Unsupported Rust builder protocol.".to_owned());
    }
    let component = text(plan, "componentName")?;
    let props_name = text(plan, "propsTypeName")?;
    let mut items = vec![Item::Use(ItemUse {
        attrs: vec![],
        vis: Visibility::Inherited,
        use_token: Default::default(),
        leading_colon: None,
        tree: UseTree::Path(UsePath {
            ident: ident("gpui"),
            colon2_token: Default::default(),
            tree: Box::new(UseTree::Path(UsePath {
                ident: ident("prelude"),
                colon2_token: Default::default(),
                tree: Box::new(UseTree::Glob(UseGlob {
                    star_token: Default::default(),
                })),
            })),
        }),
        semi_token: Default::default(),
    })];
    let mut props_fields = Vec::new();
    let mut props_defaults = Vec::new();
    for prop in list(plan, "props")? {
        let field = field_name("prop_", text(prop, "name")?);
        props_fields.push((
            field.clone(),
            generic(
                "Option",
                vec![generic("Option", vec![ty(value_type(prop)?)])],
            ),
            true,
        ));
        props_defaults.push((field, name("None")));
    }
    items.push(structure(props_name, props_fields));
    items.push(implementation(
        props_name,
        Some("Default"),
        vec![function(
            "default",
            vec![],
            ty("Self"),
            vec![tail(construct("Self", props_defaults))],
            false,
        )],
    ));
    let mut fields = vec![
        ("props".to_owned(), ty(props_name), false),
        (
            "last_error".to_owned(),
            generic("Option", vec![ty("String")]),
            false,
        ),
    ];
    let mut initial = vec![
        (
            "props".to_owned(),
            call(name(&(props_name.to_owned() + "::default")), vec![]),
        ),
        ("last_error".to_owned(), name("None")),
    ];
    let mut methods = Vec::new();
    let mut props_update = vec![statement(assign(
        member(name("self"), "props"),
        name("props"),
    ))];
    let mut resolved_commits = Vec::new();
    for prop in list(plan, "props")? {
        let key = text(prop, "name")?;
        let rust_type = generic("Option", vec![ty(value_type(prop)?)]);
        for prefix in ["resolved_prop_", "previous_prop_"] {
            let field = field_name(prefix, key);
            fields.push((field.clone(), rust_type.clone(), false));
            initial.push((field, name("None")));
        }
        props_update.push(prop_resolution(prop)?);
        let resolved = name(&field_name("resolved_", key));
        if prop["empty"] == "error" {
            props_update.push(statement(conditional(
                method(resolved.clone(), "is_none", vec![]),
                vec![statement(return_expr(call(
                    name("Err"),
                    vec![method(
                        string(&("Prop has no non-empty fallback: ".to_owned() + key)),
                        "to_owned",
                        vec![],
                    )],
                )))],
                None,
            )));
        }
        resolved_commits.push(statement(assign(
            self_field("resolved_prop_", key),
            resolved,
        )));
        methods.push(function(
            &field_name("read_prop_", key),
            vec![receiver(false)],
            rust_type,
            vec![tail(cloned(self_field("resolved_prop_", key)))],
            true,
        ));
    }
    props_update.extend(resolved_commits);
    props_update.push(tail(ok_unit()));
    for state in list(plan, "states")? {
        let key = text(state, "name")?;
        let field = field_name("state_", key);
        let rust_type = value_type(state)?;
        fields.push((field.clone(), ty(rust_type), false));
        initial.push((field, scalar(&state["initialValue"])?));
        methods.push(function(
            &field_name("read_state_", key),
            vec![receiver(false)],
            ty(rust_type),
            vec![tail(method(self_field("state_", key), "clone", vec![]))],
            true,
        ));
        let mut setter = validation(state, name("value"), true)?;
        setter.push(statement(assign(self_field("state_", key), name("value"))));
        setter.push(tail(ok_unit()));
        methods.push(function(
            &field_name("set_state_", key),
            vec![receiver(true), parameter("value", ty(rust_type))],
            result_type(unit_type()),
            setter,
            false,
        ));
    }
    items.push(structure(component, fields));
    let ctor = vec![
        local("component", construct("Self", initial), true),
        statement(try_expr(method(
            name("component"),
            "update_props",
            vec![name("props")],
        ))),
        tail(call(name("Ok"), vec![name("component")])),
    ];
    methods.push(function(
        "new",
        vec![parameter("props", ty(props_name))],
        result_type(ty("Self")),
        ctor,
        true,
    ));
    methods.push(function(
        "update_props",
        vec![receiver(true), parameter("props", ty(props_name))],
        result_type(unit_type()),
        props_update,
        true,
    ));
    methods.push(function(
        "set_props",
        vec![
            receiver(true),
            parameter("props", ty(props_name)),
            parameter(
                "cx",
                reference_type(generic("gpui::Context", vec![ty("Self")]), true),
            ),
        ],
        result_type(unit_type()),
        vec![
            statement(try_expr(method(
                name("self"),
                "update_props",
                vec![name("props")],
            ))),
            statement(method(name("cx"), "notify", vec![])),
            tail(ok_unit()),
        ],
        true,
    ));
    methods.push(function(
        "take_error",
        vec![receiver(true)],
        generic("Option", vec![ty("String")]),
        vec![tail(method(
            member(name("self"), "last_error"),
            "take",
            vec![],
        ))],
        true,
    ));
    for event in list(plan, "events")? {
        let mut body = action_body(list(event, "body")?)?;
        body.push(tail(ok_unit()));
        methods.push(function(
            text(event, "method")?,
            vec![receiver(true)],
            result_type(unit_type()),
            body,
            true,
        ));
    }
    items.push(implementation(component, None, methods));

    let root_id = Expr::Tuple(ExprTuple {
        attrs: vec![],
        paren_token: Default::default(),
        elems: punct(vec![
            string("proto-root"),
            method(name("cx"), "entity_id", vec![]),
        ]),
    });
    let mut root = method(element(&plan["root"], plan)?, "id", vec![root_id]);
    root = native_styles(root, list(plan, "styles")?)?;
    if !list(plan, "events")?.is_empty() {
        let mut ordered_handlers = Vec::new();
        for event in list(plan, "events")? {
            ordered_handlers.push(statement(try_expr(method(
                name("this"),
                text(event, "method")?,
                vec![],
            ))));
        }
        ordered_handlers.push(tail(ok_unit()));
        let error_pattern = Pat::TupleStruct(PatTupleStruct {
            attrs: vec![],
            qself: None,
            path: path("Err"),
            paren_token: Default::default(),
            elems: punct(vec![pattern("error", false)]),
        });
        let failed = Expr::Let(ExprLet {
            attrs: vec![],
            let_token: Default::default(),
            pat: Box::new(error_pattern),
            eq_token: Default::default(),
            expr: Box::new(call(closure(&[], ordered_handlers), vec![])),
        });
        let listener = closure(
            &["this", "_event", "_window", "cx"],
            vec![
                statement(conditional(
                    failed,
                    vec![statement(assign(
                        member(name("this"), "last_error"),
                        call(name("Some"), vec![name("error")]),
                    ))],
                    None,
                )),
                statement(method(name("cx"), "notify", vec![])),
            ],
        );
        root = method(
            root,
            "on_click",
            vec![method(name("cx"), "listener", vec![listener])],
        );
    }
    let mut render = vec![local("root", root, !list(plan, "rules")?.is_empty())];
    for item in list(plan, "rules")? {
        render.push(statement(conditional(
            rule(&item["condition"])?,
            vec![statement(assign(
                name("root"),
                native_styles(name("root"), list(item, "styles")?)?,
            ))],
            None,
        )));
    }
    render.push(tail(method(name("root"), "into_any_element", vec![])));
    items.push(implementation(
        component,
        Some("gpui::Render"),
        vec![function(
            "render",
            vec![
                receiver(true),
                parameter("_window", reference_type(ty("gpui::Window"), true)),
                parameter(
                    "cx",
                    reference_type(generic("gpui::Context", vec![ty("Self")]), true),
                ),
            ],
            impl_trait("gpui::IntoElement"),
            render,
            false,
        )],
    ));
    Ok(File {
        shebang: None,
        attrs: vec![],
        items,
    })
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{}", error);
        std::process::exit(1);
    }
}
fn run() -> Result<()> {
    let mut source = String::new();
    io::stdin()
        .read_to_string(&mut source)
        .map_err(|e| e.to_string())?;
    let plan: Json = serde_json::from_str(&source).map_err(|e| e.to_string())?;
    let ast = build(&plan)?;
    let component = text(&plan, "componentName")?;
    let mut manifest = json!({
        "package": { "name": "compiled-".to_owned() + &component.to_ascii_lowercase(),
            "version": "0.0.0", "edition": "2021", "publish": false },
        "lib": { "path": "src/lib.rs" },
        "dependencies": { "gpui": if plan["workspaceDependency"] == true { json!({"workspace":true}) }
            else { json!({"git":plan["dependency"]["git"],"rev":plan["dependency"]["revision"]}) },
            "ryu-js": "=1.0.3" }
    });
    if plan["workspaceDependency"] != true {
        manifest["workspace"] = json!({});
    }
    let response = json!({
        "componentName": component, "propsTypeName": text(&plan, "propsTypeName")?,
        "code": prettyplease::unparse(&ast),
        "cargoToml": toml::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
    });
    println!(
        "{}",
        serde_json::to_string(&response).map_err(|e| e.to_string())?
    );
    Ok(())
}
