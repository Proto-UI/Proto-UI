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
    /// Nothing matching arrived in time. Carries what did arrive.
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
            let remaining = deadline.saturating_duration_since(Instant::now());
            match self.recv(remaining) {
                Ok(message) => {
                    let finished = done(&message);
                    seen.push(message);
                    if finished {
                        return Ok(seen);
                    }
                }
                Err(PeerError::Timeout(_)) => {
                    return Err(PeerError::Timeout(
                        seen.iter()
                            .map(|message| message.kind().to_string())
                            .collect(),
                    ))
                }
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

impl Drop for PeerProcess {
    fn drop(&mut self) {
        // A test that panics must not leave a Node process behind.
        if let Ok(None) = self.child.try_wait() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}
