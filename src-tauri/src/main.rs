// The desktop entry point. Everything of substance is in the library crate, so the same code
// is reachable from tests and from the binding generator.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    plc_lib::run()
}
