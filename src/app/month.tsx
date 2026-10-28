import { MonthScreen } from '@/components/MonthScreen';
import { useMonth } from '@/lib/month';

// Your month — where this month's money goes: saving first, then bills, then everyday spending.
// Tap any amount to change it; Kip re-balances so it still adds up.
export default function YourMonth() {
  const { month, loading, error, save } = useMonth();
  return <MonthScreen month={month} loading={loading} error={error} save={save} />;
}
