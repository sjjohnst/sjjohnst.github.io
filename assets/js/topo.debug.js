// Live tuning panel, loaded by topo.js on localhost only. Builds one slider
// per number in topo.config.js, so new config values appear automatically.
import GUI from "https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.esm.min.js";

// ponytail: ranges are guessed from each default (0..3x, or +-3x if negative).
// Add an explicit range table here if a slider's bounds feel wrong.
function addNumber(folder, obj, key, onChange, label = key) {
  const v = obj[key];
  const isInt = Number.isInteger(v);
  const max = Math.abs(v) * 3 || 1;
  const min = isInt ? 1 : v < 0 ? -max : 0;
  folder.add(obj, key, min, max, isInt ? 1 : max / 300).name(label).onChange(onChange);
}

function build(gui, group, onChange) {
  for (const [key, val] of Object.entries(group)) {
    if (typeof val === "number") {
      addNumber(gui, group, key, onChange);
    } else if (Array.isArray(val)) {
      const folder = gui.addFolder(key);
      val.forEach((_, i) => addNumber(folder, val, i, onChange, "xy"[i]));
    } else {
      build(gui.addFolder(key), val, onChange);
    }
  }
}

// JSON -> JS module text: unquoted keys, short arrays on one line.
function toModule(config) {
  const body = JSON.stringify(config, null, 2)
    .replace(/"(\w+)":/g, "$1:")
    .replace(/\[\s+([^[\]]*?)\s+\]/g, (_, inner) => `[${inner.replace(/\s*\n\s*/g, " ")}]`);
  return `export default ${body};\n`;
}

// Bulma and the site's styles collide with lil-gui's class names (.title,
// .number). Pin the panel's own look and use a larger font.
const style = document.createElement("style");
style.textContent = `
  .lil-gui { --font-size: 13px; --input-font-size: 13px; --name-width: 50%; }
  .lil-gui.root,
  .lil-gui.root .children { background: var(--background-color) !important; }
  /* Bulma's .number (pill badge) also matches lil-gui's .controller.number. */
  .lil-gui .controller.number {
    background: none; border-radius: 0; display: flex; font-size: inherit;
    height: auto; margin: var(--spacing) 0; min-width: 0; padding: 0 var(--padding);
  }
  .lil-gui .title,
  .lil-gui .controller .name { color: var(--text-color) !important; }
`;
document.head.append(style);

export default function (config, update) {
  const gui = new GUI({ title: "topo" });
  build(gui, config, update);
  gui.add(
    {
      copy: () => navigator.clipboard.writeText(toModule(config)),
    },
    "copy",
  ).name("Copy config");

  window.__topo = { config, update };
}
