// On web, Skia runs on CanvasKit (WebAssembly), which loads before Kip can draw.
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { KipStill } from './KipStill';
import type { KipProps } from './kip/KipJelly';

export function Kip(props: KipProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./kip/KipJelly')}
      fallback={<KipStill size={props.size ?? 160} />}
      opts={{ locateFile: () => '/canvaskit.wasm' }}
      componentProps={props}
    />
  );
}

export type { KipProps } from './kip/KipJelly';
export { KIP_MOODS, type KipMood } from './kip/motion';
