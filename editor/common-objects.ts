/** Fixed-port defaults instantiated and saved by Max 9.1.5; see the common-objects fixture. */
const definitions = {
  loadbang: {
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 1,
    size: [100, 22],
    attributes: { text: "loadbang", outlettype: ["bang"] },
  },
  message: {
    maxclass: "message",
    numinlets: 2,
    numoutlets: 1,
    size: [98, 22],
    attributes: { text: "", outlettype: [""] },
  },
  comment: {
    maxclass: "comment",
    numinlets: 1,
    numoutlets: 0,
    size: [150, 20],
    attributes: { text: "" },
  },
  button: {
    maxclass: "button",
    numinlets: 1,
    numoutlets: 1,
    size: [24, 24],
    attributes: { outlettype: ["bang"], parameter_enable: 0 },
  },
  toggle: {
    maxclass: "toggle",
    numinlets: 1,
    numoutlets: 1,
    size: [24, 24],
    attributes: { outlettype: ["int"], parameter_enable: 0 },
  },
  number: {
    maxclass: "number",
    numinlets: 1,
    numoutlets: 2,
    size: [50, 22],
    attributes: { outlettype: ["", "bang"], parameter_enable: 0 },
  },
  flonum: {
    maxclass: "flonum",
    numinlets: 1,
    numoutlets: 2,
    size: [50, 22],
    attributes: { outlettype: ["", "bang"], parameter_enable: 0, format: 6 },
  },
  print: {
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 0,
    size: [100, 22],
    attributes: { text: "print" },
  },
  "plugin~": {
    maxclass: "newobj",
    numinlets: 2,
    numoutlets: 2,
    size: [100, 22],
    attributes: { text: "plugin~", outlettype: ["signal", "signal"] },
  },
  "plugout~": {
    maxclass: "newobj",
    numinlets: 2,
    numoutlets: 2,
    size: [100, 22],
    attributes: { text: "plugout~", outlettype: ["signal", "signal"] },
  },
  midiin: {
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 1,
    size: [100, 22],
    attributes: { text: "midiin", outlettype: ["int"] },
  },
  midiout: {
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 0,
    size: [100, 22],
    attributes: { text: "midiout" },
  },
} as const;
export type CommonObjectName = keyof typeof definitions;
export function commonObject(name: CommonObjectName) {
  if (!Object.hasOwn(definitions, name))
    throw new TypeError(
      `Unknown common object ${name}; use object() with explicit port counts`,
    );
  return definitions[name];
}
