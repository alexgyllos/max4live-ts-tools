import type { NormalizedPatch } from "../types.js";

const OBJ_ID_RE = /^obj-(\d+)$/;

type IdGenerator = () => string;

export const createIdGenerator = (patch: NormalizedPatch): IdGenerator => {
  let counter = 0n;

  for (const id of patch.boxes.keys()) {
    const m = OBJ_ID_RE.exec(id);
    if (m) {
      const n = BigInt(m[1]);
      if (n > counter) counter = n;
    }
  }

  const used = new Set(patch.boxes.keys());
  // counter is now the max numeric suffix seen
  return (): string => {
    counter += 1n;
    let candidate = `obj-${counter}`;
    // Guarantee no collision against actual key set
    while (used.has(candidate)) {
      counter += 1n;
      candidate = `obj-${counter}`;
    }
    used.add(candidate);
    return candidate;
  };
};
