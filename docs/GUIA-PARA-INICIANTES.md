# Guia para Iniciantes — Vambora

Feito para quem está começando agora em ADS. Sem pressa, passo a passo.

## 1. O que você precisa instalar

1. **Node.js 20 ou superior** — https://nodejs.org (baixe a versão "LTS").
   - Para conferir se deu certo: abra o terminal e digite `node -v`. Deve aparecer algo como `v20...` ou `v22...`.
2. **Git** — https://git-scm.com — para baixar e enviar código.
3. Um editor: recomendamos **VS Code** — https://code.visualstudio.com

## 2. Baixar o projeto

No terminal:

```bash
git clone https://github.com/vandro17-lab/vammbora.git
cd vammbora
npm install
```

`npm install` baixa as "peças" que o projeto usa. Pode demorar um pouco na primeira vez.

## 3. Rodar no seu computador

```bash
npm run dev
```

Vai aparecer um endereço como `http://localhost:5173`. Abra no navegador. Pronto: o Vambora está
rodando na sua máquina. Para parar, aperte `Ctrl + C` no terminal.

## 4. Como cada integrante contribui (importante para o Ideathon)

O Ideathon exige **commits reais de pelo menos 3 pessoas**. Então cada colega faz assim:

1. Configure seu nome e e-mail do GitHub **uma vez**:
   ```bash
   git config --global user.name "Seu Nome"
   git config --global user.email "seu-email@exemplo.com"
   ```
2. Crie um branch para a sua tarefa (ex.: pesquisa de preços):
   ```bash
   git checkout -b pesquisa-precos
   ```
3. Faça seu trabalho (ex.: preencher um arquivo em `docs/pesquisas/precos/`).
4. Salve com commit:
   ```bash
   git add .
   git commit -m "Pesquisa de preços: coleta inicial"
   git push -u origin pesquisa-precos
   ```
5. No GitHub, abra um **Pull Request** para revisão.

> Mesmo quem não programa contribui de verdade: pesquisa, documentação, textos, testes manuais e
> organização **contam** e devem ser commitados pela própria pessoa.

## 5. Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o site para você testar |
| `npm run build` | Gera a versão final (e checa erros) |
| `npm run test` | Roda os testes automáticos |
| `npm run preview` | Testa a versão final |

## 6. Vocabulário rápido

- **Branch:** uma "linha" de trabalho separada, para não atrapalhar os outros.
- **Commit:** um ponto salvo, com uma mensagem do que você fez.
- **Push:** enviar seus commits para o GitHub.
- **Pull Request (PR):** pedido para juntar seu trabalho ao projeto principal, com revisão.
- **PWA:** site que pode ser "instalado" como um app no celular.

## 7. Quando algo der errado

- Leu uma mensagem vermelha e não entendeu? Copie e cole para o ChatGPT ou peça ajuda ao grupo.
- Nunca commite senhas, chaves ou dados pessoais reais.
- Em dúvida, pergunte antes de apagar arquivos.
