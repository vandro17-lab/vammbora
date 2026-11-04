# Diário de Desenvolvimento — Vambora

Registro cronológico, honesto, do que foi feito.

---

## 03–04/11/2026 — Etapa 0 (Auditoria) + Etapa 1 (Fundação e UI premium)

### Auditoria (Etapa 0)
- Inspeção do repositório `vandro17-lab/vammbora`: **vazio** (zero commits, zero arquivos),
  já na branch de desenvolvimento `ccr-f87e0ff9-rxiwxc`.
- **Registro de ausência:** os documentos `van-bora-completo.md`, `Ideathon - Fatec 2026.pdf`,
  `motor-van-bora.md`, `pesquisa-motores.md` e a pasta `motor/` **não estavam disponíveis**.
  Única fonte recebida: `CLAUDE-VAMBORA-INSTRUCOES-MESTRAS.md`.
- Ambiente verificado: Node v22, npm 10, rede OK.
- Decisão: **não reimplementar o motor**; usar adaptador simulado isolado (ADR-003).

### Fundação e UI (Etapa 1)
- Scaffold React + TS + Vite; Tailwind com design system (tokens de cor/tipografia/sombra).
- Marca: logo SVG original (van simplificada); avatares e ilustrações de van geradas no código.
- PWA: manifesto, service worker (vite-plugin-pwa), ícones 192/512 + maskable (sharp).
- Telas: Home (hero + busca, benefícios, como funciona, motoristas em destaque, confiança, FAQ,
  CTA motorista), Resultados, Perfil, entrada "Sou motorista" com prévia do painel, 404.
- Busca guiada com critérios na URL; animação premium da van (van percorrendo a rota, mensagens
  honestas, respeito a `prefers-reduced-motion`).
- Compatibilidade **simulada** em `src/lib/matching.ts` (filtra cidade/destino/turno/vaga; níveis
  disponível / sob consulta; não inventa tempos nem contagens).
- WhatsApp com mensagem pronta, sem vazar dados sensíveis.
- Lista de interesse (waitlist) com consentimento (persistência real na Etapa 2).
- Estados: skeletons, vazio, erro de rota (404).
- Testes: 19 testes de lógica (matching, whatsapp, searchParams, utils) — **passando**.

### Verificações executadas
- `npx tsc --noEmit` / `tsc -b` → **sem erros de tipo**.
- `npx vitest run` → **19 testes, 4 arquivos, todos passando**.
- `npm run build` → **sucesso**; PWA com 18 entradas pré-cacheadas; SW gerado.
- Inspeção visual (Playwright, desktop + mobile) → sem erros de console; layout premium.
- **Bug corrigido:** títulos sobre fundo escuro ficavam invisíveis (regra base forçava cor);
  ajustado para herdar a cor do contexto.

### Pendências abertas
Ver [`PENDENCIAS.md`](PENDENCIAS.md). Principais: integrar motor real, configurar Supabase,
importar escolas do INEP com fonte/data, confirmar requisitos legais de Araçatuba.
