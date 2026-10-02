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
    defines: { BASE_OCTAVES: config.terrain.octaves, RIDGE_OCTAVES: config.ridges.octaves },
    uniforms: {
      color: { value: contourColor(mount) },
      time: { value: 0 },
      resolution: { value: v2() },
      pixelRatio: { value: pixelRatio },
      terrainScale: { value: 0 },
      terrainLacunarity: { value: 0 },
      terrainGain: { value: 0 },
      terrainDrift: { value: v2() },
      contrast: { value: 0 },
      ridgeScale: { value: 0 },
      ridgeStrength: { value: 0 },
      ridgeLacunarity: { value: 0 },
      ridgeGain: { value: 0 },
      ridgeDrift: { value: v2() },
      maskFloor: { value: 0 },
      maskRange: { value: v2() },
      warpScale: { value: 0 },
      warpStrength: { value: 0 },
      warpDrift: { value: v2() },
      pan: { value: v2() },
      contourDrift: { value: 0 },
      levels: { value: 0 },
      indexEvery: { value: 0 },
      lineWidth: { value: v2() },
      lineOpacity: { value: v2() },
      steepFade: { value: v2() },
      washRange: { value: v2() },
      washOpacity: { value: 0 },
    },
    vertexShader,
    fragmentShader: snoise2D + fragmentShader,
    transparent: true,
    depthWrite: false,
    extensions: { derivatives: true },
  });

  // Copies config into the shader. Re-run after editing config; changing an
  // octave count also needs material.needsUpdate (it is a #define).
  function syncConfig() {
    const { terrain, ridges, warp, motion, lines } = config;
    const u = material.uniforms;
    material.defines.BASE_OCTAVES = terrain.octaves;
    material.defines.RIDGE_OCTAVES = ridges.octaves;
    u.terrainScale.value = terrain.scale;
    u.terrainLacunarity.value = terrain.lacunarity;
    u.terrainGain.value = terrain.gain;
    u.terrainDrift.value.set(...terrain.drift);
    u.contrast.value = terrain.contrast;
    u.ridgeScale.value = ridges.scale;
    u.ridgeStrength.value = ridges.strength;
    u.ridgeLacunarity.value = ridges.lacunarity;
    u.ridgeGain.value = ridges.gain;
    u.ridgeDrift.value.set(...ridges.drift);
    u.maskFloor.value = ridges.maskFloor;
    u.maskRange.value.set(...ridges.maskRange);
    u.warpScale.value = warp.scale;
    u.warpStrength.value = warp.strength;
    u.warpDrift.value.set(...warp.drift);
    u.pan.value.set(...motion.pan);
    u.contourDrift.value = motion.contourDrift;
    u.levels.value = lines.levels;
    u.indexEvery.value = lines.indexEvery;
    u.lineWidth.value.set(...lines.width);
    u.lineOpacity.value.set(...lines.opacity);
    u.steepFade.value.set(...lines.steepFade);
    u.washRange.value.set(...lines.washRange);
    u.washOpacity.value = lines.washOpacity;
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
    const recompile =
      material.defines.BASE_OCTAVES !== config.terrain.octaves ||
      material.defines.RIDGE_OCTAVES !== config.ridges.octaves;
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