//! The desktop shell.
//!
//! Owns the window, the menus, and the dialogs. It holds no durable state of a library's:
//! everything the interface displays came from an engine call, and everything it changes goes
//! back through one. Losing this process loses nothing.
//!
//! The one thing it keeps for itself is the list of libraries this computer has opened, in the
//! application's settings folder — a convenience whose loss costs a folder dialog.

use tauri::{Emitter, Manager};

pub mod closing;
pub mod commands;
pub mod dto;
pub mod recent;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::OpenLibrary::default())
        .manage(closing::Closing::default())
        // Held while the interface writes what it is holding, and closed when it answers or
        // after two seconds — see `closing.rs`. `destroy` closes without asking again.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let Some(heard) = window.state::<closing::Closing>().begin() else {
                    return;
                };
                // Failing to tell the interface means there is nobody to wait for, and the
                // limit below closes the window all the same.
                let _ = window.emit(closing::EVENT, ());
                let window = window.clone();
                std::thread::spawn(move || {
                    closing::wait(&heard, closing::LIMIT);
                    let _ = window.destroy();
                });
            }
        })
        .setup(|app| {
            // `$XDG_CONFIG_HOME/personal-learning-corner/`, as `packaging-fedora.md` names it:
            // a folder somebody can find by the application's name, rather than the
            // reverse-DNS identifier Tauri would choose by itself.
            let file = app
                .path()
                .config_dir()
                .ok()
                .map(|dir| dir.join("personal-learning-corner").join(recent::FILE));
            app.manage(recent::Recent::at(file));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::library_create,
            commands::library_open,
            commands::library_close,
            commands::library_status,
            commands::library_rebuild_index,
            commands::library_rename,
            commands::recent_libraries,
            commands::forget_library,
            commands::ready_to_close,
            commands::topic_tree,
            commands::topic_create,
            commands::topic_rename,
            commands::topic_move,
            commands::topic_delete_plan,
            commands::topic_delete,
            commands::document_create,
            commands::document_read,
            commands::document_write,
            commands::document_rename,
            commands::document_move,
            commands::document_delete,
            commands::document_attach_image,
            commands::document_image,
            commands::document_backlinks,
            commands::document_split,
            commands::search,
            commands::source_create,
            commands::source_read,
            commands::source_update,
            commands::source_list,
            commands::source_attach,
            commands::source_detach,
            commands::source_open,
            commands::source_delete_plan,
            commands::source_delete,
            commands::source_citing_documents,
            commands::source_required_fields,
            commands::citation_format,
            commands::citation_format_many,
            commands::citation_reference_list,
            commands::document_export,
        ])
        .run(tauri::generate_context!())
        .expect("the application failed to start");
}
