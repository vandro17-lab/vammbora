# Vambora 🚐

**Marketplace de transporte escolar e universitário** para Araçatuba/SP — projeto acadêmico **Van Bora** (Fatec Araçatuba, Ideathon Fatec 2026).

O Vambora conecta famílias e estudantes a vans que realmente conseguem buscar o aluno na porta, chegar a tempo e ter vaga no horário certo — com base em **compatibilidade de rota**, não em distância em linha reta. A negociação acontece direto com o motorista pelo WhatsApp.

> ⚠️ **Protótipo acadêmico.** Os motoristas exibidos são **dados de demonstração**, sempre identificados. Não representa, ainda, um serviço contratável.

---

## ✨ O que já funciona (Etapa 1)

- **Landing page premium** com identidade Vambora (hero, benefícios, como funciona, motoristas em destaque, confiança, FAQ, chamada para motoristas).
- **Busca guiada** (cidade, endereço/bairro, escola/faculdade, turno, mensal/avulso, trajeto) — pública, sem login.
- **Estado de busca premium**: animação original de uma van percorrendo a rota, com mensagens honestas e respeito a `prefers-reduced-motion`.
- **Resultados** com filtro de compatibilidade (adaptador **simulado**, claramente marcado), cards com avaliação, vagas, horário de passagem, recursos e preço.
- **Perfil do motorista** com recursos do veículo, janela de embarque, status de verificação honesto e **CTA de WhatsApp com mensagem pronta**.
- **Lista de interesse** quando não há van compatível (com consentimento; gravação real virá na Etapa 2).
- **Prévia do painel do motorista** (estrutura preparada para a Etapa 3).
- **PWA instalável** (manifesto, ícones 192/512 + maskable, service worker versionado).
- **Testes automatizados** da lógica central (19 testes).

## 🧰 Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| UI | **React 18 + TypeScript + Vite** | Rápido, moderno, tipado |
| Estilo | **Tailwind CSS** (design system próprio) | Consistência e velocidade |
| Animações | **Framer Motion** | Transições premium, acessíveis |
| Ícones | **Lucide** | Conjunto coeso e leve |
| Rotas | **React Router** | Navegação entre telas |
| PWA | **vite-plugin-pwa** (Workbox) | Instalação e cache seguro |
| Testes | **Vitest** | Testes da lógica de negócio |

Licenças: todas MIT/ISC (compatíveis com uso acadêmico). Detalhes em [`docs/DECISOES.md`](docs/DECISOES.md).

## 🚀 Como rodar

```bash
npm install        # instala dependências
npm run dev        # ambiente de desenvolvimento (http://localhost:5173)
npm run build      # build de produção (inclui checagem de tipos)
npm run preview    # testa o build de produção
npm run test       # roda os testes
npm run icons      # regenera os ícones do PWA
```

Pré-requisito: **Node.js 20+**.

## 📁 Estrutura

```
src/
├── components/   # UI (marca, layout, home, busca, resultados, ui)
├── data/         # dados de demonstração (cidades, destinos, motoristas)
├── lib/          # lógica (matching simulado, whatsapp, utils, searchParams)
├── pages/        # telas (home, resultados, perfil, motorista, 404)
├── pwa/          # instalação e atualização do PWA
└── types/        # tipos de domínio
docs/             # documentação do projeto e pesquisas
```

## 📚 Documentação

- [`docs/PLANO-MESTRE.md`](docs/PLANO-MESTRE.md) — plano e referência à visão original
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — arquitetura e decisões técnicas
- [`docs/MODELO-DE-DADOS.md`](docs/MODELO-DE-DADOS.md) — entidades e evolução até Supabase
- [`docs/DECISOES.md`](docs/DECISOES.md) — registro de decisões (ADR)
- [`docs/GUIA-PARA-INICIANTES.md`](docs/GUIA-PARA-INICIANTES.md) — passo a passo para quem está começando
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) — o que falta e riscos
- [`docs/USO-DE-IA.md`](docs/USO-DE-IA.md) — declaração de uso de IA (exigência do Ideathon)
- [`docs/pesquisas/`](docs/pesquisas/) — pesquisas do grupo

## 🔐 Privacidade e honestidade

- Nunca publicamos endereço completo de nenhum aluno.
- Selo de "documentação verificada" só aparece com verificação **real** registrada.
- Dados de exemplo são sempre identificados como **demonstração**.

---

Feito com ❤️ pela equipe Van Bora — Fatec Araçatuba.
