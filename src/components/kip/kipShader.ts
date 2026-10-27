import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';

// Kip is one GPU shader.
// For every pixel it works out which point of the flat artwork belongs there — the exact
// inverse of the canvas version's jelly: tilt around the planted anchor, squash/stretch,
// and a sideways wave that grows toward the top — then paints the body and the eyes there.
// Because the eyes are painted in the artwork's own coordinates, they bend with the jelly.
//
// Coordinates: `p` is in points on the canvas; (u, v) are fractions of Kip's square.
const SKSL = `
uniform shader body;      // the eyeless chrome body, filling (0,0)-(size,size)
uniform float2 anchor;    // the planted bottom point, after the hop
uniform float size;       // Kip's square side
uniform float sx;
uniform float sy;
uniform float rot;
uniform float wob;
uniform float t;
uniform float amp;
uniform float4 eye;       // width, height, top, blink (fractions; blink 1 = open)
uniform float2 look;      // where the eyes glance (fractions)
uniform float happy;      // 1 = smiling ^ ^ eyes
uniform float aa;         // one screen pixel, as a fraction of Kip's square

const float ANCHOR_Y = 0.8;
const float EYE_L = 0.345;
const float EYE_R = 0.555;
const float EYE_W = 0.09;
const float EYE_H = 0.16;
const float EYE_TOP = 0.405;

half4 over(half4 dst, half3 rgb, float a) {
  return half4(rgb * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a));
}

// Coverage of a shape from its signed distance (negative inside), anti-aliased over one pixel.
float cover(float d) {
  return clamp(0.5 - d / aa, 0.0, 1.0);
}

float sdPill(float2 p, float2 c, float2 half_size) {
  float r = min(half_size.x, half_size.y);
  float2 q = abs(p - c) - half_size + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdSegment(float2 p, float2 a, float2 b) {
  float2 pa = p - a;
  float2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Distance to the smiling arc: the same quadratic curve as the design, in 16 steps.
float sdSmile(float2 p, float cx) {
  float w = EYE_W * 1.25;
  float cy = EYE_TOP + EYE_H * 0.55;
  float2 a = float2(cx - w * 0.5, cy + w * 0.18);
  float2 c = float2(cx, cy - w * 0.62);
  float2 b = float2(cx + w * 0.5, cy + w * 0.18);
  float d = 10.0;
  float2 prev = a;
  for (int i = 1; i <= 16; i++) {
    float s = float(i) / 16.0;
    float2 pt = mix(mix(a, c, s), mix(c, b, s), s);
    d = min(d, sdSegment(p, prev, pt));
    prev = pt;
  }
  return d;
}

half4 smileEye(half4 col, float2 uv, float x) {
  float d = sdSmile(uv, x + EYE_W * 0.5);
  col = over(col, half3(1.0), 0.85 * cover(d - 0.017));
  return over(col, half3(0.145, 0.153, 0.173), cover(d - 0.0115));
}

half4 pillEye(half4 col, float2 uv, float x) {
  float w = eye.x;
  float h = eye.y * eye.w;
  float2 c = float2(x + eye.x * 0.5 + look.x, eye.z + eye.y * 0.5 + look.y);
  float top = c.y - h * 0.5;
  float d = sdPill(uv, c, float2(w, h) * 0.5);

  col = over(col, half3(1.0), 0.8 * cover(abs(d) - 0.0035));               // soft white rim
  float g = clamp((uv.y - top) / (h * 0.72), 0.0, 1.0);
  col = over(col, mix(half3(0.333, 0.353, 0.4), half3(0.169, 0.176, 0.2), g), cover(d));
  col = over(col, half3(0.11, 0.114, 0.129), cover(abs(d) - 0.003));       // dark edge

  if (eye.w > 0.5) {                                                         // shine
    float2 r = float2(w * 0.2, h * 0.09);
    float2 e = (uv - float2(c.x - w * 0.12, top + h * 0.24)) / r;
    col = over(col, half3(1.0), 0.55 * cover((length(e) - 1.0) * min(r.x, r.y)));
  }
  return col;
}

half4 main(float2 p) {
  float2 d = p - anchor;
  float c = cos(rot);
  float s = sin(rot);
  float2 l = float2(c * d.x - s * d.y, s * d.x + c * d.y);

  float q = l.y / size;
  float rise = clamp(-q / 0.6, 0.0, 1.0);
  float dx = sin(q * 9.0 - t * 5.0) * wob * rise + sin(q * 22.0 + t * 3.1) * 0.0015 * amp;

  float2 uv = float2((l.x / size - dx) / sx + 0.5, l.y / (sy * size) + ANCHOR_Y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return half4(0.0);
  }

  half4 col = body.eval(uv * size);
  if (col.a < 0.004) {
    return col;
  }
  if (happy > 0.5) {
    return smileEye(smileEye(col, uv, EYE_L), uv, EYE_R);
  }
  return pillEye(pillEye(col, uv, EYE_L), uv, EYE_R);
}
`;

let effect: SkRuntimeEffect | undefined;

/** Compiled once, on first use (Skia may not be ready at import time on web). */
export function kipShader(): SkRuntimeEffect {
  if (!effect) {
    const made = Skia.RuntimeEffect.Make(SKSL);
    if (!made) throw new Error('Kip shader failed to compile');
    effect = made;
  }
  return effect;
}
