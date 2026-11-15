import { PlanScreen } from '@/app/month';

// The second tab: the saving plan, with nothing to go back to.
export default function PlanTab() {
  return <PlanScreen back={false} />;
}
