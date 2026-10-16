// These negative controls fail if Node or DOM globals leak into the Max program.
// @ts-expect-error Max scripts have no Node process.
type NoNodeProcess = typeof process;
// @ts-expect-error Max scripts have no DOM document.
type NoDomDocument = typeof document;
