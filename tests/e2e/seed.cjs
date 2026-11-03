// A signed-in person with a real plan (built by the app's own maths), ready for the everyday tests.
const { makeDb, tx, UID } = require('./mock.cjs');
const X = require(process.env.EXPECT || '/tmp/heykip-expect.cjs');

function person({
  income = 25000,
  payday = 25,
  rent = 7000,
  bills = 1500,
  style = 'kip',
  goal = { title: 'Japan trip', kind: 'trip', target: 60000, saved: 5000, due: '2027-12-25' },
  plan = 'free',
  spends = [],
  safety = 0,
  extraGoals = [],
} = {}) {
  const draft = {
    ...X.EMPTY_DRAFT,
    incomeType: 'regular',
    monthlyIncome: income,
    payday,
    rent,
    bills,
    budgetStyle: style,
    goalTitle: goal.title,
    goalKind: goal.kind,
    goalType: goal.kind,
    goalTarget: goal.kind === 'monthly' ? null : goal.target,
    goalSaved: goal.saved ?? 0,
    goalDue: goal.due ?? null,
    goalMonthly: goal.monthly ?? null,
  };
  const inputs = X.inputsFrom(draft);
  const budget = X.monthFrom(inputs, style, null, payday, X.safetyNet(inputs).target);
  const goals = [
    {
      id: 'g1',
      user_id: UID,
      title: goal.title,
      kind: goal.kind,
      goal_type: goal.kind,
      target_amount: goal.kind === 'monthly' ? null : goal.target,
      saved_amount: goal.saved ?? 0,
      monthly_amount: goal.monthly ?? null,
      due_date: goal.due ?? null,
      photo_url: null,
      position: 1,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    ...extraGoals.map((g, i) => ({
      id: 'g' + (i + 2),
      user_id: UID,
      goal_type: g.kind,
      photo_url: null,
      position: i + 2,
      status: 'active',
      created_at: new Date().toISOString(),
      saved_amount: 0,
      monthly_amount: null,
      ...g,
    })),
  ];
  const db = makeDb({
    profile: { onboarded: true, plan, budget, income_type: 'regular', monthly_income: income, payday, rent, budget_style: style, daily_budget: X.plan(inputs, style).daily, safety_saved: safety },
    goals,
    promises: [{ id: 'p1', user_id: UID, goal_id: 'g1', text: 'By December, I’ll be in Japan', signature_url: null, signed_at: new Date().toISOString() }],
    transactions: spends.map(([cat, amount, daysAgo, note]) => tx('spend', cat, amount, new Date(Date.now() - (daysAgo ?? 0) * 86400000), note ?? null)),
  });
  return { db, budget };
}
module.exports = { person };
