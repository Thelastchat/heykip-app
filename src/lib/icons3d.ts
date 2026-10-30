// The yellow 3D icon set (tinted to the brand lime, 58°). One image per kind of money.
import type { ImageSourcePropType } from 'react-native';

import type { CatKey } from '@/lib/budget';

export const ICON3D = {
  bowl: require('../../assets/icons3d/bowl.png'),
  car: require('../../assets/icons3d/car.png'),
  shop: require('../../assets/icons3d/shop.png'),
  heart: require('../../assets/icons3d/heart.png'),
  house: require('../../assets/icons3d/house.png'),
  bill: require('../../assets/icons3d/bill.png'),
  income: require('../../assets/icons3d/income.png'),
  expense: require('../../assets/icons3d/expense.png'),
  piggy: require('../../assets/icons3d/piggy.png'),
  shield: require('../../assets/icons3d/shield.png'),
  plane: require('../../assets/icons3d/plane.png'),
  phone: require('../../assets/icons3d/phone.png'),
  fun: require('../../assets/icons3d/fun.png'), // stand-in until the real Fun icon is made
} satisfies Record<string, ImageSourcePropType>;

export type Icon3D = keyof typeof ICON3D;

/** The 3D icon for each spending category. */
export const CAT_ICON3D: Record<CatKey, Icon3D> = {
  food: 'bowl',
  transport: 'car',
  shopping: 'shop',
  fun: 'fun',
  health_beauty: 'heart',
  learning: 'phone',
  giving: 'piggy',
  other: 'bill',
  spend_freely: 'expense',
};

/** The 3D icon on a goal card, by goal kind. */
export function goalIcon3D(kind: string | null | undefined): Icon3D {
  if (kind === 'trip') return 'plane';
  if (kind === 'gadget') return 'phone';
  if (kind === 'car') return 'car';
  if (kind === 'home') return 'house';
  if (kind === 'safety_net') return 'shield';
  return 'piggy';
}
