// ============================================================
// ATLAS — calculate-yks-score Edge Function (görev listesi madde 10/11)
//
// shared/yks-calc.ts'i DOĞRUDAN import eder — client (atlas-mobile) ile
// AYNI formül kodu, iki kez yazılmaz. Bu yüzden Postgres RPC değil, Deno
// Edge Function (relative TS import'a izin veriyor).
//
// Input : { year, scoreType, netler: NetMap, diplomaNotu?, oncekiYilYerlesti? }
// Output: { hamPuan, obp, obpKatkisi, yerlestirmePuani } — kaydedilir + döner.
//
// Deploy: npx supabase functions deploy calculate-yks-score
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { hesaplaHamPuan, hesaplaObp, hesaplaYerlestirmePuani, type NetMap, type ScoreType } from '../../../shared/yks-calc.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SCORE_TYPES: ScoreType[] = ['TYT', 'SAY', 'EA', 'SOZ', 'DIL'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = await req.json().catch(() => null);
  const year: number | undefined = body?.year;
  const scoreType: ScoreType | undefined = body?.scoreType;
  const netler: NetMap | undefined = body?.netler;
  const diplomaNotu: number | undefined = body?.diplomaNotu;
  const oncekiYilYerlesti: boolean = body?.oncekiYilYerlesti ?? false;

  if (!year || !scoreType || !SCORE_TYPES.includes(scoreType) || !netler || typeof netler !== 'object') {
    return json({ error: 'invalid_input' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json({ error: 'auth_required' }, 401);

  const { data: coeffRow, error: coeffErr } = await supabase
    .from('score_coefficients')
    .select('base_score, coefficients')
    .eq('year', year)
    .eq('score_type', scoreType)
    .single();
  if (coeffErr || !coeffRow) return json({ error: 'coefficients_not_found' }, 404);

  const hamPuan = hesaplaHamPuan(netler, coeffRow.coefficients as Record<string, number>, Number(coeffRow.base_score));
  const obp = diplomaNotu !== undefined ? hesaplaObp(diplomaNotu) : 0;
  const { obpKatkisi, yerlestirmePuani } = hesaplaYerlestirmePuani(hamPuan, obp, oncekiYilYerlesti);

  const { error: insertErr } = await supabase.from('user_exam_results').insert({
    user_id: auth.user.id,
    year,
    score_type: scoreType,
    net_detail: netler,
    ham_puan: hamPuan,
    obp,
    onceki_yil_yerlesti: oncekiYilYerlesti,
    yerlestirme_puani: yerlestirmePuani,
  });
  if (insertErr) return json({ error: 'save_failed', detail: insertErr.message }, 500);

  return json({ hamPuan, obp, obpKatkisi, yerlestirmePuani });
});
