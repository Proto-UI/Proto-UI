# Synthetic video fixtures

These tiny clips contain three self-authored 32×32 solid-color RGB frames (red, blue, green), at 2 frames per second. They are decoder controls, not browser or Proto UI acceptance evidence. No third-party media or binary is included.

Generated locally with distro FFmpeg `7.1.5-0+deb13u1`; required CI replays the same files with the declared Ubuntu 24.04 FFmpeg 6.1.x baseline. Decoder behavior and version receipts, not identical encoder output across releases, are required.

Input can be recreated with Python:

```python
open('colors.rgb', 'wb').write(
    b'\xff\x00\x00' * 1024 + b'\x00\x00\xff' * 1024 + b'\x00\xff\x00' * 1024
)
```

Each command starts with `ffmpeg -f rawvideo -pixel_format rgb24 -video_size 32x32 -framerate 2 -i colors.rgb -an -threads 1` and the following output options:

- `moov-at-end.mp4`: `-c:v mpeg4 moov-at-end.mp4`
- `colors.mov`: `-c:v rawvideo colors.mov`
- `colors.mkv`: `-c:v ffv1 colors.mkv`
- `colors.webm`: `-c:v libvpx colors.webm`

`faststart.mp4` is remuxed with `ffmpeg -i moov-at-end.mp4 -c copy -movflags +faststart faststart.mp4`. `one-frame.mp4` is the deliberately insufficient clip created with `ffmpeg -i faststart.mp4 -frames:v 1 -c copy one-frame.mp4`.
