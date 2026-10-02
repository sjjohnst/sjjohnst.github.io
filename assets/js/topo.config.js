// Tunable settings for the topographic background.
// Vec2 values are [x, y]. Octave counts recompile the shader; the rest are
// plain uniforms. A few constants (domain-warp offsets, the per-octave drift
// turn of -0.7) stay inside topo.shader.js.
export default {
  terrain: {
    scale: 0.0035, // CSS px -> noise space; smaller = bigger landforms
    octaves: 4,
    lacunarity: 2.05, // frequency multiplier per octave
    gain: 0.5, // amplitude multiplier per octave
    drift: [0.03, 0.012], // first-octave drift velocity
    contrast: 1.1, // pow() applied to final height
  },
  ridges: {
    scale: 1.5, // ridge frequency relative to terrain
    strength: 0.35, // blend of ridges into the base terrain
    octaves: 3,
    lacunarity: 2.15,
    gain: 0.48,
    drift: [-0.018, 0.021],
    maskFloor: 0.25, // ridge amount kept in low ground (0 = smooth basins)
    maskRange: [0.3, 0.75], // base height over which ridges fade in
  },
  warp: {
    scale: 1.2,
    strength: 0.18,
    drift: [0.05, -0.03],
  },
  motion: {
    pan: [0.007, 0.0035], // whole-landscape drift
    contourDrift: 0.05, // contour bands per second; also cycles index lines
  },
  lines: {
    levels: 24, // contour bands across the height range
    indexEvery: 5, // every nth contour is a bolder index line
    width: [0.45, 0.85], // [normal, index] in px
    opacity: [0.7, 1.0], // [normal, index]
    steepFade: [0.4, 0.85], // gradient range where lines fade out
    washRange: [0.45, 0.95], // gradient range where the wash fades in
    washOpacity: 0.25,
  },
  render: {
    fps: 30, // frame-rate cap
    pixelRatioCap: 1.5, // cap devicePixelRatio for performance
  },
};
