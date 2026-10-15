# One-minute Stereo Gain demonstration

Use `examples/stereo-gain/Stereo Gain.amxd`, or rebuild with the pinned public
package: `cd examples/stereo-gain && npm install && npm run build`. The example's
README contains measured native results. No video is included in this change;
this is a recording script using actual Live output, not a synthetic animation.

Prepare a disposable Set with a quiet, distinguishable stereo source and Stereo
Gain. Route left/right independently; use headphones or a low monitoring level.
Do not record unrelated windows or user projects.

| Time    | Show and explain                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–10 s  | `src/device.ts`: public imports, registered Gain, explicit stereo paths and one shared ramp. “Create, edit, validate and generate Max for Live devices programmatically using TypeScript.” |
| 10–18 s | Run `npm run build`; show `dist/Stereo Gain.amxd`. TypeScript runs during the offline build; the device contains ordinary Max objects.                                                     |
| 18–25 s | Load the generated file in Live; show the single Gain control at 0.5.                                                                                                                      |
| 25–40 s | Play stereo audio. Move Gain 0.5 → 1 → 0 → 0.5; show both channel meters changing together while the channels remain distinct.                                                             |
| 40–53 s | Record and play Gain automation; show it changing the actual audio level.                                                                                                                  |
| 53–60 s | Show a saved/reopened Set recalling a nondefault Gain. End on the example/build link.                                                                                                      |

Record the real application and audio. Trim waits with ordinary cuts if needed;
do not substitute an imagined UI or rendered waveform for native evidence. The
current qualification used native oscillator/capture probes, not a user audio
project. Its measured −6.02 dB attenuation, silence/unity, 10 ms smoothing and
saved automation/recall are recorded in the example README. First-vector startup
was not measured by that capture.
