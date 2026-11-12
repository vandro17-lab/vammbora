/**
 * Cadastro de interesse do PRÉ-LANÇAMENTO — gravação SERVER-SIDE.
 *
 * Por quê no servidor: a tabela `prelaunch_leads` guarda dados pessoais e não
 * aceita NENHUM acesso de visitante (RLS sem política para anon). O navegador
 * envia o formulário para cá; este endpoint valida de novo, identifica o
 * visitante por um hash do IP (para o limite de envios) e chama a função
 * `registrar_interesse_lancamento`, executável apenas pela service_role.
 *
 * Variáveis de ambiente do servidor (Vercel):
 *   - VITE_SUPABASE_URL           (já usada pelo app; opcional — há padrão)
 *   - SUPABASE_SERVICE_ROLE_KEY   (SEGREDO — nunca vai ao frontend)
 *   - LEADS_IP_SALT               (opcional — segredo para o hash do IP;
 *                                  sem ele usa-se a própria service role)
 *
 * Sem a service role o endpoint responde 503 e o formulário mostra erro —
 * nunca um sucesso falso.
 *
 * CORS: nenhum cabeçalho Access-Control é enviado (somente mesma origem), e
 * pedidos com Origin de outro site são recusados.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  processarInteresse, interpretarRetornoBanco, criarLimitadorRajada, CORPO_MAX_BYTES,
  type DependenciasInteresse,
} from '../src/lib/interesse-servidor';

const SUPABASE_URL_PADRAO = 'https://rnulmjdsvvuirqijemzy.supabase.co';
const rajadaExcedida = criarLimitadorRajada();

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    // Vercel pode entregar o corpo já lido.
    const pronto = (req as IncomingMessage & { body?: unknown }).body;
    if (pronto !== undefined) return resolve(typeof pronto === 'string' ? pronto : JSON.stringify(pronto));
    let dados = '';
    let bytes = 0;
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      bytes += Buffer.byteLength(c);
      // Corta cedo: o núcleo responde 413 ao ver o corpo acima do limite.
      if (bytes > CORPO_MAX_BYTES + 1024) { dados = 'x'.repeat(CORPO_MAX_BYTES + 1); req.destroy(); resolve(dados); return; }
      dados += c;
    });
    req.on('end', () => resolve(dados));
    req.on('error', reject);
  });
}

const cabecalho = (req: IncomingMessage, nome: string): string | null => {
  const v = req.headers[nome];
  return (Array.isArray(v) ? v[0] : v) ?? null;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = process.env.VITE_SUPABASE_URL || SUPABASE_URL_PADRAO;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sal = process.env.LEADS_IP_SALT || chave || '';

  const deps: DependenciasInteresse = {
    configurado: !!chave,
    rajadaExcedida,
    hashIp: (ip) => createHmac('sha256', sal).update(ip).digest('hex'),
    async gravar(payload, ipHash) {
      const db = createClient(url, chave as string, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await db.rpc('registrar_interesse_lancamento', { p_payload: payload, p_ip_hash: ipHash });
      if (error) console.error('[interesse] falha ao gravar:', error.code ?? '', error.message);
      return interpretarRetornoBanco(data, error);
    },
  };

  let corpo = '';
  if (req.method === 'POST') {
    try { corpo = await lerCorpo(req); } catch { corpo = ''; }
  }
  // Na Vercel, x-forwarded-for é definido pela plataforma (o primeiro valor é o visitante).
  const ip = String(cabecalho(req, 'x-real-ip') ?? cabecalho(req, 'x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';

  const r = await processarInteresse({
    metodo: req.method,
    origem: cabecalho(req, 'origin'),
    host: cabecalho(req, 'x-forwarded-host') ?? cabecalho(req, 'host'),
    tipoConteudo: cabecalho(req, 'content-type'),
    corpo,
    ip,
  }, deps);

  res.statusCode = r.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (r.status === 405) res.setHeader('Allow', 'POST');
  res.end(JSON.stringify(r.corpo));
}
