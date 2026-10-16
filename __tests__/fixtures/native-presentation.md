# Max 9.1.5 presentation reference

`native-presentation-max-9.1.5.amxd` was created in a saving-enabled Max for Live
editor on 2026-10-16. Dials, comments and panels were added manually with native
object/attribute input and saved by Max. The `.maxpat` is the exact saved JSON
payload extracted from that container (plus a trailing newline).

The fixture compares Vertical (default, 48px high), Panel (`appearance: 2`, 80px)
and Large (`appearance: 3`, 63px) dials. The helper uses Large for automatically
laid-out registered controls. Explicit/custom geometry is retained.

The panel carrying the separator annotation was set to **Control Border** through
native colour input. Max saved `saved_attribute_attributes.bgfillcolor.expression`
as `themecolor.live_contrast_frame`, with `mode: 0`, `background: 1`, `rounded: 0`
and a minimum presentation height of 4px. The other panel demonstrates **LCD
Background**, which is deliberately not placed underneath default dials.
Live comments default to the Live **Text / Icon** dynamic colour. The helper leaves
that native default intact. Native saved RGBA snapshots in this reference are not
a fixed light/dark palette used by the implementation.

The ownership annotation is preserved by Max; identifying objects by a similar ID
alone is insufficient. Unknown automatic-layout provenance is only a library hint:
a native save drops it, so subsequent edits respect those saved coordinates.
No global style preset, runtime renderer, external asset or font is required.

`stereo-gain-native-presentation-max-9.1.5.amxd` is the generated styled Stereo
Gain opened from Live 12.4.6, saved in its Max 9.1.5 editor, and returned to Live
on the same date. It verifies native-save ownership, Large geometry, parameter
registration and graph preservation. Max removed the private automatic-layout
hint; subsequent additions respect the native-saved Gain position.

The same native save/reopen exercise also covered the styled audio, MIDI, silent
instrument and sine CLI templates and an eight-parameter device in Live 12.4.6.
The two small fixtures above retain the representative metadata used by tests;
the qualification Sets and capture probes are not shipped or required at runtime.
