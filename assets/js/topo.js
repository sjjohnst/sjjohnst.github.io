import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import config from "./topo.config.js";
import { vertexShader, snoise2D, fragmentShader } from "./topo.shader.js";

const container = document.getElementById("topography-bg");

function contourColor(el) {
  const css = getComputedStyle(el).getPropertyValue("--contour-color").trim();
  return new THREE.Color(css || "#ffffff");
}

function init(mount) {
  let pixelRatio = Math.min(window.devicePixelRatio, config.render.pixelRatioCap);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(pixelRatio);

  const v2 = () => new THREE.Vector2();
  const material = new THREE.ShaderMaterial({
    defines: { BASE_OCTAVES: config.terrain.octaves },
    uniforms: {
      color: { value: contourColor(mount) },
      time: { value: 0 },
      resolution: { value: v2() },
      pixelRatio: { value: pixelRatio },
      terrainScale: { value: 0 },
      terrainLacunarity: { value: 0 },
      terrainGain: { value: 0 },
      contrast: { value: 0 },
      contourDrift: { value: 0 },
      levels: { value: 0 },
      indexEvery: { value: 0 },
      lineWidth: { value: v2() },
    },
    vertexShader,
    fragmentShader: snoise2D + fragmentShader,
    transparent: true,
    depthWrite: false,
    extensions: { derivatives: true },
  });

  // Copies config into the shader. Re-run after editing config; changing the
  // octave count also needs material.needsUpdate (it is a #define).
  function syncConfig() {
    const { terrain, motion, lines } = config;
    const u = material.uniforms;
    material.defines.BASE_OCTAVES = terrain.octaves;
    u.terrainScale.value = terrain.scale;
    u.terrainLacunarity.value = terrain.lacunarity;
    u.terrainGain.value = terrain.gain;
    u.contrast.value = terrain.contrast;
    u.contourDrift.value = motion.contourDrift;
    u.levels.value = lines.levels;
    u.indexEvery.value = lines.indexEvery;
    u.lineWidth.value.set(...lines.width);
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

  // Apply an edited config to the running animation (used by topo.debug.js).
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

  // Tuning panel: dev server only, never loaded for visitors.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    import("./topo.debug.js").then((m) => m.default(config, update));
  }
}