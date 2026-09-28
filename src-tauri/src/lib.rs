//! The desktop shell.
//!
//! Owns the window, the menus, and the dialogs. It holds no durable state: everything the
//! interface displays came from an engine call, and everything it changes goes back through
//! one. Losing this process loses nothing.

pub mod commands;
pub mod dto;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::OpenLibrary::default())
        .invoke_handler(tauri::generate_handler![
            commands::library_create,
            commands::library_open,
            commands::library_close,
            commands::library_status,
            commands::library_rebuild_index,
            commands::topic_tree,
            commands::topic_create,
            commands::topic_rename,
            commands::document_create,
            commands::document_read,
            commands::document_write,
            commands::document_rename,
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
        ])
        .run(tauri::generate_context!())
        .expect("the application failed to start");
}
