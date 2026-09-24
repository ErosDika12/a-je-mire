// Asistenti opsional i reflektimit. Thirret vetëm kur përdoruesi e kërkon, pas konfirmimit.
// Çelësi i ofruesit jeton vetëm në Vault. Kërkesa dhe përgjigja nuk ruhen dhe nuk shkruhen në log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sanitizeRequest, validateOutput, systemPrompt, userPrompt } from '../_shared/ai-guard.js';

const MODEL = 'claude-haiku-4-5-20251001';
const ALLOWED_ORIGINS = ['https://a-je-mire.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];

function headersFor(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/a-je-mire-[a-z0-9-]+-erosdika12s-projects\.vercel\.app$/.test(origin)) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

const reply = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  const headers = headersFor(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405, headers);

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: auth } = await userClient.auth.getUser(token);
  if (!auth || !auth.user) return reply({ error: 'unauthorized' }, 401, headers);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = (await admin.rpc('service_get_secret', { p_name: 'anthropic_api_key' })).data as string | null;
  // Pa ofrues të konfiguruar, moduli është krejt i fikur.
  if (!apiKey) return reply({ error: 'not_configured' }, 503, headers);

  const input = await req.json().catch(() => null);
  const clean = sanitizeRequest(input);
  if (!clean.ok) return reply({ error: clean.error }, 400, headers);

  // Flamuri dhe kuota kontrollohen si vetë përdoruesi, në bazë.
  const { data: remaining, error: quotaError } = await userClient.rpc('ai_consume');
  if (quotaError) {
    const code = /rate_limited/.test(quotaError.message) ? 'rate_limited' : 'feature_disabled';
    return reply({ error: code }, code === 'rate_limited' ? 429 : 403, headers);
  }

  let text = '';
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: systemPrompt(clean.value.lang),
        messages: [{ role: 'user', content: userPrompt(clean.value) }]
      })
    });
    if (!response.ok) return reply({ error: 'provider_error' }, 502, headers);
    const data = await response.json();
    text = (data.content || []).filter((part: { type: string }) => part.type === 'text').map((part: { text: string }) => part.text).join('\n');
  } catch (_error) {
    return reply({ error: 'provider_unreachable' }, 502, headers);
  }

  const checked = validateOutput(text);
  if (!checked.ok) return reply({ error: 'unsafe_output' }, 422, headers);
  return reply({ text: checked.value, remaining, provider: 'Anthropic', model: MODEL }, 200, headers);
});
