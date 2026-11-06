# 02 — Mapa de Integrações (fluxo real dos dados)

Verificado no código (`main`) e no banco (`rnulmjdsvvuirqijemzy`). Para cada
informação: **tela que produz → tabela → serviço → quem consome → cálculos →
validações → permissões → o que quebra → como testar.**

## Tabelas do banco (públicas) e papéis
`drivers`, `vehicles`, `routes`, `route_stops`, `route_passengers`, `destinations`,
`driver_destinations`, `documents`, `document_requirements`, `verification_reviews`,
`cities`, `profiles`, `user_roles`, `leads`, `waitlist_requests`, `audit_events`.
RLS **ativa** em todas as de negócio. View pública: **`public_listings`**.

### `public_listings` (o que o marketplace realmente lê)
`SELECT … FROM drivers d WHERE motorista_elegivel(d.*)` — projeta colunas de
**`drivers`** + `destination_ids` (de `driver_destinations`). **Não** faz join com
`vehicles`. Campos expostos: `capacity_total`, `seats_available`, `feature_ac`,
`feature_monitor`, `feature_seatbelt`, `feature_accessible`, `price_*`, `turnos`,
`neighborhoods`, `boarding_time`, `tolerance_*`, `doc_verified`, `is_demo`.

## Mapa por informação

### A) Características da VAN (ar-condicionado, acessibilidade, cintos, lugares, fotos, consumo)
- **Produz:** `VeiculosPage` (`/painel/veiculos`).
- **Serviço:** `salvarVeiculo`/`listarVeiculos` (`src/data/motorista-store.ts`).
- **Tabela:** **`vehicles`** (`model, year, plate, seats_passenger, feature_ac, feature_accessible, feature_seatbelt, consumo_kml, photo_urls, is_demo, owner_id`).
- **Quem consome hoje:** só o próprio painel do motorista (releitura) e, por `vehicle_id`, a rota (vínculo). **O marketplace NÃO consome `vehicles`.**
- **Cálculos:** `consumo_kml` é insumo natural do módulo Combustível (já existe a coluna; ainda sem uso real).
- **Validações:** campos do formulário; RLS por dono.
- **Permissões:** RLS limita ao `owner_id`; `is_demo=false` escondido/filtrado.
- ⚠️ **LACUNA CRÍTICA (GAP-1):** o marketplace mostra recursos/capacidade de **`drivers`** (`feature_ac`, `capacity_total`…), não de `vehicles`. **Não há trigger de sincronização `vehicles → drivers`** (triggers existentes são só `updated_at` e proteção de colunas). Resultado: **editar a van NÃO altera o que o público vê.**
- **O que quebra se mexer:** mudar o mapeamento de `vehicles` sem decidir a fonte de verdade deixa marketplace e painel divergentes.
- **Como testar:** editar AC na van → reler `public_listings` do mesmo motorista → hoje **não** muda (comprova a lacuna). Meta da Fase 5: passar a mudar (respeitando publicação).

### B) Perfil público do motorista (nome, foto, bairros, turnos, preço, capacidade, vagas, janela)
- **Produz:** hoje **ninguém pelo lado do motorista.** Não há tela nem serviço que faça `insert/update` em `drivers` pelo motorista. **Só o admin escreve** (`adminAtualizarMotorista` em `src/data/source.ts`, campos `is_published/is_suspended/seats_available`).
- **Tabela:** `drivers` (+ `driver_destinations` para destinos atendidos).
- **Quem consome:** `public_listings` → `source.ts` `listarMotoristas`/`obterMotoristaPorSlug` → `VitrineProvider` → `SearchResultsPage`, `FeaturedDrivers`, `DriverProfilePage`.
- ⚠️ **LACUNA CRÍTICA (GAP-1b):** o motorista real **não tem como criar/editar o próprio registro `drivers`**. Os 6 motoristas do banco são **semente `is_demo=true`**. Sem isso, um motorista real nunca aparece no marketplace. Esta é a integração central a resolver (Fase 5).

### C) Elegibilidade/publicação no marketplace
- **Regra:** função `motorista_elegivel(drivers)` (usa também `condutor_documentos_ok`, `veiculo_documentos_ok`). Controla se a linha entra em `public_listings`.
- **Produz:** admin (`is_published`), documentos (`documents` + `verification_reviews`).
- **Permissões:** `trg_proteger_driver` fixa colunas reservadas (`doc_verified`, `rating_*`, `is_suspended`, `is_demo`, `owner_id`, `slug`) para não-admin.
- **Como testar:** alternar `is_published` no admin → motorista some/aparece na vitrine.

### D) ROTAS (escola, paradas, embarque/desembarque, horários, sentido, passageiros, capacidade, reservados, monitor, coordenadas)
- **Produz:** `RotaBuilderPage` (`/painel/rota/:id`).
- **Serviço:** `salvarRota`→RPC **`salvar_rota_completa`**; `listarRotas`/`mapRotaDoBanco` (`motorista-store.ts`).
- **Tabelas:** `routes` (+`version`) / `route_stops` / `route_passengers`.
- **Quem consome:** o próprio construtor; `MapaInterativoRota`; o **simulador** (`SimuladorEncaixePage`) via adaptadores; os **motores** (`src/engine/*`) via `src/lib/encaixe.ts`, `rota-para-encaixe.ts`, `rota-para-motor.ts`.
- **Cálculos:** ocupação por trecho (`ocupacao-rota.ts`), horários/planejamento (`planejamento.ts`), encaixe geográfico/progressivo (`encaixe-geografico.ts`), matriz viária (`matriz-viaria.ts` + `api/mapas.ts` op `matriz`).
- ⚠️ **DEPENDÊNCIAS (GAP-3):**
  - `route_passengers` **não tem** os 5 campos de compromisso no banco → **migração 0010 não aplicada**. `mapRotaDoBanco`/`rotaParaBanco` já os referenciam (a leitura hoje viria vazia/erro conforme o select).
  - **`salvar_rota_completa` apaga e recria** `route_passengers`+`route_stops` a cada salvamento → risco a IDs/vínculos e perda de compromissos se o payload não reenviar tudo. Correção recomendada (upsert por id + COALESCE) ainda não aplicada.
- **Como testar:** criar/editar rota com Supabase ativo; reler e conferir paradas/passageiros/ids; simular encaixe e comparar com os testes de referência dos motores.

### E) Busca das famílias (marketplace)
- **Produz critérios:** `SearchForm` (cidade, destino, turno, contratação/mensal/avulso, data).
- **Serviço/filtro:** `src/lib/matching.ts` `buscarMotoristas` — filtra por **cidade, destino (`destinosIds`), turno, vagas>0** e ordena por disponibilidade/avaliação/vagas.
- ⚠️ **LACUNA (GAP-2):** `recursos` da van (AC/monitor/cinto/acessibilidade) são **exibidos** nos cartões/perfil, mas **não são critérios de filtro**. Se o produto quiser "filtrar por acessibilidade", é desenvolvimento novo (e depende de GAP-1).
- **Futuro:** o §9 do Algoritmo Supremo prevê a busca consultar **rotas reais** pelos motores — ainda não ligado (busca usa o filtro simples acima).

### F) Contato/lead (WhatsApp) e lista de interesse
- **Produz:** `DriverProfilePage` (contato), `WaitlistForm`.
- **Serviço/RPC:** `solicitar_contato_whatsapp` (devolve telefone, grava lead), `registrar_interesse`.
- **Tabelas:** `leads`, `waitlist_requests`. `public_listings` **não** expõe telefone (privacidade).

## Resumo das lacunas (entram no plano)
| ID | Lacuna | Fase que trata |
|----|--------|----------------|
| GAP-1 | Van (`vehicles`) não reflete no marketplace (`drivers`); sem sync | Fase 5 |
| GAP-1b | Motorista não edita o próprio `drivers` (perfil público) | Fase 5 |
| GAP-2 | Recursos da van não filtram a busca | Fase 8/plano marketplace (fora do redesign puro) |
| GAP-3 | Rotas: migração 0010 + RPC apaga-e-recria não reconciliadas | Pré-requisito das Fases 7/8 |
| GAP-4 | `/pro` é 100% demonstrativo e desconectado do real | Fases 2/6 (unificação) |
