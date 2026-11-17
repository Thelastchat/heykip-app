import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MonthScreen } from '@/components/MonthScreen';
import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { useAuth } from '@/lib/auth';
import { useHome } from '@/lib/home';
import { t } from '@/lib/i18n';
import { useMonth } from '@/lib/month';

// Your saving plan — where this month's money goes: saving first, then bills, then everyday spending.
// Changing amounts and money styles is Plus; adding a bill stays free.
export default function YourMonth() {
  return <PlanScreen />;
}

/** Opens Kip's bill guess sheet (not a bill name, so a bill called "guess" can't clash). */
export const GUESS = '\u0000guess';

/** The plan: saving first, then bills, then everyday spending. As a tab (back=false) and as /month with ?add, ?subs, ?edit, ?guess. */
export function PlanScreen({ back = true }: { back?: boolean }) {
  const { month, loading, error, save } = useMonth();
  const { add, edit: editName, subs, guess } = useLocalSearchParams<{ add?: string; edit?: string; subs?: string; guess?: string }>();
  const edit = guess ? GUESS : editName;
  const { spent } = useHome(month);
  const { profile } = useAuth();
  const [locked, setLocked] = useState<null | 'styles' | 'customize'>(null);
  const isPlus = profile ? profile.plan !== 'free' : false;
  const goal = month?.goal.title ?? t('your goal');
  const funLeft = Math.max(0, (month?.spend.find((x) => x.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = plusPitch(month, goal.split(' ')[0] === 'Safety' ? t('your safety net') : goal.replace(/ trip$/i, ''), funLeft);
  return (
    <>
      <MonthScreen
        month={month}
        loading={loading}
        error={error}
        save={save}
        spent={spent.byCat}
        isPlus={isPlus}
        onLocked={setLocked}
        openAdd={add === '1'}
        openSubs={subs === '1'}
        openEdit={edit}
        back={back}
        key={edit ?? 'month'}
      />
      {locked && (
        <PlusSheet open onClose={() => setLocked(null)} onUnlocked={() => setLocked(null)} title={pitch[locked].title} sub={pitch[locked].sub}>
          {pitch[locked].body}
        </PlusSheet>
      )}
    </>
  );
}
