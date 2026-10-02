//! Closing the window once the interface has written what it was holding.
//!
//! The editor waits for a pause in the typing before it writes, so at the moment somebody
//! closes the window the last words they typed can be on screen and nowhere else. Closing
//! therefore asks first: the window is held, the interface is told, and the window closes when
//! the interface answers that everything is on disk — or after two seconds, whatever it says.
//! A window that will not close is worse than anything this is here to protect.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Mutex;
use std::time::Duration;

/// How long the interface gets to save before the window closes regardless.
pub const LIMIT: Duration = Duration::from_secs(2);

/// What the event that asks the interface to save is called.
pub const EVENT: &str = "save-before-close";

#[derive(Default)]
pub struct Closing {
    started: AtomicBool,
    ready: Mutex<Option<Sender<()>>>,
}

impl Closing {
    /// Start closing, and hand back what will hear the interface's answer.
    ///
    /// `None` when a close is already under way: the window is going anyway, and waiting a
    /// second time would only try to close it twice.
    pub fn begin(&self) -> Option<Receiver<()>> {
        if self.started.swap(true, Ordering::SeqCst) {
            return None;
        }
        let (answer, heard) = channel();
        *self.ready.lock().unwrap_or_else(|e| e.into_inner()) = Some(answer);
        Some(heard)
    }

    /// The interface has saved everything it was holding.
    pub fn ready(&self) {
        if let Some(answer) = self.ready.lock().unwrap_or_else(|e| e.into_inner()).take() {
            // Nobody listening means the wait already ran out, which is fine.
            let _ = answer.send(());
        }
    }
}

/// Wait for the interface's answer, or for `limit` to pass, whichever comes first.
pub fn wait(heard: &Receiver<()>, limit: Duration) {
    let _ = heard.recv_timeout(limit);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::time::Instant;

    #[test]
    fn an_answer_ends_the_wait_at_once() {
        let closing = Arc::new(Closing::default());
        let heard = closing.begin().unwrap();
        let answering = Arc::clone(&closing);
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(20));
            answering.ready();
        });

        let started = Instant::now();
        wait(&heard, Duration::from_secs(10));
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "the window waited out the limit although the interface had answered"
        );
    }

    #[test]
    fn no_answer_still_ends_the_wait_at_the_limit() {
        // The interface hung, or was never there to hear. The window closes regardless.
        let closing = Closing::default();
        let heard = closing.begin().unwrap();

        let started = Instant::now();
        wait(&heard, Duration::from_millis(50));
        let waited = started.elapsed();
        assert!(waited >= Duration::from_millis(50), "{waited:?}");
        assert!(waited < Duration::from_secs(5), "{waited:?}");
    }

    #[test]
    fn closing_again_while_closing_does_not_start_another_wait() {
        let closing = Closing::default();
        assert!(closing.begin().is_some());
        assert!(closing.begin().is_none());
    }

    #[test]
    fn an_answer_nobody_asked_for_is_harmless() {
        let closing = Closing::default();
        closing.ready();
        assert!(
            closing.begin().is_some(),
            "an early answer must not stop a real close"
        );
    }
}
