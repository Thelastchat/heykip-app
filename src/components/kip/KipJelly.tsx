import { BlurMask, Canvas, FilterMode, ImageShader, MipmapMode, Oval, Rect, Shader, useImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { PixelRatio, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { kipShader } from './kipShader';
import { ANCHOR_Y, REST_POSE, eyesFor, isBouncy, plainEyes, startSim, stepKip, type KipMood, type KipSim, type Pose } from './motion';

export type KipProps = {
  mood?: KipMood;
  /** Kip's on-screen size in points. He hops and wobbles a little outside this box. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Same eyes whatever the mood: they look around, never smile or droop (the chat, approved 28 Nov). */
  plain?: boolean;
  /** A soft shadow on the ground under Kip; it shrinks and fades when he hops. */
  shadow?: boolean;
};

const body = require('@/assets/kip/kip-body.png');
const sampling = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };

/**
 * Kip, alive. One chrome body with the eyes painted in code, bent like jelly on the GPU.
 * Breathes, blinks, wobbles, hops when happy, and jiggles when you tap him.
 */
export default function KipJelly({ mood = 'idle', size = 160, style, plain = false, shadow = false }: KipProps) {
  const image = useImage(body);
  const reduceMotion = useReducedMotion();
  const [seed] = useState(() => Math.random() * 10);

  // The canvas is 150% of the box so Kip has room to hop and wobble;
  // Kip himself fills 66% of it — the same proportions as the design.
  // Snapped to whole device pixels so the canvas edge never lands between pixels.
  const C = PixelRatio.roundToNearestPixel(size * 1.5);
  const D = C * 0.66;
  const inset = PixelRatio.roundToNearestPixel(size * 0.25);
  const pixel = 1 / (D * PixelRatio.get());

  // JS → UI thread.
  const moodSV = useSharedValue<KipMood>(mood);
  const ampSV = useSharedValue(reduceMotion ? 0.35 : 1);
  const pokes = useSharedValue(0);
  useEffect(() => moodSV.set(mood), [mood, moodSV]);
  useEffect(() => ampSV.set(reduceMotion ? 0.35 : 1), [reduceMotion, ampSV]);

  // Everything the shader needs, recomputed every frame on the UI thread.
  const sim = useSharedValue<KipSim>(startSim(seed));
  const uniforms = useSharedValue(shaderInputs(REST_POSE, 0, 1, eyesFor(0, mood), 1, false));

  useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    const m = moodSV.value;
    const amp = ampSV.value;
    const next = stepKip(sim.value, timeSincePreviousFrame, m, amp, pokes.value, seed);
    uniforms.value = shaderInputs(next.shown, next.t, amp, plain ? plainEyes(next.t, seed) : eyesFor(next.t, m), next.blink, !plain && isBouncy(m));
    sim.value = next.sim;
  });

  // Same values, placed on this canvas.
  const placed = useDerivedValue(() => {
    const u = uniforms.value;
    return { ...u, anchor: [C / 2, C / 2 + (ANCHOR_Y - 0.5) * D - u.jump * D], size: D, aa: pixel };
  });

  // The ground shadow: under Kip's base, smaller and lighter the higher he is.
  const ground = C / 2 + (ANCHOR_Y - 0.5) * D + 0.15 * D;
  const shade = useDerivedValue(() => {
    const up = Math.min(1, uniforms.value.jump * 3);
    const w = D * 0.5 * (1 - 0.35 * up);
    const h = D * 0.075 * (1 - 0.35 * up);
    return { x: C / 2 - w / 2, y: ground - h / 2, width: w, height: h };
  });
  const shadeOpacity = useDerivedValue(() => 0.32 * (1 - 0.5 * Math.min(1, uniforms.value.jump * 3)));

  return (
    <View style={[{ width: size, height: size }, style]} onTouchStart={() => pokes.set(pokes.get() + 1)} accessible accessibilityRole="image" accessibilityLabel="Kip">
      <View pointerEvents="none" style={{ position: 'absolute', left: -inset, top: -inset }}>
        <Canvas style={{ width: C, height: C }}>
          {shadow && (
            <Oval rect={shade} color="#3A3F5C" opacity={shadeOpacity}>
              <BlurMask blur={D * 0.035} style="normal" />
            </Oval>
          )}
          {image && (
            <Rect x={0} y={0} width={C} height={C}>
              <Shader source={kipShader()} uniforms={placed}>
                <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width: D, height: D }} tx="clamp" ty="clamp" sampling={sampling} />
              </Shader>
            </Rect>
          )}
        </Canvas>
      </View>
    </View>
  );
}

/** Pose + eyes → the shader's uniforms (minus placement, which depends on the canvas). */
function shaderInputs(pose: Pose, t: number, amp: number, e: { w: number; h: number; top: number; dx: number; dy: number }, blink: number, happy: boolean) {
  'worklet';
  return {
    sx: pose.sx,
    sy: pose.sy,
    rot: pose.rot,
    wob: pose.wob,
    jump: pose.jump,
    t,
    amp,
    eye: [e.w, e.h, e.top, blink],
    look: [e.dx, e.dy],
    happy: happy ? 1 : 0,
  };
}
