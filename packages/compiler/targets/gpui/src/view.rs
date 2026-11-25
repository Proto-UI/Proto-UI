use crate::check::Checked;
use crate::ir::{Tag, View};
use crate::names::{self, Names};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};

pub fn render(
    checked: &Checked<'_>, names: &Names, pure: impl Fn(&str, TokenStream) -> TokenStream,
) -> TokenStream {
    let mut tree = Tree { checked, names, pure, next_node: 0, next_child: 0, texts: Vec::new() };
    let mut label = Vec::new();
    let root = tree.node(&checked.ir.view, false, &mut label);
    let texts = tree.texts;
    let owner = &names.component;
    quote! {
        impl ::gpui::Render for #owner {
            #[allow(unused_variables, unused_mut, unused_imports)]
            fn render(&mut self, _window: &mut ::gpui::Window, cx: &mut ::gpui::Context<Self>) -> impl ::gpui::IntoElement {
                use ::gpui::{ParentElement as _, Styled as _, InteractiveElement as _, StatefulInteractiveElement as _};
                #(#texts)*
                #root
            }
        }
    }
}

struct Tree<'c, 'ir, F> {
    checked: &'c Checked<'ir>,
    names: &'c Names,
    pure: F,
    next_node: usize,
    next_child: usize,
    texts: Vec<TokenStream>,
}

impl<F: Fn(&str, TokenStream) -> TokenStream> Tree<'_, '_, F> {
    fn element_id(&self, index: usize) -> String {
        let component = &self.checked.ir.name;
        if index == 0 { component.clone() } else { format!("{component}/{index}") }
    }

    fn node(&mut self, view: &View, inside_button: bool, label: &mut Vec<Ident>) -> TokenStream {
        let index = self.next_node;
        self.next_node += 1;
        let (tag, source, children, style, disabled, activate) = match view {
            View::Element { tag, source, children, style, disabled, activate } => (tag, source, children, style, disabled, activate),
            View::Child { .. } => {
                let slot = crate::context::child(self.next_child);
                self.next_child += 1;
                return quote!(self.#slot.as_ref().map(|(_, child)| child.clone()));
            }
            View::Text { value, source } => {
                let name = format_ident!("text_{index}");
                let value = (self.pure)(value, quote!(self));
                let doc = names::source_doc("text region", source);
                self.texts.push(quote!(#[comment = #doc] let #name = ::gpui::SharedString::from(#value);));
                return if inside_button {
                    // The enclosing button supplies its accessible name from this same text.
                    label.push(name.clone());
                    quote!(#name)
                } else {
                    let id = self.element_id(index);
                    quote!(::gpui::Text::new((#id, cx.entity_id()).into(), #name))
                };
            }
        };

        let button = *tag == Tag::Button || activate.is_some() || disabled.is_some();
        let label_start = label.len();
        let mut elements = Vec::with_capacity(children.len());
        for child in children {
            let element = self.node(child, button || inside_button, label);
            elements.push(if matches!(child, View::Child { .. }) { quote!(node = node.children(#element);) } else { quote!(node = node.child(#element);) });
        }
        let (tag_name, mut base) = match tag {
            Tag::Div => ("div", quote!(::gpui::div())),
            Tag::Span => ("span", quote!(::gpui::div().flex().flex_row())),
            Tag::I => ("i", quote!(::gpui::div().flex().flex_row())),
            Tag::Section => ("section", quote!(::gpui::div())),
            Tag::Button => ("button", quote!(::gpui::div())),
        };
        let doc = names::source_doc(tag_name, source);
        if button || *tag == Tag::Section {
            let id = self.element_id(index);
            let role = if button { quote!(::gpui::Role::Button) } else { quote!(::gpui::Role::Section) };
            base.extend(quote!(.id((#id, cx.entity_id())).role(#role)));
        }
        let accessible_name = if button {
            match &label[label_start..] {
                [] => None,
                [one] => Some(quote!(node = node.aria_label(#one.clone());)),
                many => Some(quote!(node = node.aria_label([#(#many.as_str()),*].concat());)),
            }
        } else { None };
        if !inside_button { label.truncate(label_start); }
        let token_styles = style.as_ref().map(|id| {
            let tokens = (self.pure)(id, quote!(self));
            if self.checked.links.scoped {
                quote! {
                    if let ::core::option::Option::Some(resolve) = &self.scope.resolve_token {
                        for token in (#tokens).iter() { resolve(token.as_str(), node.style()); }
                    }
                }
            } else { quote!(for token in (#tokens).iter() { (self.resolve_token)(token.as_str(), node.style()); }) }
        });
        let appearance = (index == 0).then(|| quote! {
            if let ::core::option::Option::Some(appearance) = &self.appearance {
                appearance(&self.projection(), node.style());
            }
        });
        let availability = disabled.as_ref().map(|id| {
            let value = (self.pure)(id, quote!(self));
            quote!(let disabled = #value;)
        });
        let mut input = TokenStream::new();
        if button { input.extend(quote!(node = node.tab_index(0);)); }
        if let Some(id) = activate { input.extend(self.listener(id, disabled.as_deref())); }
        let end = if availability.is_some() {
            if !input.is_empty() { input = quote!(if !disabled { #input }); }
            quote!(::proto_ui_gpui_support::button_availability(node, disabled))
        } else { quote!(node) };
        quote!({
            #[comment = #doc]
            let mut node = #base;
            #accessible_name
            #token_styles
            #appearance
            #availability
            #input
            #(#elements)*
            #end
        })
    }

    fn listener(&self, id: &str, disabled: Option<&str>) -> TokenStream {
        let f = self.checked.functions[id];
        let command = &self.names.command;
        let action = names::command(f);
        let dispatch = quote!(view.__pui_submit(#command::#action(), cx));
        let effect = if self.checked.bodies[f].facts.fallible {
            quote! {
                if let ::proto_ui_gpui_support::ActionOutcome::Failed(failure) = #dispatch {
                    cx.emit(failure);
                    view.publication.after_effects(cx, Self::__pui_resume);
                }
            }
        } else { quote!(#dispatch;) };
        let guard = disabled.map(|id| {
            let value = (self.pure)(id, quote!(view));
            quote!(if #value { return; })
        });
        quote!(node = node.on_click(cx.listener(|view, _: &::gpui::ClickEvent, _, cx| { #guard #effect }));)
    }
}
