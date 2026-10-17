# Simple Chorus demonstration — 80 seconds

Recording kit for the real Live application and its audio. No video is included
yet. The repository screenshot is a genuine Live capture; it is not demo footage.

## Prepare

Build from a source checkout using Node 22.12+ within Node 22, or Node 24:

```sh
npm ci
npm pack
cd examples/simple-chorus
npm ci
npm install --no-save --package-lock=false ../../max4live-ts-tools-0.3.0.tgz
npm run build
npm test
```

The device is `examples/simple-chorus/dist/Simple Chorus.amxd`. It is self-contained
and must match the checked-in device byte-for-byte. Keep `src/device.ts` and a
terminal with `npm run build` ready beside Live.

Create a new disposable Live Set at 120 BPM. Add one audio track with an original
or rights-cleared sustained chord/plucked loop, and load the generated device.
Use no other effects. Set Rate 0.8 Hz, Depth 3 ms, Mix 35%. Keep monitoring quiet;
record Live's actual stereo output with a recorder that supports application audio
or an existing loopback input. Confirm the recording contains audio before the
take. A microphone recording or a separately simulated chorus is not a substitute.
Do not change the current project or use unrelated files in the recording.

Prepare eight bars of Arrangement automation: Rate 0.8 → 2 → 0.8 Hz over bars 1–5,
Depth 3 → 6 → 3 ms over bars 5–9. Keep Mix 35%. Leave a dry copy of the audio only
if needed for comparison; mute it while the effect track plays. Save this as
`Simple Chorus Demo.als` inside its own disposable Project and collect its media.
This setup is manual; no unverified generated Live Set is supplied.

## Take

- **0–15 s:** Show the public imports and graph in `src/device.ts`, then run
  `npm run build`. Say: “This TypeScript builds an ordinary Max for Live device.”
- **15–30 s:** Drag `dist/Simple Chorus.amxd` onto the disposable audio track.
  Frame the device and its three native controls. “No companion scripts are needed.”
- **30–55 s:** Play the loop. Move Mix 0 → 35 → 65 → 35%, Rate 0.8 → 2 → 0.8 Hz,
  then Depth 3 → 6 → 3 ms. “Rate changes the preview's cycles; Depth changes its
  height. The preview stays stationary while the audio keeps modulating.”
- **55–72 s:** Play the prepared eight-bar automation with automation enabled.
  Show the native Rate and Depth controls following it. Stop briefly to show that
  the curves remain visible without playback.
- **72–80 s:** Show the repository and Simple Chorus source link. “Build the
  example, inspect the graph, or try the device. Compatibility reports are welcome.”

Record only the editor, terminal and disposable Set. Prefer one clean take;
trim waits if needed. Check audible dry/wet changes and agreement between the
controls and curves. Upload/link the actual recording near Simple Chorus in the
README only when it exists and its publication is approved.

Native DSP, parameter recall and rapid-automation measurements are recorded in
[the example](../examples/simple-chorus/README.md); this shot list adds no new
compatibility claims.
