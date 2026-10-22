export const vertexShader = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 2D simplex noise: three corner gradients and a single permute chain, against
// four corners and a three-deep chain for the 3D variant this replaced.
export const snoise2D = `
  //
  // Description : Array and textureless GLSL 2D simplex noise function.
  //      Author : Ian McEwan, Ashima Arts.
  //  Maintainer : stegu
  //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
  //               Distributed under the MIT License.
  //               https://github.com/ashima/webgl-noise
  //               https://github.com/stegu/webgl-noise
  //

  vec3 permute(vec3 x) { return mod(((x*34.0)+10.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// Uniform sources:
//   - terrain / lines groups: topo.config.js, copied by syncConfig in topo.js
//   - lineColor, terrainHsl: CSS custom properties in _sass/_topography.scss
//   - time, resolution, pixelRatio: set per frame / on resize in topo.js
// BASE_OCTAVES is a loop bound, so it is a #define supplied by the material
// rather than a uniform.
export const fragmentShader = `
  uniform vec3 lineColor;
  uniform vec3 terrainHsl;     // base ground color, sRGB as hue/saturation/lightness
  uniform float time;
  uniform vec2 resolution;
  uniform float pixelRatio;

  // terrain
  uniform float terrainScale;
  uniform float terrainLacunarity;
  uniform float terrainGain;
  uniform float contrast;
  uniform float lightnessRange; // lightness shift (0..1) at the highest/lowest ground
  // lines
  uniform float contourDrift;
  uniform float levels;
  uniform float indexEvery;
  uniform vec2 lineWidth;      // x: normal, y: index

  // HSL (hue 0..1), so height changes true lightness and leaves hue and
  // saturation alone.
  vec3 hsl2rgb(vec3 hsl) {
    vec3 sector = mod(vec3(0.0, 8.0, 4.0) + hsl.x * 12.0, 12.0);
    float chroma = hsl.y * min(hsl.z, 1.0 - hsl.z);
    return hsl.z - chroma * clamp(min(sector - 3.0, 9.0 - sector), -1.0, 1.0);
  }

  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  float fbm(vec2 coord) {
    float amplitude = 0.5;
    float sum = 0.0;
    float totalAmplitude = 0.0;
    for (int i = 0; i < BASE_OCTAVES; i++) {
      sum += amplitude * snoise(coord);
      totalAmplitude += amplitude;
      coord = ROT * coord * terrainLacunarity;
      amplitude *= terrainGain;
    }
    return sum / totalAmplitude;
  }

  float elevation(vec2 coord) {
    float normalised = clamp(fbm(coord) * 0.5 + 0.5, 0.0, 1.0);
    return pow(normalised, contrast);
  }

  void main() {
    // Centred origin, but scaled in CSS pixels: feature size and contour
    // spacing then stay constant across viewports instead of the whole
    // landscape zooming to fit the short edge (which crushed it on phones).
    vec2 pixelPosition = (gl_FragCoord.xy - 0.5 * resolution.xy) / pixelRatio;
    vec2 terrainCoord = pixelPosition * terrainScale;

    float height = elevation(terrainCoord);

    // Drifting the band coordinate itself walks every contour across the
    // slopes: rings collapse into peaks and vanish, new ones open in the
    // basins. Costs one add and does most of the work of making this feel
    // alive. Kept slow -- it also cycles which lines count as index contours
    // below, and that wants to read as ambient rather than as a flicker.
    float contourCoord = height * levels + time * contourDrift;

    // Screen-space anti-aliased line rendering
    float contourSlope = max(length(vec2(dFdx(contourCoord), dFdy(contourCoord))), 1e-5);
    float pixelDistance = abs(fract(contourCoord - 0.5) - 0.5) / contourSlope;

    float isIndex = 1.0 - step(0.5, mod(floor(contourCoord + 0.5), indexEvery));
    float halfWidth = mix(lineWidth.x, lineWidth.y, isIndex);
    float line = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, pixelDistance);

    // Ground color: base lightness shifted up on high ground, down on low.
    // Uses height, not contourCoord, so it stays put while the contours drift.
    vec3 hsl = terrainHsl;
    hsl.z = clamp(hsl.z + (height - 0.5) * 2.0 * lightnessRange, 0.0, 1.0);
    vec3 ground = hsl2rgb(hsl);

    gl_FragColor = vec4(mix(ground, lineColor, line), 1.0);
  }
`;
