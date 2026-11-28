// Only the macOS accessibility evidence feature builds this translation unit.
// Referencing the real SDK declarations makes Clang emit their protocol objects;
// no protocol is invented, abbreviated, or registered by hand.
#import <ScreenCaptureKit/ScreenCaptureKit.h>

Protocol *proto_ui_capture_output_protocol(void) {
    return @protocol(SCStreamOutput);
}

Protocol *proto_ui_capture_delegate_protocol(void) {
    return @protocol(SCStreamDelegate);
}
