# Motor de encaixe — contrato de segurança e validação

> Documento técnico do protótipo acadêmico. Não modifica decisões de produto anteriores.

## Regras confirmadas pelo projeto
- Uma rota pode receber um novo aluno somente se cada compromisso anterior mantiver seu horário de referência com variação de **no máximo 10 minutos**, para mais ou para menos. Restrições individuais menores prevalecem.
- **Nenhuma escola** pode receber alunos depois do limite cadastrado. Cada escola intermediária precisa de seu próprio limite, não apenas a última.
- O motorista só pode aceitar uma proposta após revalidar disponibilidade, rota e dados viários. Simulação não é reserva.
- Ida e volta são independentes: a busca em casa e a chegada à escola não garantem a busca na escola e a chegada em casa.
- Os quatro horários devem aparecer na interface; horário e distância dependem de tempos rodoviários verificáveis.

## Implementado na branch isolada
- `src/engine/encaixe-geografico.ts`: enumera posições de embarque/desembarque preservando a ordem dos compromissos existentes; verifica limites, ocupação por trecho e variação de horários.
- `src/engine/encaixe-geografico.test.ts`: testes automatizados de cenários críticos.
- `/pro/encaixe`: laboratório responsivo, **somente com dados sintéticos**, sem apresentar previsões fictícias como reais.

## Limites atuais (não afirmar que já funciona em produção)
- A matriz de deslocamentos do laboratório é fictícia e não cobre ruas reais. Não existe conexão Google Routes neste módulo.
- O motor ainda não consulta dados reais do Supabase nem a busca pública; o laboratório é isolado.
- A validação de passageiro, escolas múltiplas, itinerários cruzados, datas, restrições específicas de cada passageiro, feriados, retorno com diferentes escolas, horários de saída e trânsito dinâmico precisa ser ampliada antes de produção.
- A mudança de rota e a reserva de vaga não são persistidas transacionalmente; exigem autorização do motorista, controle de versão e verificação atômica no backend.
- Não há cálculo de tarifa contratada; não exibir preço automático.
- O teste automatizado no GitHub Actions e a compilação devem ser verificados no PR; arquivos de teste escritos não são evidência de execução aprovada.

## Próxima integração segura
1. Modelar paradas e passageiros com coordenadas geocodificadas, identificadores de escola, horários prometidos e limites por escola, sem expor endereço de crianças publicamente.
2. Criar provedor de matriz rodoviária no backend com chave privada, quotas e tratamento explícito de falha. Nunca usar distância em linha reta como substituta silenciosa.
3. Usar a mesma função pura de avaliação para prévia do motorista e resultado da família, diferenciando pedido pendente e vaga confirmada.
4. Revalidar a versão da rota e a capacidade por trecho no momento da confirmação, em transação; não aceitar resultado desatualizado.
5. Executar testes de regressão, casos de fronteira de 10 minutos, várias escolas e rotas de volta; só então ativar resultados reais.

## Política de alterações
Não modificar `main`, não mesclar automaticamente, não publicar como disponível sem testes e não alterar decisões do projeto sem aprovação dos autores.
