# 🚐 VanBora

**Uma forma de aproximar famílias e motoristas de transporte escolar, considerando as rotas que realmente podem atender cada aluno.**

Projeto acadêmico de estudantes do primeiro semestre de Análise e Desenvolvimento de Sistemas da Fatec Araçatuba, apresentado no Ideathon 2026.

## Sobre o projeto

Encontrar uma van escolar nem sempre é simples. Muitas famílias procuram transporte por indicação, grupos de WhatsApp ou redes sociais. Depois de encontrar um contato, ainda precisam perguntar se o motorista atende à escola, passa perto de casa, tem vaga e consegue chegar no horário.

Do lado dos motoristas, também existe uma dificuldade: encontrar novos alunos que se encaixem nos trajetos que eles já fazem.

Foi pensando nessas duas situações que surgiu o **VanBora**. A ideia não é apenas reunir contatos de motoristas, mas ajudar a encontrar opções que façam sentido para o percurso e para os horários de cada família.

## Nossa proposta

A família informa o endereço, a escola ou faculdade, o turno e se precisa de ida, volta ou dos dois trajetos.

O objetivo é comparar essas informações com as rotas cadastradas pelos motoristas, considerando o caminho percorrido, os horários e a capacidade do veículo. Quando houver dados suficientes, a busca poderá apresentar uma estimativa de quando a van passaria no endereço e chegaria ao destino.

Para o motorista, o sistema oferece um espaço para organizar seus trajetos e verificar possibilidades de atender novos alunos sem prejudicar os compromissos da rota.

## Funcionalidades

**Para famílias e estudantes**

- Pesquisa por endereço, escola ou faculdade e turno.
- Seleção de ida, volta ou ida e volta.
- Consulta de opções de transporte e informações públicas do motorista.
- Análise de compatibilidade com o trajeto e estimativas de horário, quando os dados permitirem.
- Possibilidade de entrar em contato com o motorista.

**Para motoristas**

- Cadastro de veículo e informações do serviço.
- Criação e organização de rotas, escolas e paradas.
- Gerenciamento de passageiros e capacidade.
- Visualização dos trajetos no mapa.
- Ferramentas para avaliar a inclusão de novos alunos.

As funcionalidades estão em diferentes estágios de desenvolvimento e validação.

## Como pensamos o encaixe de rotas

Uma van pode passar perto de uma casa e, mesmo assim, não conseguir atender àquela família. Ela pode estar indo no sentido contrário, não ter vaga naquele trecho ou não conseguir chegar à escola a tempo.

Por isso, trabalhamos com regras e algoritmos que consideram os pontos da rota, os deslocamentos, os horários e a ocupação do veículo. A proposta é verificar se um novo embarque pode ser incluído sem comprometer os demais passageiros.

O sistema já possui lógica de cálculo de encaixes. A ligação dessa lógica com as rotas reais cadastradas pelos motoristas está em processo de integração e testes. Os resultados demonstrativos usados nas primeiras versões não devem ser confundidos com disponibilidade real.

## Tecnologias utilizadas

| Tecnologia | Para que usamos |
| --- | --- |
| React e TypeScript | Interfaces e lógica da aplicação |
| Vite | Ambiente de desenvolvimento |
| Tailwind CSS | Estilo das telas |
| Supabase | Banco de dados e autenticação |
| GitHub | Organização e versionamento do código |
| Vercel | Publicação da aplicação |
| Vitest | Testes automatizados |

Outras bibliotecas e serviços usados no projeto estão descritos na documentação técnica.

## Como executar

É necessário ter **Node.js 20 ou superior**. Depois de clonar o repositório, execute na pasta do projeto:

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
```

Para executar os testes:

```bash
npm run test
```

Algumas funcionalidades dependem da configuração do Supabase. Veja [o guia de configuração](docs/GUIA-SUPABASE.md).

## Estado atual e próximos passos

O **VanBora é um protótipo acadêmico**, ainda não um serviço comercial de transporte disponível para contratação.

Construímos telas para famílias e motoristas, recursos de cadastro e gerenciamento de rotas e algoritmos relacionados à compatibilidade de trajetos. Durante o desenvolvimento, utilizamos simulações para observar o funcionamento da proposta.

Agora estamos trabalhando para usar as informações efetivamente cadastradas pelos motoristas na busca pública e testar, com rotas reais, os encaixes, os horários previstos e a disponibilidade de vagas.

Também precisamos continuar verificando os resultados em diferentes situações, especialmente para os trajetos de ida e volta.

## Nossa equipe e como desenvolvemos

Somos estudantes do primeiro semestre de Análise e Desenvolvimento de Sistemas da **Fatec Araçatuba**. Nosso trabalho envolveu identificar o problema, pesquisar as necessidades de famílias e motoristas, discutir a solução, definir funcionalidades e regras e testar o protótipo.

Utilizamos ferramentas de inteligência artificial como apoio na implementação do código, na construção das interfaces, na organização das informações e na revisão e nos testes. As decisões sobre o problema e sobre o funcionamento proposto foram trabalhadas pela equipe.

O uso de IA está documentado em [Uso de IA](docs/USO-DE-IA.md). As etapas anteriores ao Ideathon e as atividades realizadas durante o evento devem ser identificadas corretamente nos registros do projeto.

## Documentação

- [Arquitetura do sistema](docs/ARQUITETURA.md)
- [Modelo de dados](docs/MODELO-DE-DADOS.md)
- [Configuração do Supabase](docs/GUIA-SUPABASE.md)
- [Decisões do projeto](docs/DECISOES.md)
- [Pendências e limitações](docs/PENDENCIAS.md)
- [Uso de inteligência artificial](docs/USO-DE-IA.md)
- [Pesquisas do grupo](docs/pesquisas/)

---

**VanBora — Fatec Araçatuba | Ideathon 2026**
