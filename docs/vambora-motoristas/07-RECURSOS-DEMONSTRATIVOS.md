# 07 — Inventário: Real × Demonstrativo

Objetivo: saber, no código e aqui, o que é **funcionalidade real** (precisa
continuar funcionando) e o que é **demonstrativo** (substituível depois), sem
misturar dados demo com produção e sem apresentar simulação como resultado real.

## Convenção de identificação (seguir a do projeto)
Já em uso no repo: coluna/flag **`is_demo`** (tabelas `drivers`, `vehicles`,
`routes`), campo **`demo`** no tipo `Motorista`, e **`MODO_DEMO`** em `source.ts`.
Para novos dados ilustrativos, padronizar:
- Arquivos em `src/data/demo/*` (ex.: `clube.ts`, `financeiro.ts`, `oportunidades.ts`).
- Export com sufixo/prefixo reconhecível (`DEMO_*`, `*Fixture`), tipados.
- Nenhum valor fictício espalhado em componentes — sempre importado de `src/data/demo/*`.
- Nenhuma gravação demo em tabela de produção; dados demo de banco marcados `is_demo=true`.

## REAL (deve continuar funcional)
- **Autenticação**: `src/lib/auth.tsx` (email + Google OAuth), sessão, `isAdmin`.
- **Veículos**: `vehicles` via `salvarVeiculo/listarVeiculos`.
- **Rotas**: `routes/route_stops/route_passengers` via `salvar_rota_completa` + `mapRotaDoBanco`.
- **Construtor de rota**: `RotaBuilderPage` + `MapaInterativoRota` (+ geocodificação por número/alfinete do PR #14).
- **Motores**: `src/engine/*` (`encaixe-geografico`, `planejamento`, legados) + adaptadores `src/lib/*`.
- **Simulador**: `SimuladorEncaixePage` via `simularEncaixeRota` (não grava).
- **Marketplace**: `public_listings` → `source.ts` → `VitrineProvider` → busca/perfil; filtro `matching.ts`.
- **Leads/interesse**: RPCs `solicitar_contato_whatsapp`, `registrar_interesse`.
- **Admin**: publicar/suspender/vagas (`adminAtualizarMotorista`).
- **Geocodificação**: `api/mapas.ts` + `src/lib/geocode.ts` (real com `GEOAPIFY_API_KEY`; fallback Photon sem chave).

## DEMONSTRATIVO (substituível, mas com interações convincentes)
- **Vambora Pro `/pro` (`VamboraProPage`)**: 16 módulos com dados fixos (Início, Vagas, Financeiro, Passageiros, Vagas por trecho, Calendário, Avisos, Combustível, Manutenção, Documentação, Relatórios, Clube do Motorista, AlugaVan, Perfil, Rotas, Mais). Hoje **desconectado** do real.
- **Clube do Motorista**: inexistente como feature; será vitrine demo substituível (Fase 10).
- **AlugaVan**: apresentação demo (Fase 11).
- **Financeiro/Combustível/Inteligência/Oportunidades**: cenários demo até ligarem aos motores/`consumo_kml` (Fases 8/9).
- **Dados-semente do banco**: 6 `drivers` `is_demo=true`, 46 `destinations`, 0 rotas/veículos reais (ver `08`/auditoria). O script de importação "30 motoristas/112 rotas" do PR #13 **não foi executado**.

## Inventário centralizado de substituição (manter atualizado por fase)
| Recurso demo | Onde vive hoje | Vira real em | Fonte real planejada |
|--------------|----------------|--------------|----------------------|
| Clube (ofertas) | fixtures `src/data/demo/clube.ts` (a criar) | Fase 10 | futura tabela `club_offers` |
| Financeiro/Combustível | `/pro` hardcoded | Fase 9 | `vehicles.consumo_kml` + distâncias dos motores + preços informados |
| Oportunidades | `/pro` hardcoded | Fase 8 | motor progressivo sobre rotas reais |
| AlugaVan | `/pro` hardcoded | Fase 11 | conteúdo/catálogo (a definir) |
| Dashboard (indicadores sem fonte) | `/pro`/painel | Fase 6 | contagens de `routes`/`vehicles`/ocupação |

Regra: enquanto um recurso for demo, **marcação discreta** na UI ("exemplo"/
"ilustrativo") para o usuário não confundir com dado/desconto/resultado real.
