// HeyKip in English and Thai.
//
//   t('Left today')                                → "ใช้ได้อีกวันนี้" in Thai
//   t('{n} days left', { n: 5 })                   → "เหลืออีก 5 วัน"
//   rich('That moves {goal} **{when}**.', { goal, when }, (s) => <Text style={bold}>{s}</Text>)
//
// The English sentence IS the key, so English never changes and a missing Thai line simply shows English.
// Thai lines live in src/i18n/th/*.ts. Never call t() at the top level of a file (it would run before the
// language is known) — call it inside components or functions, or use a getter: `get name() { return t('Food') }`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { TH } from '@/i18n/th';

export type Lang = 'en' | 'th';
let current: Lang = 'en';
export const getLang = () => current;

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

/** Translate one sentence. {name} parts are filled from vars. */
export function t(en: string, vars?: Record<string, string | number>): string {
  return fill(current === 'th' ? (TH[en] ?? en) : en, vars);
}

/** Translate a sentence with **bold** parts, rendered by `bold`. */
export function rich(en: string, vars: Record<string, string | number> | undefined, bold: (s: string, i: number) => ReactNode): ReactNode[] {
  return t(en, vars)
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => (i % 2 ? <Fragment key={i}>{bold(part, i)}</Fragment> : part));
}

// ---------- dates ----------
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTHS_LONG_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** "Dec" / "ธ.ค." */
export const monthShort = (m: number) => (current === 'th' ? MONTHS_TH : MONTHS_EN)[m];
/** "December" / "ธันวาคม" */
export const monthLong = (m: number) => (current === 'th' ? MONTHS_LONG_TH : MONTHS_LONG_EN)[m];
/** "Tue" / "อ." (0 = Sunday) */
export const dayShort = (d: number) => (current === 'th' ? DAYS_TH : DAYS_EN)[d];

/** Years: Buddhist era (2570) in Thai, or when the phone uses the Buddhist calendar. */
const PHONE_BUDDHIST = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-localization').getCalendars()[0]?.calendar === 'buddhist';
  } catch {
    return false;
  }
})();
export const shownYear = (d: Date) => d.getFullYear() + (current === 'th' || PHONE_BUDDHIST ? 543 : 0);

// ---------- choosing the language ----------
const KEY = 'heykip.lang';
const phoneLang = (): Lang => {
  try {
    return getLocales()[0]?.languageCode === 'th' ? 'th' : 'en';
  } catch {
    return 'en';
  }
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangContext);

/** Loads the saved language (or the phone's) before showing anything; changing it redraws the whole app. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((v) => {
        const l: Lang = v === 'th' || v === 'en' ? v : phoneLang();
        current = l;
        setState(l);
      });
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l;
    AsyncStorage.setItem(KEY, l).catch(() => {});
    setState(l);
  }, []);
  if (!lang) return null;
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  );
}
