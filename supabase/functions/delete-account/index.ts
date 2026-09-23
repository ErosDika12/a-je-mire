// Fshin llogarinë e përdoruesit që e thërret. Çelësi service-role jeton vetëm këtu, në server,
// sepse fshirja e një përdoruesi nga auth kërkon të drejta administratori.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://a-je-mire.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');

  // Identiteti merret nga tokeni, jo nga trupi i kërkesës: askush nuk mund të fshijë dikë tjetër.
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Tabelat kanë "on delete cascade", prandaj kopja dhe pëlqimet fshihen bashkë me përdoruesin.
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return new Response(JSON.stringify({ error: 'delete_failed' }), { status: 500, headers });

  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
});
