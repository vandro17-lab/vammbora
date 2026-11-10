import { describe, it, expect, vi, afterEach } from 'vitest';

/** O fluxo real (Supabase) é o padrão; a demonstração do motorista é opt-in. */
async function carregar(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./supabase');
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('modo demonstração do motorista', () => {
  it('desligado por padrão: Supabase ativo, sem demo', async () => {
    const m = await carregar({});
    expect(m.USE_SUPABASE).toBe(true);
    expect(m.DEMO_MOTORISTA).toBe(false);
    expect(m.supabase).not.toBeNull();
  });
  it('só liga com VITE_DEMO_MOTORISTA="true" explícito', async () => {
    expect((await carregar({ VITE_DEMO_MOTORISTA: 'true' })).DEMO_MOTORISTA).toBe(true);
    expect((await carregar({ VITE_DEMO_MOTORISTA: 'false' })).DEMO_MOTORISTA).toBe(false);
    expect((await carregar({ VITE_DEMO_MOTORISTA: '1' })).DEMO_MOTORISTA).toBe(false);
  });
  it('VITE_USE_SUPABASE="false" continua desligando o banco (painel local)', async () => {
    const m = await carregar({ VITE_USE_SUPABASE: 'false' });
    expect(m.USE_SUPABASE).toBe(false);
    expect(m.supabase).toBeNull();
  });
});
