// TEMPORARY: runs a made-up person (no real data) through Kip's brain with realistic questions. Retire right after.
import { think } from './brain.ts'; // copy of supabase/functions/kip/brain.ts
import CASES from './cases.ts'; // export default <cases.json>
import CTX from './ctx.ts'; // export default <person.json>

Deno.serve(async (req) => {
  const key = Deno.env.get('ANTHROPIC_API_KEY')!;
  const only = new URL(req.url).searchParams.get('only')?.split(',');
  const cases = (CASES as { id: string; text: string; history?: unknown[] }[]).filter((c) => !only || only.includes(c.id));
  const out: unknown[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < cases.length) {
        const i = next++;
        const c = cases[i];
        const r = await think({ text: c.text, context: CTX, history: c.history ?? [], voice: false, key }).catch((e) => ({ error: String(e) }));
        const x = 'input' in r ? r.input : r;
        out[i] = { id: c.id, said: c.text, ...x, ms: 'ms' in r ? r.ms : undefined };
      }
    }),
  );
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8' } });
});
