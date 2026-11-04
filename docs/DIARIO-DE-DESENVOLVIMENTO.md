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

### 04/11/2026 — Elevação visual premium (iteração da Etapa 1)
Após revisão do coordenador (visual precisava ser mais premium):
- **Ilustrações de van premium**: carroceria com gradiente e brilho, vidros com reflexo,
  rodas com aro metálico, farol/lanterna, sombra de contato e cena de fundo com brilho de sol
  (substituindo os blocos chapados). Continuam fictícias e vetoriais (sem fotos reais).
- **Tela de busca cinematográfica** (`SearchLoadingScreen`): overlay em tela cheia (via portal),
  van dirigindo com rodas girando e suspensão, estrada com parallax, cidade ao fundo, aurora
  animada, barra de progresso e mensagens honestas. Respeita `prefers-reduced-motion`.
- **Transições modernas**: revelações com blur + escala (`Reveal`) e transição de página
  (`PageTransition`), substituindo o "subir" básico. Microinterações (sheen nos botões, zoom
  na van, elevação dos cards).
- **Correção**: overlay de carregamento não cobria a tela por causa do `transform/filter` da
  transição de página — resolvido renderizando via portal no `body`.
- Revalidado: `npm run build` (exit 0), 19 testes passando, 0 erros de console (Playwright).

### 04/11/2026 — Etapa 2 (Parte A): fundação do banco Supabase
- **Migrações SQL versionadas** (`supabase/migrations/`): núcleo (profiles, user_roles, cities,
  destinations, drivers, driver_destinations, verification_reviews, leads, waitlist_requests,
  audit_events), com enums, índices, FKs, constraints e triggers.
- **RLS** em todas as tabelas; **view `public_listings`** para a vitrine pública sem telefone/
  documento/endereço; funções de papel (`is_admin`, `has_role`).
- **Storage**: buckets `public-media` (público) e `driver-docs` (privado) com políticas.
- **RPCs seguras**: `solicitar_contato_whatsapp` (registra lead e devolve o telefone) e
  `registrar_interesse` (waitlist). Ambas exigem consentimento.
- **Seed idempotente** espelhando a demo (is_demo=true, telefones fictícios).
- **App**: cliente `@supabase/supabase-js`, `src/lib/supabase.ts` (flag), camada única
  `src/data/source.ts` com **fallback local**, e `WaitlistForm` gravando via RPC quando ligado.
- **Guia** `docs/GUIA-SUPABASE.md` (passo a passo para iniciante) e `supabase/README.md`.
- Validado: `npm run build` (exit 0), 19 testes passando.

### 04/11/2026 — Etapa 2 (Parte A): migrações APLICADAS no Supabase
- Projeto Supabase **criado** via conector MCP: `vambora` (ref `rnulmjdsvvuirqijemzy`, região sa-east-1).
- Migrações 0001–0005 **aplicadas** + seed executado. Verificação: 6 motoristas, 5 destinos,
  12 vínculos, 6 na vitrine pública.
- **Teste de segurança (como anon):** `public_listings` devolve 6 linhas; a tabela `drivers`
  devolve **0 linhas** (telefone/documentos protegidos pela RLS). Advisor rodado; avisos restantes
  são intencionais e documentados em `0005_hardening.sql`.
- Falta: configurar as variáveis de ambiente no Vercel (URL + chave publishable).

### 04/11/2026 — Etapa 2 (Parte B): vitrine lendo do banco
- Provedor central `src/data/VitrineProvider.tsx` carrega destinos + motoristas uma vez e distribui
  às telas (home, busca, resultados, perfil) via `useVitrine()`.
- Home (busca + destaques), Resultados e Perfil agora leem do `source.ts` (Supabase quando ligado,
  senão seed local). Esqueletos de carregamento adicionados.
- Perfil: botão de WhatsApp agora chama a RPC `solicitar_contato_whatsapp` (registra o lead e
  devolve o telefone) no modo Supabase; no modo demo usa o telefone local. Popup aberto no clique
  (evita bloqueador).
- Mapeamento banco→domínio conferido campo a campo.
- Validado: `npm run build` (exit 0), 19 testes passando.
- **Limitação do sandbox:** o proxy deste ambiente bloqueia `supabase.co` (403 no túnel), então o
  teste navegador→banco ao vivo não pôde ser feito aqui; o fallback local manteve o app funcionando.
  No navegador do usuário e no Vercel a chamada funciona. O banco em si foi validado via conector MCP.

### 04/11/2026 — Administração (base) + especificação do motor
- **Especificação do motor de encaixe** (`docs/ESPEC-MOTOR-DE-ENCAIXE.md`): brief autossuficiente +
  ~28 testes para outra IA implementar; integro depois via adaptador. (O motor original de uma
  conversa anterior não foi salvo em nenhum repositório — confirmado por busca; será reconstruído.)
- **Área de administração (fundação):** login por e-mail/senha (Supabase Auth) em `/admin/login`,
  rota protegida `/admin` por papel admin (RLS + RPC `is_admin`), **sem botão público**.
  Painel inicial: lista motoristas (publicar/ocultar, editar vagas) e interessados (waitlist),
  lendo/gravando no banco. `AuthProvider` + `useAuth`.
- Sem Supabase, o admin mostra aviso (precisa do banco). Validado: build exit 0, 19 testes, 0 erros.
- Falta: conceder papel admin ao usuário (após ele criar a conta) e ampliar o CRUD (destinos, fotos,
  revisão documental). Testar login ao vivo (sandbox bloqueia Supabase).

### Pendências abertas
Ver [`PENDENCIAS.md`](PENDENCIAS.md). Principais: integrar motor real, configurar Supabase,
importar escolas do INEP com fonte/data, confirmar requisitos legais de Araçatuba.
