# Solicitação de pesquisa — Escolas e faculdades REAIS de Araçatuba/SP

> Objetivo: montar o cadastro **real** de destinos (escolas e faculdades) de
> Araçatuba, com **endereço verdadeiro**, separados por **nível de ensino**.
> O resultado será usado pelo motor de rotas do Vambora — por isso cada destino
> precisa de **endereço real** (e, de preferência, coordenadas) para calcular
> horários de verdade.

## Regras de honestidade (OBRIGATÓRIO)
1. **Só dados reais e verificáveis.** Nada de inventar nome, endereço, CEP ou
   coordenada. Se não tiver certeza de um campo, deixe-o `null` — **não chute**.
2. **Cite a fonte** de cada registro (URL) e a **data da consulta**.
3. Prefira fontes oficiais, nesta ordem:
   - **INEP / Censo Escolar / Qedu** (`qedu.org.br`) — nome oficial, código INEP, etapas, rede.
   - **Diretoria de Ensino de Araçatuba** (`dearacatuba.educacao.sp.gov.br`) — estaduais.
   - **Prefeitura / Secretaria Municipal de Educação de Araçatuba** — municipais (EMEBs).
   - **Site oficial da instituição** — faculdades e particulares.
   - Diretórios (escol.as etc.) só para complementar, sempre conferindo.
4. Endereço precisa ser o da **unidade física** em Araçatuba (não caixa postal).

## Níveis de ensino a cobrir (separar por estes rótulos)
- `infantil` — creche e pré-escola
- `fundamental_anos_iniciais` — 1º ao 5º ano
- `fundamental_anos_finais` — 6º ao 9º ano
- `medio` — ensino médio
- `tecnico` — ensino técnico/profissionalizante
- `eja` — educação de jovens e adultos (se houver)
- `superior` — faculdades e universidades

Uma mesma unidade pode ter **vários níveis** (ex.: uma escola de fundamental e médio).

## Quantidade e abrangência (meta inicial)
- **Faculdades/universidades:** todas as principais da cidade (há poucas).
- **Escolas:** um conjunto representativo — pelo menos **~10 estaduais**,
  **~10 municipais** e **~6 particulares**, espalhadas por bairros diferentes
  (Centro, Vila Mendonça, Jd. Nova Iorque, Água Branca, Jd. Alvorada, etc.).
- Pode entregar em lotes; o importante é cada registro estar completo e correto.

## Formato de ENTREGA (muito importante)
Entregar um **array JSON** com objetos neste formato exato (um objeto por unidade).
Assim eu encaixo direto no sistema, sem retrabalho:

```json
[
  {
    "nome": "EE Manoel Bento da Cruz",
    "tipo": "escola",
    "nivel": ["fundamental_anos_finais", "medio"],
    "rede": "estadual",
    "endereco": {
      "logradouro": "Rua Exemplo",
      "numero": "130",
      "bairro": "Bandeirantes",
      "cidade": "Araçatuba",
      "uf": "SP",
      "cep": "16015-530"
    },
    "lat": null,
    "lng": null,
    "codigoInep": null,
    "turnos": ["manha", "tarde", "noite"],
    "telefone": "(18) 0000-0000",
    "fonte": "https://...",
    "consultadoEm": "2026-11-05"
  }
]
```

### Regras de cada campo
| Campo | Obrigatório | Valores aceitos / formato |
|---|---|---|
| `nome` | sim | Nome oficial da unidade (como consta na fonte). |
| `tipo` | sim | `"escola"` ou `"faculdade"`. |
| `nivel` | sim | Lista com um ou mais dos rótulos de nível acima. |
| `rede` | sim | `"estadual"`, `"municipal"`, `"privada"` ou `"federal"`. |
| `endereco.logradouro` | sim | Rua/Avenida (sem o número). |
| `endereco.numero` | sim | Número; `"s/n"` se não houver. |
| `endereco.bairro` | sim | Bairro real. |
| `endereco.cidade` | sim | Sempre `"Araçatuba"`. |
| `endereco.uf` | sim | Sempre `"SP"`. |
| `endereco.cep` | se houver | Formato `00000-000`; `null` se não achar. |
| `lat` / `lng` | se houver | Graus decimais (WGS84), ex.: `-21.2089`. **Se não tiver certeza, `null`** — eu geocodifico pelo endereço. |
| `codigoInep` | se houver | Código INEP (8 dígitos) do Censo/Qedu; `null` se não achar. |
| `turnos` | sim | Lista com: `"manha"`, `"tarde"`, `"noite"`, `"integral"`. |
| `telefone` | não | Só se for público e oficial. |
| `fonte` | sim | URL da fonte principal do registro. |
| `consultadoEm` | sim | Data da consulta no formato `AAAA-MM-DD`. |

## O que NÃO precisa
- Não precisa inventar `id` (eu gero a partir do nome).
- Não precisa de dados de alunos, notas, nem telefones pessoais.
- Não precisa de foto.

## Já confirmado (não precisa refazer, mas pode conferir o endereço/CEP)
Faculdades (fonte: sites oficiais/diretórios, nov/2026):
- **Fatec Araçatuba (Prof. Fernando Amaral de Almeida Prado)** — Av. Prestes Maia, 1764, Jd. Ipanema — `superior`.
- **UNESP – Campus de Araçatuba** — Rua José Bonifácio, 1193, Vila Mendonça — `superior`.
- **UniToledo (Centro Universitário Toledo)** — Rua Antonio Afonso de Toledo, 595, Jd. Sumaré — `superior`.
- **UNIP Araçatuba** — Rua Baguaçu, 1939, Pq. Baguaçu — `superior`.

(Confirmar número/CEP e adicionar lat/lng quando possível.)
