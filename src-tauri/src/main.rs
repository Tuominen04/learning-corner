// The desktop entry point. Everything of substance is in the library crate, so the same code
// is reachable from tests and from the binding generator.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer fails on some Wayland sessions — the window opens and closes
    // within a second, printing `Error 71 (Protocol error) dispatching to Wayland display`.
    // Turning it off falls back to a renderer that works everywhere, at a cost a text editor
    // never notices. Set here, before GTK or any thread starts, and only if the person has not
    // chosen a value themselves.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    lc_lib::run()
}
