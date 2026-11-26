// People's own categories ("Create your own", approved mockup). Each one is a row in their categories table
// (key `c_` + a short id, a name, one of the 3D icons, need or want). Once loaded they're added to the same tables the
// built-in ones use (CATEGORY, CAT_ICON3D, DB_CAT_NAME), so every screen, sheet and Kip treats them like any other.
import { useEffect, useState } from 'react';

import { CATEGORY, isCustom, type CustomCat } from '@/lib/budget';
export { addToMonth, defaultFrom } from '@/lib/budget';
import { CAT_ICON3D, ICON3D, type Icon3D } from '@/lib/icons3d';
import { DB_CAT_NAME } from '@/lib/kip';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export type Custom = { id: string; key: CustomCat; name: string; icon: Icon3D; need: boolean };

/** The icons someone can pick for their own category (the whole yellow set). */
export const PICKABLE: Icon3D[] = ['fun', 'music', 'game', 'coffee', 'pet', 'gift', 'book', 'gym', 'baby', 'heart', 'shop', 'bowl', 'car', 'house', 'plane', 'phone', 'piggy', 'bill', 'shield'];
export const MAX_CUSTOM = 5;

let list: Custom[] = [];
const subs = new Set<(l: Custom[]) => void>();

function register(next: Custom[]) {
  for (const old of list) {
    delete (CATEGORY as Record<string, unknown>)[old.key];
    delete (CAT_ICON3D as Record<string, unknown>)[old.key];
    delete (DB_CAT_NAME as Record<string, unknown>)[old.key];
  }
  for (const c of next) {
    CATEGORY[c.key] = { name: c.name, color: colors.lime, icon: 'more', need: c.need };
    CAT_ICON3D[c.key] = c.icon in ICON3D ? c.icon : 'fun';
    DB_CAT_NAME[c.key] = c.name;
  }
  list = next;
  subs.forEach((f) => f(list));
}

/** Load the person's own categories (once after sign-in, and after a change). */
export async function loadCustom(uid: string | undefined) {
  if (!uid) return register([]);
  const { data } = await supabase.from('categories').select('id, key, name, icon, need, hidden').eq('user_id', uid).eq('kind', 'spend');
  register(
    (data ?? [])
      .filter((r) => !r.hidden && isCustom(r.key as string))
      .map((r) => ({ id: r.id as string, key: r.key as CustomCat, name: r.name as string, icon: r.icon as Icon3D, need: !!r.need })),
  );
}

export const customCats = () => list;

/** The person's own categories, kept up to date. */
export function useCustomCats() {
  const [l, setL] = useState(list);
  useEffect(() => {
    subs.add(setL);
    setL(list);
    return () => {
      subs.delete(setL);
    };
  }, []);
  return l;
}

/** Make one. Returns it (with its database id), or an error message. */
export async function createCustom(uid: string, c: { name: string; icon: Icon3D; need: boolean }): Promise<Custom | string> {
  const name = c.name.trim().slice(0, 24);
  if (!name) return 'name';
  if (list.length >= MAX_CUSTOM) return 'max';
  const key = `c_${Math.random().toString(36).slice(2, 8)}` as CustomCat;
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: uid, kind: 'spend', key, name, color: colors.lime, icon: c.icon, need: c.need, sort: 100 + list.length })
    .select('id')
    .single();
  if (error || !data) return error?.message ?? 'failed';
  const made: Custom = { id: data.id as string, key, name, icon: c.icon, need: c.need };
  register([...list, made]);
  return made;
}

/** A guess at need or want from the name, before (or without) Kip. */
export function guessNeed(name: string): boolean {
  return /rent|bill|pet|cat|dog|baby|kid|school|medic|doctor|insur|loan|parent|mom|dad|แมว|หมา|ลูก|ค่าเทอม|ยา|หมอ|พ่อ|แม่|ประกัน/i.test(name);
}

/** A guess at the icon from the name. */
export function guessIcon(name: string): Icon3D {
  const n = name.toLowerCase();
  const rules: [RegExp, Icon3D][] = [
    [/pet|cat|dog|แมว|หมา|สัตว์/, 'pet'],
    [/coffee|cafe|café|tea|ชา|กาแฟ|ชานม/, 'coffee'],
    [/game|เกม|steam|rov/, 'game'],
    [/music|k-?pop|concert|spotify|เพลง|คอนเสิร์ต|เคป๊อป/, 'music'],
    [/gift|present|ของขวัญ|ทำบุญ/, 'gift'],
    [/book|course|class|study|หนังสือ|เรียน|คอร์ส/, 'book'],
    [/gym|fitness|sport|run|ฟิต|ยิม|วิ่ง|กีฬา/, 'gym'],
    [/baby|kid|child|ลูก|เด็ก/, 'baby'],
    [/beauty|skin|make ?up|hair|ความงาม|สกิน|แต่งหน้า|ผม/, 'heart'],
    [/trip|travel|เที่ยว|ทริป/, 'plane'],
    [/food|eat|snack|ขนม|อาหาร|กิน/, 'bowl'],
    [/car|grab|taxi|รถ|น้ำมัน/, 'car'],
    [/home|house|บ้าน|ห้อง/, 'house'],
    [/shop|cloth|เสื้อ|ช้อป/, 'shop'],
  ];
  return rules.find(([r]) => r.test(n))?.[1] ?? 'fun';
}

/** A new name for one of their own categories. Returns an error message, or null. */
export async function renameCustom(c: Custom, name: string): Promise<string | null> {
  const n = name.trim().slice(0, 24);
  if (!n) return 'name';
  const { error } = await supabase.from('categories').update({ name: n }).eq('id', c.id);
  if (error) return error.message;
  register(list.map((x) => (x.id === c.id ? { ...x, name: n } : x)));
  return null;
}

/**
 * Delete one of their own categories. What was logged in it moves to `to` (a built-in category, so nothing is
 * lost from the month's spending); the month itself is changed by the caller before this runs.
 */
export async function deleteCustom(c: Custom, to: string): Promise<string | null> {
  const { data: target } = await supabase.from('categories').select('id').is('user_id', null).eq('kind', 'spend').eq('key', to === 'spend_freely' ? 'other' : to).maybeSingle();
  if (target?.id) await supabase.from('transactions').update({ category_id: target.id }).eq('category_id', c.id);
  const { error } = await supabase.from('categories').delete().eq('id', c.id);
  if (error) return error.message;
  register(list.filter((x) => x.id !== c.id));
  return null;
}
