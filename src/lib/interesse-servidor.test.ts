import { describe, it, expect, vi } from 'vitest';
import {
  CORPO_MAX_BYTES, criarLimitadorRajada, interpretarRetornoBanco, processarInteresse,
  type DependenciasInteresse, type RequisicaoInteresse, type ResultadoGravacao,
} from './interesse-servidor';
import { CAMPO_ISCA } from './interesse';

const dadosMotorista = { nome: 'Maria Teste Silva', whatsapp: '(18) 99876-5432', email: '', consentimento: true };
const dadosFamilia = { ...dadosMotorista, rua: 'Rua das Flores', numero: '123', bairro: 'Centro', complemento: '', escola: 'EE Exemplo', periodo: 'tarde', transporte: '' };

function deps(gravar: DependenciasInteresse['gravar'] = async () => ({ ok: true }), extra: Partial<DependenciasInteresse> = {}) {
  const d: DependenciasInteresse = { configurado: true, rajadaExcedida: () => false, hashIp: (ip) => `hash(${ip})`, gravar: vi.fn(gravar), ...extra };
  return d;
}
function req(corpo: unknown, extra: Partial<RequisicaoInteresse> = {}): RequisicaoInteresse {
  return {
    metodo: 'POST', origem: 'https://vammboraa.vercel.app', host: 'vammboraa.vercel.app', tipoConteudo: 'application/json',
    corpo: typeof corpo === 'string' ? corpo : JSON.stringify(corpo), ip: '203.0.113.7', ...extra,
  };
}

describe('/api/interesse — fluxo feliz', () => {
  it('motorista: grava e só então responde 201', async () => {
    const d = deps();
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), d);
    expect(r).toEqual({ status: 201, corpo: { ok: true } });
    expect(d.gravar).toHaveBeenCalledTimes(1);
    expect(d.gravar).toHaveBeenCalledWith(expect.objectContaining({ lead_type: 'motorista', whatsapp_e164: '+5518998765432', email: null, consent_accepted: true }), 'hash(203.0.113.7)');
  });
  it('família: envia endereço, escola e período normalizados', async () => {
    const d = deps();
    const r = await processarInteresse(req({ tipo: 'familia', dados: dadosFamilia }), d);
    expect(r.status).toBe(201);
    expect(d.gravar).toHaveBeenCalledWith(expect.objectContaining({
      lead_type: 'familia', street_address: 'Rua das Flores', address_number: '123', neighborhood: 'Centro',
      city: 'Araçatuba', state: 'SP', school_name: 'EE Exemplo', school_shift: 'tarde', transport_direction: null,
    }), expect.any(String));
  });
  it('o servidor decide versão da política, origem e consentimento (ignora o que o cliente mandar a mais)', async () => {
    const d = deps();
    await processarInteresse(req({ tipo: 'motorista', dados: { ...dadosMotorista, status: 'convertido', source: 'hack', privacy_policy_version: 'x', lead_type: 'familia' } }), d);
    const payload = (d.gravar as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({ lead_type: 'motorista', source: 'site' });
    expect(payload).not.toHaveProperty('status');
    expect(payload.privacy_policy_version).not.toBe('x');
  });
});

describe('/api/interesse — validação no servidor', () => {
  it.each([
    ['WhatsApp inválido', { ...dadosMotorista, whatsapp: '(18) 3622-1234' }, 'whatsapp'],
    ['WhatsApp com letras', { ...dadosMotorista, whatsapp: 'abcdefghijk' }, 'whatsapp'],
    ['e-mail inválido', { ...dadosMotorista, email: 'x@' }, 'email'],
    ['nome vazio', { ...dadosMotorista, nome: '  ' }, 'nome'],
    ['sem consentimento', { ...dadosMotorista, consentimento: false }, 'consentimento'],
  ])('%s → 422 com o campo, sem gravar', async (_n, dados, campo) => {
    const d = deps();
    const r = await processarInteresse(req({ tipo: 'motorista', dados }), d);
    expect(r.status).toBe(422);
    expect(r.corpo).toMatchObject({ ok: false, erro: 'validacao' });
    expect((r.corpo as { campos: Record<string, string> }).campos[campo]).toBeTruthy();
    expect(d.gravar).not.toHaveBeenCalled();
  });
  it('família sem endereço/escola/período → 422', async () => {
    const d = deps();
    const r = await processarInteresse(req({ tipo: 'familia', dados: dadosMotorista }), d);
    expect(r.status).toBe(422);
    expect(Object.keys((r.corpo as { campos: object }).campos).sort()).toEqual(['bairro', 'escola', 'numero', 'periodo', 'rua']);
    expect(d.gravar).not.toHaveBeenCalled();
  });
  it('tipo desconhecido → 422', async () => {
    const d = deps();
    expect((await processarInteresse(req({ tipo: 'admin', dados: dadosMotorista }), d)).status).toBe(422);
    expect(d.gravar).not.toHaveBeenCalled();
  });
});

describe('/api/interesse — superfície de exposição', () => {
  it('só POST', async () => {
    for (const metodo of ['GET', 'PUT', 'DELETE', 'OPTIONS', undefined]) {
      expect((await processarInteresse(req({}, { metodo }), deps())).status).toBe(405);
    }
  });
  it('recusa origem de outro site; aceita mesma origem e chamadas sem Origin', async () => {
    const corpo = { tipo: 'motorista', dados: dadosMotorista };
    expect((await processarInteresse(req(corpo, { origem: 'https://site-malicioso.example' }), deps())).status).toBe(403);
    expect((await processarInteresse(req(corpo, { origem: 'nao-e-url' }), deps())).status).toBe(403);
    expect((await processarInteresse(req(corpo, { origem: 'https://vammboraa.vercel.app', host: null }), deps())).status).toBe(403);
    expect((await processarInteresse(req(corpo, { origem: null }), deps())).status).toBe(201);
  });
  it('exige JSON, tamanho limitado e objeto válido', async () => {
    expect((await processarInteresse(req({}, { tipoConteudo: 'text/plain' }), deps())).status).toBe(415);
    expect((await processarInteresse(req({}, { tipoConteudo: null }), deps())).status).toBe(415);
    expect((await processarInteresse(req('x'.repeat(CORPO_MAX_BYTES + 1)), deps())).status).toBe(413);
    for (const ruim of ['{', '', 'null', '[]', '"texto"', '42']) expect((await processarInteresse(req(ruim), deps())).status).toBe(400);
  });
  it('campo-isca preenchido (robô): responde sem gravar', async () => {
    const d = deps();
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista, [CAMPO_ISCA]: 'http://spam' }), d);
    expect(r.status).toBe(201);
    expect(d.gravar).not.toHaveBeenCalled();
  });
  it('rajada por IP → 429 sem gravar', async () => {
    const d = deps(undefined, { rajadaExcedida: () => true });
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), d);
    expect(r.status).toBe(429);
    expect(d.gravar).not.toHaveBeenCalled();
  });
  it('as respostas nunca carregam dados de inscrições', async () => {
    const d = deps(async () => ({ ok: true }));
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), d);
    expect(Object.keys(r.corpo)).toEqual(['ok']);
  });
});

describe('/api/interesse — banco indisponível e limites (nunca sucesso falso)', () => {
  it('sem chave do servidor → 503', async () => {
    const d = deps(undefined, { configurado: false });
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), d);
    expect(r.status).toBe(503);
    expect(r.corpo.ok).toBe(false);
    expect(d.gravar).not.toHaveBeenCalled();
  });
  it('erro de conexão (exceção) → 503', async () => {
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), deps(async () => { throw new Error('ECONNREFUSED'); }));
    expect(r.status).toBe(503);
    expect(r.corpo).toMatchObject({ ok: false, erro: 'indisponivel' });
  });
  it.each<[ResultadoGravacao, number]>([
    [{ ok: false, erro: 'indisponivel' }, 503],
    [{ ok: false, erro: 'limite' }, 429],
    [{ ok: false, erro: 'invalido' }, 422],
  ])('retorno do banco %j → %i', async (resultado, status) => {
    const r = await processarInteresse(req({ tipo: 'motorista', dados: dadosMotorista }), deps(async () => resultado));
    expect(r.status).toBe(status);
    expect(r.corpo.ok).toBe(false);
  });
});

describe('interpretarRetornoBanco', () => {
  it('só confirma com retorno explícito de gravação', () => {
    expect(interpretarRetornoBanco({ ok: true, resultado: 'criado' }, null)).toEqual({ ok: true });
    expect(interpretarRetornoBanco({ ok: true, resultado: 'reenviado' }, null)).toEqual({ ok: true });   // duplicidade: mesma resposta
    expect(interpretarRetornoBanco({ ok: true }, null)).toEqual({ ok: false, erro: 'indisponivel' });
    expect(interpretarRetornoBanco(null, null)).toEqual({ ok: false, erro: 'indisponivel' });
    expect(interpretarRetornoBanco({ ok: true, resultado: 'criado' }, { message: 'falhou' })).toEqual({ ok: false, erro: 'indisponivel' });
    expect(interpretarRetornoBanco({ ok: false, erro: 'limite' }, null)).toEqual({ ok: false, erro: 'limite' });
    expect(interpretarRetornoBanco({ ok: false, erro: 'invalido', campos: ['email'] }, null)).toEqual({ ok: false, erro: 'invalido' });
  });
});

describe('limitador de rajada', () => {
  it('bloqueia acima do máximo e libera após a janela', () => {
    let t = 0;
    const excedeu = criarLimitadorRajada(3, 1000, () => t);
    expect([excedeu('a'), excedeu('a'), excedeu('a')]).toEqual([false, false, false]);
    expect(excedeu('a')).toBe(true);
    expect(excedeu('b')).toBe(false);
    t = 1001;
    expect(excedeu('a')).toBe(false);
  });
});
