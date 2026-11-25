// Kip's motion, ported 1:1 from the approved canvas component (KipJelly.dc.html).
// Every function here is a worklet: it runs on the UI thread, once per frame.

export type KipMood = 'idle' | 'listen' | 'think' | 'talk' | 'happy' | 'careful' | 'celebrate';

export const KIP_MOODS: readonly KipMood[] = ['idle', 'listen', 'think', 'talk', 'happy', 'careful', 'celebrate'];

/** How Kip's jelly body is bent right now. */
export type Pose = {
  sx: number; // horizontal squash
  sy: number; // vertical stretch
  rot: number; // tilt, radians
  jump: number; // hop height, as a fraction of Kip's size
  wob: number; // strength of the wave that runs up the body
};

export const REST_POSE: Pose = { sx: 1, sy: 1, rot: 0, jump: 0, wob: 0.006 };

/** The bottom of the bean stays planted here (fraction of Kip's height). */
export const ANCHOR_Y = 0.8;

/** Kip's eyes, measured on the body artwork (fractions of the square). */
export const EYE = { left: 0.345, right: 0.555, top: 0.405, w: 0.09, h: 0.16 } as const;

export const isBouncy = (mood: KipMood) => {
  'worklet';
  return mood === 'happy' || mood === 'celebrate';
};

/** Where each mood wants Kip to be at time `t` (seconds). */
export function poseFor(t: number, mood: KipMood, seed: number): Pose {
  'worklet';
  const breath = Math.sin(t * 1.8 + seed);

  switch (mood) {
    case 'listen': {
      // Reacts to an imaginary voice level, with natural pauses.
      const level = Math.max(0, 0.5 + 0.3 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 12.1 + 1) + 0.15 * Math.sin(t * 3.1)) * (Math.sin(t * 0.9) > -0.5 ? 1 : 0.15);
      return { sx: 1 - 0.045 * level, sy: 1 + 0.03 * breath + 0.08 * level, rot: 0, jump: 0, wob: 0.01 + 0.012 * level };
    }
    case 'think':
      return { sx: 1, sy: 1 + 0.02 * Math.sin(t * 2.2), rot: 0.13 * Math.sin(t * 1.1), jump: 0, wob: 0.008 };
    case 'talk': {
      const gate = Math.sin(t * 1.7) > -0.35 ? 1 : 0;
      const beat = Math.pow(Math.max(0, Math.sin(t * 11)), 2) * gate;
      return { sx: 1 - 0.05 * beat, sy: 1 + 0.09 * beat, rot: 0.02 * Math.sin(t * 2.3), jump: 0, wob: 0.012 };
    }
    case 'happy':
    case 'celebrate': {
      // Hop, then squash on landing.
      const celebrate = mood === 'celebrate';
      const period = celebrate ? 0.8 : 0.9;
      const height = celebrate ? 0.17 : 0.13;
      const phase = (t / period) % 1;
      let jump = 0;
      let squash = 0;
      if (phase < 0.6) {
        const x = phase / 0.6;
        jump = height * 4 * x * (1 - x);
      } else {
        squash = Math.sin((Math.PI * (phase - 0.6)) / 0.4);
      }
      const air = jump / height;
      return {
        sx: 1 + 0.1 * squash - 0.03 * air,
        sy: 1 - 0.13 * squash + 0.05 * air,
        rot: celebrate ? -0.08 * air : 0,
        jump,
        wob: 0.014,
      };
    }
    case 'careful':
      return { sx: 1 - 0.012 * breath, sy: 1 + 0.018 * breath, rot: -0.07 + 0.025 * Math.sin(t * 1.2), jump: 0, wob: 0.004 };
    default:
      return { sx: 1 - 0.02 * breath, sy: 1 + 0.03 * breath, rot: 0, jump: 0, wob: 0.006 };
  }
}

/** Eye shape for a mood (fractions of Kip's square). Happy moods use smiling arcs instead. */
export type EyeShape = { w: number; h: number; top: number; dx: number; dy: number };

export function eyesFor(t: number, mood: KipMood): EyeShape {
  'worklet';
  switch (mood) {
    case 'listen':
      return { w: EYE.w + 0.01, h: EYE.h + 0.015, top: EYE.top - 0.01, dx: 0, dy: 0 };
    case 'think': {
      // Glances up and to the side, then back.
      const k = Math.min(1, Math.max(0, Math.sin(t * 0.9) * 1.6 + 0.4));
      return { w: EYE.w, h: EYE.h, top: EYE.top, dx: 0.022 * k, dy: -0.026 * k };
    }
    case 'careful':
      // Softer, smaller and lowered: concerned, never grumpy.
      return { w: EYE.w, h: EYE.h * 0.72, top: EYE.top + 0.03, dx: -0.012, dy: 0.014 };
    default:
      return { w: EYE.w, h: EYE.h, top: EYE.top, dx: 0, dy: 0 };
  }
}

/** 1 = eyes open, dips toward 0.08 during a 140 ms blink that started at `blinkAt`. */
export function blinkAmount(t: number, blinkAt: number): number {
  'worklet';
  const BLINK = 0.14;
  if (t < blinkAt || t > blinkAt + BLINK) return 1;
  return Math.max(0.08, Math.abs(Math.cos(((t - blinkAt) / BLINK) * Math.PI)));
}

/** Everything Kip remembers from one frame to the next. `clock` is Kip's own time, in seconds: it only moves forward. */
export type KipSim = { clock: number; pose: Pose; pokeAt: number; pokesSeen: number; blinkAt: number };

export function startSim(seed: number): KipSim {
  'worklet';
  return { clock: 0, pose: REST_POSE, pokeAt: -10, pokesSeen: 0, blinkAt: 1 + seed * 0.3 };
}

/**
 * One frame of Kip. `elapsedMs` is the time since the previous frame — null on the first frame of a frame callback.
 * Kip keeps his own clock instead of Reanimated's `timeSinceFirstFrame`, which starts again at 0 whenever the
 * callback is registered again (every re-render, e.g. when a sheet closes over him). With that clock going
 * backwards, a tap from before became a jiggle "in the future" and its exp() exploded, smearing Kip across his canvas.
 */
export function stepKip(s: KipSim, elapsedMs: number | null, mood: KipMood, amp: number, pokes: number, seed: number) {
  'worklet';
  const dt = Math.min(0.05, Math.max(0, (elapsedMs ?? 0) / 1000));
  const t = s.clock + dt;

  // Ease toward the mood's pose; hops follow it exactly so landings stay crisp.
  const goal = poseFor(t, mood, seed);
  const k = isBouncy(mood) ? 1 : 1 - Math.exp(-dt * 9);
  const p = s.pose;
  const pose: Pose = {
    sx: p.sx + (goal.sx - p.sx) * k,
    sy: p.sy + (goal.sy - p.sy) * k,
    rot: p.rot + (goal.rot - p.rot) * k,
    jump: p.jump + (goal.jump - p.jump) * k,
    wob: p.wob + (goal.wob - p.wob) * k,
  };

  // A tap starts a jiggle that dies away over about a second.
  const pokeAt = pokes !== s.pokesSeen ? t : s.pokeAt;
  const since = Math.max(0, t - pokeAt);
  const envelope = since < 3 ? Math.exp(-since * 4.5) : 0;
  const jiggle = Math.sin(since * 20) * envelope;
  const shown: Pose = {
    sx: 1 + (pose.sx - 1) * amp - 0.09 * jiggle * amp,
    sy: 1 + (pose.sy - 1) * amp + 0.11 * jiggle * amp,
    rot: pose.rot * amp,
    jump: pose.jump * amp,
    wob: (pose.wob + 0.03 * envelope) * amp,
  };

  // Blink every 2.6–5.2 s.
  const blinkAt = t > s.blinkAt + 0.14 ? t + 2.6 + Math.random() * 2.6 : s.blinkAt;

  return { sim: { clock: t, pose, pokeAt, pokesSeen: pokes, blinkAt } as KipSim, shown, t, blink: blinkAmount(t, blinkAt) };
}
