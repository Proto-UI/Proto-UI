use std::env;
use std::path::PathBuf;
use std::process::{Command, Output};

fn checked(command: &mut Command) -> Output {
    let output = command
        .output()
        .expect("could not run the current Apple SDK tool");
    assert!(
        output.status.success(),
        "Apple SDK command {command:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    output
}

fn main() {
    const SOURCE: &str = "tests/support/native_protocols.m";
    println!("cargo:rerun-if-changed={SOURCE}");
    println!("cargo:rerun-if-env-changed=DEVELOPER_DIR");
    println!("cargo:rerun-if-env-changed=SDKROOT");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos")
        || env::var_os("CARGO_FEATURE_MACOS_ACCESSIBILITY_TEST").is_none()
    {
        return;
    }
    let architecture = match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("aarch64") => "arm64",
        Ok("x86_64") => "x86_64",
        other => panic!("unsupported native capture target architecture: {other:?}"),
    };
    let sdk = checked(Command::new("xcrun").args(["--sdk", "macosx", "--show-sdk-path"]));
    let sdk = String::from_utf8(sdk.stdout).expect("Apple SDK path was not UTF-8");
    let out = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo did not provide OUT_DIR"));
    let object = out.join("native_protocols.o");
    let archive = out.join("libproto_ui_capture_protocols.a");
    checked(
        Command::new("xcrun")
            .args(["--sdk", "macosx", "clang", "-isysroot", sdk.trim()])
            .args(["-arch", architecture, "-x", "objective-c", "-std=c11"])
            .args([
                "-fno-objc-arc",
                "-fblocks",
                "-Wall",
                "-Wextra",
                "-Werror",
                "-c",
                SOURCE,
                "-o",
            ])
            .arg(&object),
    );
    // OUT_DIR survives rebuilds. Replace only this build script's own archive.
    if archive.exists() {
        std::fs::remove_file(&archive).expect("could not replace the protocol witness archive");
    }
    checked(
        Command::new("xcrun")
            .args(["--sdk", "macosx", "ar", "crs"])
            .arg(&archive)
            .arg(&object),
    );
    // The native evidence test owns the #[link] declaration. Ordinary library
    // targets do not link or reference the SDK protocol witness.
    println!("cargo:rustc-link-search=native={}", out.display());
}
