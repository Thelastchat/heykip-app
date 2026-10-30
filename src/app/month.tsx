import { useState } from 'react';

import { MonthScreen } from '@/components/MonthScreen';
import { PlusSheet } from '@/components/PlusSheet';
import { plusPitch } from '@/components/plusPitch';
import { useAuth } from '@/lib/auth';
import { useHome } from '@/lib/home';
import { useMonth } from '@/lib/month';

// Your month — where this month's money goes: saving first, then bills, then everyday spending.
// Changing amounts and money styles is Plus; adding a bill stays free.
export default function YourMonth() {
  const { month, loading, error, save } = useMonth();
  const { spent } = useHome(month);
  const { profile } = useAuth();
  const [locked, setLocked] = useState<null | 'styles' | 'customize'>(null);
  const isPlus = profile ? profile.plan !== 'free' : false;
  const goal = month?.goal.title ?? 'your goal';
  const funLeft = Math.max(0, (month?.spend.find((x) => x.key === 'fun')?.amount ?? 0) - (spent.byCat.fun ?? 0));
  const pitch = plusPitch(month, goal.split(' ')[0] === 'Safety' ? 'your safety net' : goal.replace(/ trip$/i, ''), funLeft);
  return (
    <>
      <MonthScreen month={month} loading={loading} error={error} save={save} spent={spent.byCat} isPlus={isPlus} onLocked={setLocked} />
      {locked && (
        <PlusSheet open onClose={() => setLocked(null)} onUnlocked={() => setLocked(null)} title={pitch[locked].title} sub={pitch[locked].sub}>
          {pitch[locked].body}
        </PlusSheet>
      )}
    </>
  );
}
