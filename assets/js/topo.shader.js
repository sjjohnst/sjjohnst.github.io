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

export const fragmentShader = `
  uniform vec3 color;
  uniform float time;
  uniform vec2 resolution;
  uniform float pixelRatio;

  #define BASE_OCTAVES 4
  #define RIDGE_OCTAVES 3

  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  // Each octave gets its own drift velocity, so they slide across one another
  // rather than in lockstep. That is what makes the field genuinely change
  // shape over time -- a single shared offset would only translate the image.
  float fbm(vec2 p) {
    float amp = 0.5;
    float sum = 0.0;
    float norm = 0.0;
    vec2 drift = vec2(0.030, 0.012);
    for (int i = 0; i < BASE_OCTAVES; i++) {
      sum += amp * snoise(p + drift * time);
      norm += amp;
      p = ROT * p * 2.05;
      drift = ROT * drift * -0.7;
      amp *= 0.50;
    }
    return sum / norm;
  }

  float ridge(vec2 p) {
    float amp = 0.5;
    float sum = 0.0;
    float norm = 0.0;
    float weight = 1.0;
    vec2 drift = vec2(-0.018, 0.021);
    for (int i = 0; i < RIDGE_OCTAVES; i++) {
      float n = 1.0 - abs(snoise(p + drift * time));
      n *= n;
      n *= weight;
      weight = clamp(n * 2.0, 0.0, 1.0);
      sum += amp * n;
      norm += amp;
      p = ROT * p * 2.15;
      drift = ROT * drift * -0.7;
      amp *= 0.48;
    }
    return sum / norm;
  }

  float elevation(vec2 q) {
    // Only a hint of bulk pan -- the flow comes from the per-octave drift and
    // the warp below, not from sliding the whole landscape past the viewport.
    vec2 p = q + vec2(time * 0.007, time * 0.0035);

    // Subtle domain warp, moving on its own heading so it flows across the base
    // field rather than travelling with it.
    vec2 w = p * 1.2 + vec2(time * 0.05, time * -0.03);
    p += vec2(snoise(w), snoise(w + vec2(13.4, 7.1))) * 0.18;

    float base = fbm(p) * 0.5 + 0.5;
    float crests = ridge(p * 1.5 + vec2(5.2, 1.3));

    // Floor the mask so low country keeps some roughness; at zero there was a
    // visible seam between rough high ground and smooth basins.
    float mask = 0.25 + 0.75 * smoothstep(0.30, 0.75, base);
    float h = clamp(base * 0.65 + crests * 0.35 * mask, 0.0, 1.0);

    return pow(h, 1.1);
  }

  void main() {
    const float levels = 24.0;
    const float indexEvery = 5.0;

    // Centred origin, but scaled in CSS pixels: feature size and contour
    // spacing then stay constant across viewports instead of the whole
    // landscape zooming to fit the short edge (which crushed it on phones).
    vec2 st = (gl_FragCoord.xy - 0.5 * resolution.xy) / pixelRatio;
    vec2 q = st * 0.0035;

    // Drifting the band coordinate itself walks every contour across the
    // slopes: rings collapse into peaks and vanish, new ones open in the
    // basins. Costs one add and does most of the work of making this feel
    // alive. Kept slow -- it also cycles which lines count as index contours
    // below, and that wants to read as ambient rather than as a flicker.
    float e = elevation(q) * levels + time * 0.05;

    // Screen-space anti-aliased line rendering
    float g = max(length(vec2(dFdx(e), dFdy(e))), 1e-5);
    float d = abs(fract(e - 0.5) - 0.5) / g;

    float isIndex = 1.0 - step(0.5, mod(floor(e + 0.5), indexEvery));
    float halfWidth = mix(0.45, 0.85, isIndex);
    float line = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, d);
    line *= mix(0.70, 1.0, isIndex);

    line *= 1.0 - smoothstep(0.40, 0.85, g);
    float wash = smoothstep(0.45, 0.95, g) * 0.25;

    float alpha = max(line, wash);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;
