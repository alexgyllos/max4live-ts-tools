// Runs inside Max, not Node. Max itself constructs and serialises every fixture object.
inlets = 1;
outlets = 1;
autowatch = 0;
let generated: Patcher | null = null;
function populate(p: Patcher, includeIo: boolean): void {
  p.setattr("openinpresentation", 1);
  p.setattr("devicewidth", 320);
  const objects = new Map<string, Maxobj>();
  const add = (
    name: string,
    maxclass: string,
    args: (string | number)[] = [],
  ): Maxobj => {
    const i = objects.size;
    const object = p.newdefault(
      24 + (i % 4) * 180,
      24 + Math.floor(i / 4) * 100,
      maxclass,
      ...args,
    );
    object.varname = name;
    objects.set(name, object);
    return object;
  };
  for (const name of [
    "loadbang",
    "message",
    "comment",
    "button",
    "toggle",
    "number",
    "flonum",
    "plugin~",
    "plugout~",
    "midiin",
    "midiout",
  ])
    if (
      includeIo ||
      !["plugin~", "plugout~", "midiin", "midiout"].includes(name)
    )
      add(name, name);
  objects.get("message")!.message("set", "Fixture message");
  objects.get("comment")!.message("set", "Fixture comment");
  for (const [name, appearance, x, width] of [
    ["dial_vertical", 0, 16, 60],
    ["dial_panel", 2, 96, 72],
    ["dial_large", 3, 192, 80],
  ] as const)
    add(name, "live.dial", [
      "@appearance",
      appearance,
      "@parameter_enable",
      1,
      "@presentation",
      1,
      "@presentation_rect",
      x,
      48,
      width,
      88,
    ]);
  add("header", "live.comment", [
    "@text",
    "NATIVE FIXTURE",
    "@fontsize",
    10,
    "@textjustification",
    0,
    "@presentation",
    1,
    "@presentation_rect",
    8,
    8,
    288,
    18,
  ]);
  const panel = add("separator", "panel", [
    "@bgfillcolor",
    "Control Border",
    "@background",
    1,
    "@ignoreclick",
    1,
    "@border",
    0,
    "@rounded",
    0,
    "@presentation",
    1,
    "@presentation_rect",
    8,
    32,
    288,
    4,
  ]);
  panel.background = true;
  p.sendtoback(panel);
  add("provenance", "comment").message(
    "set",
    `Created by typed Patcher/Maxobj API; Max ${max.version}`,
  );
  if (includeIo) {
    p.connect(objects.get("plugin~")!, 0, objects.get("plugout~")!, 0);
    p.connect(objects.get("plugin~")!, 1, objects.get("plugout~")!, 1);
    p.connect(objects.get("midiin")!, 0, objects.get("midiout")!, 0);
  }
}
function generate(): void {
  const p = new Patcher(100, 100, 900, 900);
  generated = p;
  populate(p, true);
  p.name = `native-objects-max-${max.version}`;
  p.message("front");
  // Max 9.1's patcher write message accepts no filename: use its native Save dialog.
  p.message("write");
  post(
    `Created native objects in Max ${max.version}; save the new patcher through Max.\n`,
  );
}
// An explicit argument can launch creation immediately; otherwise send generate.
function device(): void {
  if (
    !patcher.getlogical((o) => o.varname === "native_fixture_generator")?.length
  )
    throw new Error("device is only for the generated Native Fixture Host");
  if (patcher.getlogical((o) => o.varname === "dial_large")?.length) return;
  populate(patcher, false);
  post(
    `Native device attributes created in Max ${max.version}; inspect and save from Edit in Max.\n`,
  );
}
if (jsarguments[1] === "generate") generate();
if (jsarguments[1] === "device") device();

function notifydeleted(): void {
  // The generated window remains available for visual inspection and native Save.
  generated = null;
}
type MaxHandlers = Handlers<{
  generate: typeof generate;
  device: typeof device;
  notifydeleted: typeof notifydeleted;
}>;
