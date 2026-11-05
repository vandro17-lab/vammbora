# Mapas reais no cadastro do motorista — configuração Vercel

## O que esta entrega faz
O cadastro existente em `/painel/rota/:id` ganhou a seção **Mapa da sua rota**. O motorista pode localizar cada parada pelo endereço, confirmar a sugestão geocodificada, e pedir o cálculo de minutos entre paradas pela rede viária. Os minutos são gravados nos campos já usados pelo motor de planejamento. O preenchimento manual continua disponível.

**Atenção:** o mapa e o cálculo NÃO funcionam até que a variável `GEOAPIFY_API_KEY` esteja configurada. A chave não pode ser gerada pelo GitHub, nem deve ser publicada no repositório.

## Como ativar
1. Criar uma conta no [Geoapify](https://www.geoapify.com/) e gerar uma API key para Geocoding API e Routing API. Consultar o plano gratuito, cotas e termos vigentes.
2. Na Vercel, abrir **o projeto correto** (há mais de um projeto conectado ao mesmo repositório), ir a **Settings > Environment Variables**, criar `GEOAPIFY_API_KEY` com o valor da chave, selecionando Preview e Production conforme necessário. **Não** prefixar com `VITE_`.
3. Fazer novo deployment da branch que contém `api/mapas.ts` e verificar a resposta de `POST /api/mapas` (não GET). A chave permanece no servidor.
4. No cadastro da rota, localizar as paradas individualmente e calcular os trechos. Revisar a sequência, os horários e salvar.

## Limitações explícitas
- O mapa incorporado exibe **apenas o primeiro ponto** da rota; não desenha ainda a linha completa com geometria. O cálculo usa os pontos em ordem e a Routing API.
- As coordenadas retornadas pela geocodificação exigem confirmação do motorista; nomes semelhantes ou numeração imprecisa podem apontar para locais errados.
- Os tempos são estimativas rodoviárias sem garantia de trânsito em tempo real; não são previsão exata de horário de chegada.
- Ao abrir o mapa incorporado, o primeiro ponto é enviado ao OpenStreetMap. Não abrir com dados sensíveis sem necessidade.
- A busca está limitada inicialmente a Araçatuba, SP. Para cidades da região, ampliar o contexto de busca e validar a área.
- Não há controle de autenticação/cotas por usuário no endpoint. **Antes de ativar em produção pública**, adicionar verificação de sessão, rate limit e monitoramento de consumo para evitar abuso da chave e cobrança.
- Não existe integração automática desta funcionalidade com a busca pública das famílias. A próxima fase dependerá de persistência dos pontos e validação do motor.
- O armazenamento de rotas com Supabase segue as permissões/RLS já existentes. Não expor dados de estudantes em endpoints públicos.
- Nenhuma variável da Vercel foi configurada automaticamente por este PR.

## Verificações
- `npm ci`
- `npm test -- --run`
- `npm run build`
- Testar `POST /api/mapas` em um preview Vercel com chave configurada, verificar erro controlado sem chave, rota com dois pontos, e falha de quota.

Não fazer merge sem revisão. A ativação em produção deve esperar proteção de API e teste real do provedor.
