# Entrega final — Van Bora / Vambora

> Documento para iniciantes. Explica, em português simples, **o que foi construído**,
> **o que funciona de verdade e o que é demonstração**, e **como rodar, testar,
> verificar o banco, publicar e reverter**. Nenhum passo exige ser programador.

---

## 1. O que é o projeto

- **Van Bora** é o nome acadêmico do trabalho (Ideathon da Fatec Araçatuba).
- **Vambora** é o marketplace público: a família procura uma van que combine com a
  rota do filho e fala com o motorista pelo WhatsApp.
- **Vambora Pro** é o aplicativo do motorista (demonstração visual).

Tecnologia: site em React + Vite, instalável como app (PWA), com banco de dados no
Supabase. O "motor de encaixe" (que decide se uma van cabe numa rota) foi feito e
revisado à parte e **não foi alterado** nesta entrega.

---

## 2. O que funciona de verdade × o que é demonstração

| Parte | Situação | Observação |
|---|---|---|
| Abertura animada + home | **Real** | Identidade visual premium, instalável como app. |
| Busca pública (família) | **Real (resultados simulados e honestos)** | A lista de vans de exemplo usa `src/lib/matching.ts`. A tela deixa claro quando é exemplo. |
| Lista de interesse (quando não há van) | **Real quando o Supabase está ligado** | Grava em `waitlist_requests` por função segura (RPC). Sem o banco, o envio é só simulado e a tela avisa. |
| Contato por WhatsApp | **Real** | Abre a conversa já com a mensagem pronta. |
| Painel / cadastro do motorista / construtor de rotas | **Real** | Grava no navegador (modo demo) ou no Supabase. |
| Simulador de impacto (Vambora Pro) | **Real (motor de verdade) sobre rota de exemplo** | Usa o motor real para dizer se um novo aluno cabe. |
| Números do Vambora Pro (alunos, financeiro, combustível…) | **Demonstração** | Dados de exemplo e consistentes (ver `src/data/motorista-demo.ts`). Sem dados reais de crianças. |

**Regra de ouro:** onde é exemplo, a tela diz que é exemplo. Nada se faz passar por real.

---

## 3. O Vambora Pro (app do motorista)

Endereço: **`/pro`** (ou botão "Conhecer o Vambora Pro" na página do motorista).

É marcado no topo como *"protótipo acadêmico — dados demonstrativos"*. Tem:

- **Início**: cartão do motorista (Tio João), indicadores, rota de hoje e avisos.
- **Rotas**: rotas de exemplo + botão para o **construtor visual real**.
- **Vagas (Oportunidades)**: famílias procurando van. Ao tocar, abre o
  **simulador de impacto**, que usa o **motor real** para responder "e se eu
  aceitar este aluno?".
  - Quem mora numa **parada que já existe** na rota: normalmente **cabe**
    (sob consulta do tempo a bordo).
  - Quem mora **fora da rota**: o motor **recusa**, porque encaixar atrasaria os
    outros alunos. Isso é honesto — o motor não é forçado a dizer "sim".
- **Financeiro**: receita, gráfico dos meses, mensalidades (valores de exemplo).
- **Mais**: passageiros, vagas por trecho, calendário, avisos, combustível,
  manutenção, documentação, relatórios, Clube do Motorista, AlugaVan e perfil.

---

## 4. Como rodar no seu computador

Pré-requisito: ter o Node.js instalado.

```bash
npm install        # instala as dependências (só na primeira vez)
npm run dev        # abre o site em modo desenvolvimento (http://localhost:5173)
```

Para ver a versão "de produção" (a mesma que vai para o ar):

```bash
npm run build      # gera a versão final na pasta dist/
npm run preview    # serve essa versão (http://localhost:4173)
```

---

## 5. Como testar

```bash
npm run build      # já confere os tipos (TypeScript) e monta o site
npx vitest run     # roda todos os testes automatizados
```

Hoje são **137 testes** e o build fica **verde** (sem erros). Os testes cobrem o
motor de encaixe, a ocupação por trecho, o adaptador do motor, os dados do
Vambora Pro e utilitários.

---

## 6. Como verificar o banco (Supabase)

1. O site só usa o Supabase quando as chaves estão configuradas
   (variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
   **Nunca** coloque chaves secretas no site — só a chave pública (anon).
2. Para provar que a gravação é real: faça uma busca sem resultado, preencha a
   lista de interesse e envie. Depois confira na tabela `waitlist_requests` do
   Supabase se apareceu uma linha nova com a hora do envio.
3. Detalhes em `docs/GUIA-SUPABASE.md`.

> A migração nova do cadastro de motorista
> (`supabase/migrations/20260104000007_cadastro_motorista.sql`) **ainda não foi
> aplicada** ao banco. Ela não apaga tabelas nem muda políticas de segurança
> existentes, mas só deve ser aplicada **com a sua autorização**.

---

## 7. Como publicar (demo)

O site está ligado à Vercel, que publica a partir da branch `main`.
Para publicar esta entrega:

1. Abra o Pull Request desta branch (`feat/ideathon-finalizacao`) para a `main`.
2. **Revise** (ou peça para a outra IA revisar o motor).
3. Só então faça o merge. A Vercel publica sozinha depois do merge.

> Nesta entrega **não** foi feito merge nem deploy — isso fica com você.

---

## 8. Como reverter se algo der errado

- No GitHub, cada Pull Request pode ser revertido com o botão **"Revert"**.
- Ou, pelo terminal, voltar para um commit anterior conhecido:

```bash
git log --oneline            # veja a lista de commits
git revert <id-do-commit>    # desfaz um commit específico, criando outro
```

Como a Vercel publica a partir da `main`, reverter na `main` volta o site ao estado
anterior na próxima publicação.

---

## 9. O que ficou pendente (honesto)

- Aplicar a migração do cadastro de motorista no Supabase (depende da sua
  autorização).
- Aviso automático para a lista de interesse (hoje o contato é manual).
- A busca pública usa dados de exemplo; ligá-la a motoristas reais depende de
  cadastros aprovados no banco.

Mais detalhes em `docs/PENDENCIAS.md`.
