import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import config from "./topo.config.js";
import { vertexShader, snoise2D, fragmentShader } from "./topo.shader.js";

const container = document.getElementById("topography-bg");

// uniform name -> [config group, key]. Adding a setting: config key, a line
// here, and the uniform declaration in topo.shader.js.
const CONFIG_UNIFORMS = {
  terrainScale: ["terrain", "scale"],
  terrainLacunarity: ["terrain", "lacunarity"],
  terrainGain: ["terrain", "gain"],
  contrast: ["terrain", "contrast"],
  lightnessRange: ["terrain", "lightnessRange"],
  contourDrift: ["lines", "contourDrift"],
  levels: ["lines", "levels"],
  indexEvery: ["lines", "indexEvery"],
  lineWidth: ["lines", "width"],
};

function cssColor(el, name, fallback) {
  const css = getComputedStyle(el).getPropertyValue(name).trim();
  return new THREE.Color(css || fallback);
}

// The shader writes straight to the canvas, so colors must be raw sRGB values
// (not three's linear working space) to match the CSS exactly.
function lineColor(el) {
  return cssColor(el, "--contour-color", "#ffffff").convertLinearToSRGB();
}

// Terrain color as sRGB hue/saturation/lightness (each 0..1). The shader
// shifts the lightness per pixel, so the conversion is done once here.
function terrainHsl(el) {
  const hsl = cssColor(el, "--terrain-color", "#808080").getHSL({}, THREE.SRGBColorSpace);
  return new THREE.Vector3(hsl.h, hsl.s, hsl.l);
}

function init(mount) {
  let pixelRatio = Math.min(window.devicePixelRatio, config.render.pixelRatioCap);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false });
  renderer.setPixelRatio(pixelRatio);

  // Config-driven uniforms start from the config value; arrays become vec2.
  const configUniforms = Object.fromEntries(
    Object.entries(CONFIG_UNIFORMS).map(([name, [group, key]]) => {
      const v = config[group][key];
      return [name, { value: Array.isArray(v) ? new THREE.Vector2(...v) : v }];
    }),
  );
  const material = new THREE.ShaderMaterial({
    defines: { BASE_OCTAVES: config.terrain.octaves },
    uniforms: {
      ...configUniforms,
      lineColor: { value: lineColor(mount) },
      terrainHsl: { value: terrainHsl(mount) },
      time: { value: 0 },
      resolution: { value: new THREE.Vector2() },
      pixelRatio: { value: pixelRatio },
    },
    vertexShader,
    fragmentShader: snoise2D + fragmentShader,
    depthWrite: false,
    extensions: { derivatives: true },
  });

  // Copies config into the shader. Re-run after editing config; changing the
  // octave count also needs material.needsUpdate (it is a #define).
  function syncConfig() {
    material.defines.BASE_OCTAVES = config.terrain.octaves;
    for (const [name, [group, key]] of Object.entries(CONFIG_UNIFORMS)) {
      const v = config[group][key];
      const uniform = material.uniforms[name];
      if (Array.isArray(v)) uniform.value.set(...v);
      else uniform.value = v;
    }
  }
  syncConfig();

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  mount.appendChild(renderer.domElement);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function resize() {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height);
    material.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);

    if (reducedMotion.matches) renderer.render(scene, camera);
  }
  resize();
  window.addEventListener("resize", resize);

  let lastRender = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastRender < 1000 / config.render.fps) return;
    lastRender = now;

    material.uniforms.time.value = now / 1000;
    renderer.render(scene, camera);
  }

  if (!reducedMotion.matches) {
    requestAnimationFrame(frame);
  } else {
    renderer.render(scene, camera);
  }

  // Apply an edited config to the running animation (e.g. from the local tuning panel).
  function update() {
    const recompile = material.defines.BASE_OCTAVES !== config.terrain.octaves;
    syncConfig();
    if (recompile) material.needsUpdate = true;

    const ratio = Math.min(window.devicePixelRatio, config.render.pixelRatioCap);
    if (ratio !== pixelRatio) {
      pixelRatio = ratio;
      renderer.setPixelRatio(ratio);
      material.uniforms.pixelRatio.value = ratio;
      resize();
    }
    if (reducedMotion.matches) renderer.render(scene, camera);
  }

  return update;
}

if (container) {
  const update = init(container);

  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    import("./topo.debug.js")
      .then((m) => m.default(config, update))
      .catch(() => { }); // panel file is local-only and may be absent
  }
}