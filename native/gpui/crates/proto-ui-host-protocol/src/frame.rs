//! Length-prefixed JSON frames for topology T0.
//!
//! The framing the peer uses (`packages/adapters/gpui-peer/src/transport.ts`):
//! a big-endian 32-bit byte length, then that many bytes of UTF-8 JSON. Frames
//! larger than 16 MiB are refused in both directions.
//!
//! Framing is not protocol semantics. It is how bounded messages cross one
//! particular pipe, and T1 (an in-process QuickJS call) does without it.

use serde::de::DeserializeOwned;
use serde::Serialize;

/// The peer's limit, mirrored so neither side sends what the other refuses.
pub const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

const HEADER_BYTES: usize = 4;

#[derive(Debug)]
pub enum FrameError {
    /// A frame declared, or would need, more than [`MAX_FRAME_BYTES`].
    TooLarge { length: usize },
    /// A complete frame whose body is not the expected JSON.
    Json(serde_json::Error),
}

impl std::fmt::Display for FrameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooLarge { length } => {
                write!(f, "frame of {length} bytes exceeds {MAX_FRAME_BYTES}")
            }
            Self::Json(error) => write!(f, "frame body is not the expected JSON: {error}"),
        }
    }
}

impl std::error::Error for FrameError {}

/// Encodes one message as a frame.
pub fn encode(message: &impl Serialize) -> Result<Vec<u8>, FrameError> {
    let body = serde_json::to_vec(message).map_err(FrameError::Json)?;
    if body.len() > MAX_FRAME_BYTES {
        return Err(FrameError::TooLarge { length: body.len() });
    }
    let mut frame = Vec::with_capacity(HEADER_BYTES + body.len());
    frame.extend_from_slice(&(body.len() as u32).to_be_bytes());
    frame.extend_from_slice(&body);
    Ok(frame)
}

/// Reassembles frames from bytes that arrive in arbitrary chunks.
#[derive(Default)]
pub struct FrameDecoder {
    buffer: Vec<u8>,
}

impl FrameDecoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds bytes and returns every message they completed, in order.
    ///
    /// An oversize length is refused as soon as its header arrives, before
    /// any of the body is buffered: a peer that declares four gigabytes must
    /// not be able to make the host try to hold them.
    pub fn push<T: DeserializeOwned>(&mut self, chunk: &[u8]) -> Result<Vec<T>, FrameError> {
        self.buffer.extend_from_slice(chunk);
        let mut messages = Vec::new();
        while let Some(header) = self.buffer.get(..HEADER_BYTES) {
            let length = u32::from_be_bytes(header.try_into().expect("four bytes")) as usize;
            if length > MAX_FRAME_BYTES {
                return Err(FrameError::TooLarge { length });
            }
            if self.buffer.len() < HEADER_BYTES + length {
                break;
            }
            let body: Vec<u8> = self
                .buffer
                .drain(..HEADER_BYTES + length)
                .skip(HEADER_BYTES)
                .collect();
            messages.push(serde_json::from_slice(&body).map_err(FrameError::Json)?);
        }
        Ok(messages)
    }

    /// Bytes held for a frame that has not completed yet.
    pub fn pending_bytes(&self) -> usize {
        self.buffer.len()
    }
}
