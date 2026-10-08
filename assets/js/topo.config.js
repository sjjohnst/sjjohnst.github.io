// Tunable settings for the topographic background.
// Vec2 values are [x, y]. Octave counts recompile the shader; the rest are
// plain uniforms. The octave rotation lives in topo.shader.js.
export default {
  terrain: {
    scale: 0.0019,
    octaves: 5,
    lacunarity: 1.93,
    gain: 0.45,
    contrast: 2,
    shade: 0.15
  },
  motion: {
    contourDrift: 0.068
  },
  lines: {
    levels: 25,
    indexEvery: 7,
    width: [0.45, 1]
  },
  render: {
    fps: 30,
    pixelRatioCap: 10.0
  }
};

