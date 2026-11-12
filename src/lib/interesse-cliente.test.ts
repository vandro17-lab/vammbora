import { describe, it, expect, vi } from 'vitest';
import { enviarInteresse, MENSAGEM_INDISPONIVEL, MENSAGEM_REDE } from './interesse-cliente';
import { DADOS_VAZIOS } from './interesse';

const dados = { ...DADOS_VAZIOS, nome: 'Maria Teste Silva', whatsapp: '(18) 99876-5432', consentimento: true };
const resposta = (status: number, corpo: unknown, json = true) =>
  vi.fn(async () => new Response(json ? JSON.stringify(corpo) : String(corpo), { status })) as unknown as typeof fetch;

describe('enviarInteresse (navegador → /api/interesse)', () => {
  it('sucesso só com 201 + { ok: true }', async () => {
    const f = resposta(201, { ok: true });
    expect(await enviarInteresse('motorista', dados, '', f)).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/interesse');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ tipo: 'motorista', dados: { whatsapp: '(18) 99876-5432' } });
  });
  it('falha de rede → erro, nunca sucesso', async () => {
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await enviarInteresse('motorista', dados, '', f)).toEqual({ ok: false, motivo: 'rede', mensagem: MENSAGEM_REDE });
  });
  it('banco indisponível (503) → erro amigável', async () => {
    const r = await enviarInteresse('motorista', dados, '', resposta(503, { ok: false, erro: 'indisponivel', mensagem: 'Não foi possível registrar seu interesse agora.' }));
    expect(r).toMatchObject({ ok: false, motivo: 'indisponivel' });
  });
  it('respostas inesperadas não viram sucesso', async () => {
    // 200 com HTML (ex.: servidor de desenvolvimento sem /api), 200 com ok:true, 201 sem corpo, 201 ok:false, 404, 500 sem JSON
    for (const f of [resposta(200, '<!doctype html>', false), resposta(200, { ok: true }), resposta(201, '', false), resposta(201, { ok: false }), resposta(404, {}), resposta(500, 'erro', false)]) {
      const r = await enviarInteresse('familia', dados, '', f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem).toBe(MENSAGEM_INDISPONIVEL);
    }
  });
  it('422 devolve os erros por campo; 429 avisa do limite', async () => {
    const v = await enviarInteresse('motorista', dados, '', resposta(422, { ok: false, erro: 'validacao', mensagem: 'Confira os campos.', campos: { whatsapp: 'Número inválido.' } }));
    expect(v).toEqual({ ok: false, motivo: 'validacao', mensagem: 'Confira os campos.', campos: { whatsapp: 'Número inválido.' } });
    const l = await enviarInteresse('motorista', dados, '', resposta(429, { ok: false, erro: 'limite', mensagem: 'Aguarde.' }));
    expect(l).toEqual({ ok: false, motivo: 'limite', mensagem: 'Aguarde.' });
  });
});
