import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import config from "./topo.config.js";
import { vertexShader, snoise2D, fragmentShader } from "./topo.shader.js";

const container = document.getElementById("topography-bg");

function contourColor(el) {
  const css = getComputedStyle(el).getPropertyValue("--contour-color").trim();
  return new THREE.Color(css || "#ffffff");
}

function init(mount) {
  const pixelRatio = Math.min(window.devicePixelRatio, config.render.pixelRatioCap);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(pixelRatio);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: contourColor(mount) },
      time: { value: 0 },
      resolution: { value: new THREE.Vector2() },
      pixelRatio: { value: pixelRatio },
    },
    vertexShader,
    fragmentShader: snoise2D + fragmentShader,
    transparent: true,
    depthWrite: false,
    extensions: { derivatives: true },
  });

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

  const minFrameTime = 1000 / config.render.fps;
  let lastRender = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastRender < minFrameTime) return;
    lastRender = now;

    material.uniforms.time.value = now / 1000;
    renderer.render(scene, camera);
  }

  if (!reducedMotion.matches) {
    requestAnimationFrame(frame);
  } else {
    renderer.render(scene, camera);
  }
}

if (container) {
  init(container);
}