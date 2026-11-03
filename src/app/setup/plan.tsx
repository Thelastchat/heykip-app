import { router } from 'expo-router';

import { PlanPicker } from '@/components/PlanPicker';
import { SetupScreen } from '@/components/setup/kit';
import { Button } from '@/components/ui';
import { STYLES } from '@/lib/budget';
import { t } from '@/lib/i18n';
import { useSetup } from '@/lib/setup/draft';
import { inputsFrom } from '@/lib/setup/plan';

// Setup · Pick your plan. Not in the setup path right now (setup ends at the promise; money styles are Plus) —
// kept so it can come back; the same picker is the Money styles screen in the app (src/app/styles.tsx).
export default function SetupPlan() {
  const { draft, update } = useSetup();
  const s = STYLES.find((x) => x.key === draft.budgetStyle) ?? STYLES[0];
  return (
    <SetupScreen step={4} footer={<Button label={t('Choose {name}', { name: s.name })} onPress={() => router.push('/setup/sign')} />}>
      <PlanPicker
        draft={draft}
        inputs={inputsFrom(draft)}
        style={draft.budgetStyle}
        goalPerMonth={draft.goalPerMonth}
        onPick={(budgetStyle) => update({ budgetStyle, goalPerMonth: null })}
        onCustomize={() => router.push('/setup/yours')}
        starting
      />
    </SetupScreen>
  );
}
