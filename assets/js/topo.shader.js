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

// Every uniform below is driven by topo.config.js (see syncConfig in topo.js).
// BASE_OCTAVES is a loop bound, so it is a #define supplied by the material
// rather than a uniform.
export const fragmentShader = `
  uniform vec3 color;
  uniform vec3 terrainColor;   // sRGB base ground colour
  uniform float time;
  uniform vec2 resolution;
  uniform float pixelRatio;

  // terrain
  uniform float terrainScale;
  uniform float terrainLacunarity;
  uniform float terrainGain;
  uniform float contrast;
  uniform float shade;         // lightness shift (0..1) at the highest/lowest ground
  // motion
  uniform float contourDrift;
  // lines
  uniform float levels;
  uniform float indexEvery;
  uniform vec2 lineWidth;      // x: normal, y: index

  // HSL, so height changes true lightness and leaves hue/saturation alone.
  vec3 rgb2hsl(vec3 c) {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float d = mx - mn;
    float l = (mx + mn) * 0.5;
    if (d < 1e-5) return vec3(0.0, 0.0, l);
    float s = d / (1.0 - abs(2.0 * l - 1.0));
    float hue = mx == c.r ? mod((c.g - c.b) / d, 6.0)
              : mx == c.g ? (c.b - c.r) / d + 2.0
              : (c.r - c.g) / d + 4.0;
    return vec3(hue, s, l);
  }

  vec3 hsl2rgb(vec3 c) {
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + c.x * 2.0, 12.0);
    float a = c.y * min(c.z, 1.0 - c.z);
    return c.z - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
  }

  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  float fbm(vec2 p) {
    float amp = 0.5;
    float sum = 0.0;
    float norm = 0.0;
    for (int i = 0; i < BASE_OCTAVES; i++) {
      sum += amp * snoise(p);
      norm += amp;
      p = ROT * p * terrainLacunarity;
      amp *= terrainGain;
    }
    return sum / norm;
  }

  float elevation(vec2 q) {
    float h = clamp(fbm(q) * 0.5 + 0.5, 0.0, 1.0);
    return pow(h, contrast);
  }

  void main() {
    // Centred origin, but scaled in CSS pixels: feature size and contour
    // spacing then stay constant across viewports instead of the whole
    // landscape zooming to fit the short edge (which crushed it on phones).
    vec2 st = (gl_FragCoord.xy - 0.5 * resolution.xy) / pixelRatio;
    vec2 q = st * terrainScale;

    // Drifting the band coordinate itself walks every contour across the
    // slopes: rings collapse into peaks and vanish, new ones open in the
    // basins. Costs one add and does most of the work of making this feel
    // alive. Kept slow -- it also cycles which lines count as index contours
    // below, and that wants to read as ambient rather than as a flicker.
    float h = elevation(q);
    float e = h * levels + time * contourDrift;

    // Screen-space anti-aliased line rendering
    float g = max(length(vec2(dFdx(e), dFdy(e))), 1e-5);
    float d = abs(fract(e - 0.5) - 0.5) / g;

    float isIndex = 1.0 - step(0.5, mod(floor(e + 0.5), indexEvery));
    float halfWidth = mix(lineWidth.x, lineWidth.y, isIndex);
    float line = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, d);

    // Ground colour: base lightness shifted up on high ground, down on low.
    // Uses h, not e, so it stays put while the contours drift.
    vec3 hsl = rgb2hsl(terrainColor);
    hsl.z = clamp(hsl.z + (h - 0.5) * 2.0 * shade, 0.0, 1.0);
    vec3 ground = hsl2rgb(hsl);

    gl_FragColor = vec4(mix(ground, color, line), 1.0);
  }
`;
