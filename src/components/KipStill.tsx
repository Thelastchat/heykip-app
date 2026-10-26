// Temporary still Kip. Step 2 replaces this with the jelly <Kip mood size /> component.
import { Image } from 'expo-image';

export function KipStill({ size }: { size: number }) {
  return (
    <Image
      source={require('@/assets/kip/kip-with-eyes.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Kip"
    />
  );
}
