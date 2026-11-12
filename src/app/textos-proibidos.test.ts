import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regressão de textos (Etapa 2): o VanBora não verifica documentos de
 * motoristas, então a interface não pode afirmar verificação inexistente nem
 * sugerir pendência documental. Varre o código das telas.
 */
const PROIBIDOS = [/Verificação documental pendente/i, /Motorista verificado/i];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    if (statSync(c).isDirectory()) return arquivos(c);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [c] : [];
  });
}

describe('textos proibidos na interface', () => {
  const telas = arquivos(join(__dirname, '..'));
  it('encontra as telas para verificar', () => expect(telas.length).toBeGreaterThan(20));
  for (const re of PROIBIDOS) {
    it(`nenhuma tela contém ${re}`, () => {
      const achados = telas.filter((f) => re.test(readFileSync(f, 'utf8')));
      expect(achados).toEqual([]);
    });
  }
});
