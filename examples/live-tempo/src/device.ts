import LiveObject = require("@tsln/live-object");
inlets = 1;
outlets = 1;
autowatch = 1;
let observer: LiveObject.Observer | null = null;
let revision = 0;
// live.thisdevice invokes bang only after the containing device has initialised.
function bang(): void {
  const current = ++revision;
  observer?.unobserve();
  observer = null;
  const song = LiveObject.song();
  if (!song) return;
  const tempo: Lom.PropertyType<"Song", "tempo"> = song.tempo;
  outlet(0, tempo);
  observer = song.observe("tempo", (value) => {
    if (revision === current) outlet(0, value);
  });
}
function notifydeleted(): void {
  revision++;
  observer?.unobserve();
  observer = null;
}
type MaxHandlers = Handlers<{
  bang: typeof bang;
  notifydeleted: typeof notifydeleted;
}>;
