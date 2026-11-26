// Creating your own category from anywhere (Add, Slips, Your month): the create sheet, then — for Plus with Kip's
// reading on — Kip's offer to move this pay month's spending that looks like it. Nothing moves without "Move them".
import * as Haptics from 'expo-haptics';
import { useState } from 'react';

import { aiAllowed } from '@/components/AiConsent';
import { CreateCategory, Looking, MovePast } from '@/components/categories/CreateCategory';
import { askKipDo } from '@/components/TellKip';
import { useAuth } from '@/lib/auth';
import { isCustom, type CatKey } from '@/lib/budget';
import type { Custom } from '@/lib/customCats';
import { period, useHome } from '@/lib/home';
import { useMonth } from '@/lib/month';
import { supabase } from '@/lib/supabase';

type Item = { id: string; name: string; from: CatKey; amount: number };

export function CreateFlow({ onClose, onCreated }: { onClose: () => void; onCreated?: (c: Custom) => void }) {
  const { session, profile } = useAuth();
  const { month } = useMonth();
  const { reload } = useHome(month);
  const [made, setMade] = useState<Custom | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const canAsk = !!profile && profile.plan !== 'free' && aiAllowed(profile);

  async function created(c: Custom) {
    onCreated?.(c);
    if (!canAsk || !session || !month) return onClose();
    setMade(c);
    // This pay month's spending, for Kip to pick from (never more than 60, newest first).
    const { start } = period(month.payday);
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, note, categories(key)')
      .eq('user_id', session.user.id)
      .eq('kind', 'spend')
      .gte('occurred_at', start.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(60);
    const rows = (data ?? [])
      .map((r) => ({ id: r.id as string, name: (r.note as string | null) ?? '', amount: Number(r.amount), from: ((r.categories as unknown as { key: string } | null)?.key ?? 'other') as CatKey }))
      .filter((r) => r.name && !isCustom(r.from));
    if (!rows.length) return onClose();
    const res = await askKipDo<{ refs?: string[] }>('sort', c.name, {
      category: { name: c.name, need: c.need },
      items: rows.map((r, i) => ({ ref: `r${i + 1}`, name: r.name, amount: r.amount, category: r.from })),
    });
    const picked = res.ok && res.out.ok ? (res.out.refs ?? []).map((ref) => rows[Number(ref.slice(1)) - 1]).filter(Boolean) : [];
    if (!picked.length) return onClose();
    setItems(picked);
  }

  async function move() {
    if (!made || !items) return;
    setBusy(true);
    await supabase.from('transactions').update({ category_id: made.id }).in('id', items.map((i) => i.id));
    await reload(); // every screen showing this month's spending updates
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setBusy(false);
    onClose();
  }

  if (made && items)
    return <MovePast c={made} items={items} budget={month?.spend.find((s) => s.key === made.key)?.amount ?? 0} busy={busy} onMove={move} onClose={onClose} />;
  if (made) return <Looking c={made} onClose={onClose} />; // closes by itself if nothing fits
  return <CreateCategory onClose={onClose} onCreated={created} />;
}
