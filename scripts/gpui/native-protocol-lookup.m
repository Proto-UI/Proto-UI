// A separate executable deliberately does not reference SDK protocol objects.
// It observes runtime registration before/after framework load and class init.
// It never queries shareable content, allocates a window, or starts a capture.
#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#include <dlfcn.h>
#include <stdio.h>

static void snapshot(const char *phase) {
    Protocol *output = objc_getProtocol("SCStreamOutput");
    Protocol *delegate = objc_getProtocol("SCStreamDelegate");
    printf("{\"phase\":\"%s\",\"SCStreamOutput\":%s,\"SCStreamDelegate\":%s}\n",
           phase, output == NULL ? "false" : "true",
           delegate == NULL ? "false" : "true");
}

int main(void) {
    @autoreleasepool {
        snapshot("before-framework-load");
        void *framework = dlopen(
            "/System/Library/Frameworks/ScreenCaptureKit.framework/ScreenCaptureKit",
            RTLD_NOW | RTLD_LOCAL);
        snapshot("after-framework-load");
        Class stream = objc_getClass("SCStream");
        if (stream != Nil) {
            [(id)stream class];
        }
        snapshot("after-stream-class-init");
        printf("{\"frameworkLoaded\":%s,\"streamClassPresent\":%s}\n",
               framework == NULL ? "false" : "true", stream == Nil ? "false" : "true");
        // Missing protocol registration is an observation, not a passing native
        // capture verdict. Failure to perform the requested probe is terminal.
        return framework != NULL && stream != Nil ? 0 : 1;
    }
}
