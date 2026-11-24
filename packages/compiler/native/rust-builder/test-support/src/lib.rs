//! Executes generated native components against Verdant's pinned GPUI fork.
//! The test-only text-system probe observes actual Render -> text-layout calls.
//! It does not implement or interpret the compiler's HIR.

#[cfg(test)]
mod tests;
