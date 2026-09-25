//! The T0 framing, byte for byte as the peer frames it.

use proto_ui_host_protocol::frame::{encode, FrameDecoder, FrameError, MAX_FRAME_BYTES};
use serde_json::{json, Value};

#[test]
fn a_frame_is_a_big_endian_length_then_the_json_body() {
    let frame = encode(&json!({ "kind": "session.dispose", "sessionId": "s" })).expect("encodes");
    let body = br#"{"kind":"session.dispose","sessionId":"s"}"#;
    assert_eq!(&frame[..4], &(body.len() as u32).to_be_bytes());
    assert_eq!(&frame[4..], body);
}

#[test]
fn frames_reassemble_however_the_bytes_are_chunked() {
    let mut stream = encode(&json!({ "n": 1 })).expect("encodes");
    stream.extend(encode(&json!({ "n": 2, "text": "é漢" })).expect("encodes"));

    // Everything at once: both frames.
    let all: Vec<Value> = FrameDecoder::new().push(&stream).expect("decodes");
    assert_eq!(
        all,
        vec![json!({ "n": 1 }), json!({ "n": 2, "text": "é漢" })]
    );

    // One byte at a time: the same two frames, each completed exactly once.
    let mut decoder = FrameDecoder::new();
    let mut seen: Vec<Value> = Vec::new();
    for byte in &stream {
        seen.extend(
            decoder
                .push::<Value>(std::slice::from_ref(byte))
                .expect("decodes"),
        );
    }
    assert_eq!(seen, all);
    assert_eq!(decoder.pending_bytes(), 0);
}

#[test]
fn an_oversize_length_is_refused_as_soon_as_its_header_arrives() {
    // Only the header: the decoder must refuse before any body is buffered.
    let header = ((MAX_FRAME_BYTES + 1) as u32).to_be_bytes();
    let mut decoder = FrameDecoder::new();
    match decoder.push::<Value>(&header) {
        Err(FrameError::TooLarge { length }) => assert_eq!(length, MAX_FRAME_BYTES + 1),
        other => panic!("expected TooLarge, got {other:?}"),
    }
}

#[test]
fn an_oversize_message_is_refused_before_it_is_sent() {
    let huge = "x".repeat(MAX_FRAME_BYTES);
    assert!(matches!(
        encode(&json!({ "value": huge })),
        Err(FrameError::TooLarge { .. })
    ));
}

#[test]
fn a_complete_frame_that_is_not_json_is_an_error() {
    let mut frame = 3u32.to_be_bytes().to_vec();
    frame.extend_from_slice(b"{no");
    assert!(matches!(
        FrameDecoder::new().push::<Value>(&frame),
        Err(FrameError::Json(_))
    ));
}
