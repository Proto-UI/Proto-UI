//! Topology T0: the peer as a child process, spoken to in frames.
//!
//! The host writes frames to the peer's stdin; a reader thread decodes the
//! peer's stdout and hands complete messages over a channel. The peer's stderr
//! is left to the host process, since only stdout carries frames.

use std::io::{self, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use crate::frame::{encode, FrameDecoder, FrameError};
use crate::messages::{HostToPeerMessage, PeerToHostMessage};

/// How many of the latest messages a timeout names.
const TIMEOUT_KINDS: usize = 16;

/// A peer running as a child process.
pub struct PeerProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    incoming: Receiver<Result<PeerToHostMessage, String>>,
}

#[derive(Debug)]
pub enum PeerError {
    Io(io::Error),
    Frame(FrameError),
    /// The peer's stream ended or broke, with the reason if one was seen.
    Closed(Option<String>),
    /// Nothing matching arrived in time. Carries the kinds of the latest
    /// messages that did arrive.
    Timeout(Vec<String>),
}

impl std::fmt::Display for PeerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(f, "peer I/O failed: {error}"),
            Self::Frame(error) => write!(f, "{error}"),
            Self::Closed(Some(reason)) => write!(f, "peer stream closed: {reason}"),
            Self::Closed(None) => write!(f, "peer stream closed"),
            Self::Timeout(seen) => write!(f, "timed out; the peer sent {seen:?}"),
        }
    }
}

impl std::error::Error for PeerError {}

impl PeerProcess {
    /// Starts the peer. Its stdin and stdout are taken over for frames.
    pub fn spawn(mut command: Command) -> Result<Self, PeerError> {
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        let mut child = command.spawn().map_err(PeerError::Io)?;
        let stdin = child.stdin.take().expect("stdin is piped");
        let mut stdout = child.stdout.take().expect("stdout is piped");

        let (sender, incoming) = mpsc::channel();
        thread::spawn(move || {
            let mut decoder = FrameDecoder::new();
            let mut chunk = [0u8; 64 * 1024];
            loop {
                let read = match stdout.read(&mut chunk) {
                    Ok(0) => return,
                    Ok(read) => read,
                    Err(error) => {
                        let _ = sender.send(Err(error.to_string()));
                        return;
                    }
                };
                match decoder.push::<PeerToHostMessage>(&chunk[..read]) {
                    Ok(messages) => {
                        for message in messages {
                            if sender.send(Ok(message)).is_err() {
                                return;
                            }
                        }
                    }
                    Err(error) => {
                        let _ = sender.send(Err(error.to_string()));
                        return;
                    }
                }
            }
        });

        Ok(Self {
            child,
            stdin: Some(stdin),
            incoming,
        })
    }

    /// Sends one message.
    pub fn send(&mut self, message: &HostToPeerMessage) -> Result<(), PeerError> {
        let frame = encode(message).map_err(PeerError::Frame)?;
        let stdin = self.stdin.as_mut().ok_or(PeerError::Closed(None))?;
        stdin.write_all(&frame).map_err(PeerError::Io)?;
        stdin.flush().map_err(PeerError::Io)
    }

    /// Receives the next message, waiting at most `timeout`.
    pub fn recv(&self, timeout: Duration) -> Result<PeerToHostMessage, PeerError> {
        match self.incoming.recv_timeout(timeout) {
            Ok(Ok(message)) => Ok(message),
            Ok(Err(reason)) => Err(PeerError::Closed(Some(reason))),
            Err(RecvTimeoutError::Timeout) => Err(PeerError::Timeout(Vec::new())),
            Err(RecvTimeoutError::Disconnected) => Err(PeerError::Closed(None)),
        }
    }

    /// Receives messages until one satisfies `done`, returning all of them
    /// in arrival order.
    pub fn until(
        &self,
        timeout: Duration,
        done: impl Fn(&PeerToHostMessage) -> bool,
    ) -> Result<Vec<PeerToHostMessage>, PeerError> {
        let deadline = Instant::now() + timeout;
        let mut seen = Vec::new();
        loop {
            // Checked before every receive: a peer that keeps sending other
            // messages must not keep the wait open past its deadline.
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(timed_out(&seen));
            }
            match self.recv(remaining) {
                Ok(message) => {
                    let finished = done(&message);
                    seen.push(message);
                    if finished {
                        return Ok(seen);
                    }
                }
                Err(PeerError::Timeout(_)) => return Err(timed_out(&seen)),
                Err(error) => return Err(error),
            }
        }
    }

    /// Closes the peer's stdin, which ends it, and waits briefly for it to
    /// exit before killing it.
    pub fn shutdown(mut self, grace: Duration) -> io::Result<()> {
        self.stdin.take();
        let deadline = Instant::now() + grace;
        while Instant::now() < deadline {
            if self.child.try_wait()?.is_some() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(20));
        }
        self.child.kill()
    }
}

fn timed_out(seen: &[PeerToHostMessage]) -> PeerError {
    let latest = &seen[seen.len().saturating_sub(TIMEOUT_KINDS)..];
    PeerError::Timeout(
        latest
            .iter()
            .map(|message| message.kind().to_string())
            .collect(),
    )
}

impl Drop for PeerProcess {
    fn drop(&mut self) {
        // A test that panics must not leave a Node process behind.
        if let Ok(None) = self.child.try_wait() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn message(value: serde_json::Value) -> PeerToHostMessage {
        serde_json::from_value(value).expect("a valid peer message")
    }

    fn disposed(session_id: &str) -> PeerToHostMessage {
        message(json!({ "kind": "session.disposed", "sessionId": session_id }))
    }

    /// A peer whose messages are already waiting, with the sender kept so
    /// the stream stays open.
    fn queued(
        messages: Vec<PeerToHostMessage>,
    ) -> (PeerProcess, mpsc::Sender<Result<PeerToHostMessage, String>>) {
        let (sender, incoming) = mpsc::channel();
        for message in messages {
            sender.send(Ok(message)).expect("the channel takes it");
        }
        let peer = PeerProcess {
            child: Command::new("true").spawn().expect("a child to hold"),
            stdin: None,
            incoming,
        };
        (peer, sender)
    }

    #[test]
    fn a_wait_past_its_deadline_times_out_though_messages_are_waiting() {
        let mut waiting: Vec<_> = (0..5).map(|n| disposed(&format!("other-{n}"))).collect();
        waiting.push(disposed("wanted"));
        let (peer, _sender) = queued(waiting);
        let result = peer.until(Duration::ZERO, |message| {
            matches!(message, PeerToHostMessage::SessionDisposed(disposed)
                if disposed.session_id == "wanted")
        });
        assert!(matches!(result, Err(PeerError::Timeout(_))), "{result:?}");
    }

    #[test]
    fn a_match_in_time_returns_everything_up_to_it() {
        let (peer, _sender) = queued(vec![disposed("other"), disposed("wanted")]);
        let seen = peer
            .until(Duration::from_secs(5), |message| {
                matches!(message, PeerToHostMessage::SessionDisposed(disposed)
                    if disposed.session_id == "wanted")
            })
            .expect("the match arrives in time");
        assert_eq!(seen.len(), 2);
    }

    #[test]
    fn a_timeout_names_only_the_latest_messages() {
        let others = (0..TIMEOUT_KINDS + 4)
            .map(|n| disposed(&format!("other-{n}")))
            .collect();
        let (peer, _sender) = queued(others);
        match peer.until(Duration::from_millis(50), |_| false) {
            Err(PeerError::Timeout(kinds)) => assert_eq!(kinds.len(), TIMEOUT_KINDS),
            other => panic!("expected a timeout, got {other:?}"),
        }
    }
}
