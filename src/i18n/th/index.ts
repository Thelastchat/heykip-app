// Every Thai line, merged. Each area keeps its own file so they can be written side by side.
import history from './history';
import home from './home';
import moneyin from './moneyin';
import safety from './safety';
import money from './money';
import setup1 from './setup1';
import setup2 from './setup2';
import privacy from './privacy';
import slips from './slips';
import talk from './talk';

export const TH: Record<string, string> = { ...home, ...money, ...talk, ...setup1, ...setup2, ...slips, ...privacy, ...history, ...moneyin, ...safety };
