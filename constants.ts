// Stable key ordering for serialization — derived from Max's observed output.
// Known keys serialize first in this order; unknown keys appended alphabetically.

export const TOP_LEVEL_KEY_ORDER: readonly string[] = ["patcher"];

export const APPVERSION_KEY_ORDER: readonly string[] = [
  "major",
  "minor",
  "revision",
  "architecture",
  "modernui",
];

export const PATCHER_KEY_ORDER: readonly string[] = [
  "fileversion",
  "appversion",
  "classnamespace",
  "rect",
  "openrect",
  "bglocked",
  "openinpresentation",
  "default_fontsize",
  "default_fontface",
  "default_fontname",
  "gridonopen",
  "gridsize",
  "gridsnaponopen",
  "objectsnaponopen",
  "statusbarvisible",
  "toolbarvisible",
  "lefttoolbarpinned",
  "toptoolbarpinned",
  "righttoolbarpinned",
  "bottomtoolbarpinned",
  "toolbars_unpinned_last_save",
  "tallnewobj",
  "boxanimatetime",
  "enablehscroll",
  "enablevscroll",
  "devicewidth",
  "description",
  "digest",
  "tags",
  "style",
  "subpatcher_template",
  "title",
  "boxes",
  "lines",
  "dependency_cache",
  "latency",
  "project",
  "autosave",
];

export const BOX_KEY_ORDER: readonly string[] = [
  "id",
  "maxclass",
  "text",
  "varname",
  "numinlets",
  "numoutlets",
  "outlettype",
  "saved_object_attributes",
  "patching_rect",
  "presentation",
  "presentation_rect",
];

// Max writes destination before source
export const PATCHLINE_KEY_ORDER: readonly string[] = [
  "destination",
  "source",
  "order",
];

// Known patcher-level fields that map to patcherMeta named fields.
export const PATCHER_META_KNOWN_FIELDS = new Set(["rect", "appversion"]);

// Fields handled explicitly by denormalize — excluded from passthrough to avoid double-writing.
export const PATCHER_STRUCTURAL_FIELDS = new Set(["boxes", "lines"]);
