import LiveObject = require("@tsln/live-object");
inlets = 1;
outlets = 1;
autowatch = 1;
let song: LiveObject<"Song"> | null = null;
// live.thisdevice invokes bang only after the containing device has initialised.
function bang(): void {
  song?.unobserve("tempo");
  song = LiveObject.song();
  if (!song) return;
  const tempo: Lom.PropertyType<"Song", "tempo"> = song.tempo;
  outlet(0, tempo);
  song.observe("tempo", (value) => outlet(0, value));
}
function notifydeleted(): void {
  song?.unobserve("tempo");
  song = null;
}
type MaxHandlers = Handlers<{
  bang: typeof bang;
  notifydeleted: typeof notifydeleted;
}>;
