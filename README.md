# Calculadora de Rendimentos

**Quanto o meu dinheiro rende de verdade?**

Você informa um valor, um prazo e, se quiser, um depósito mensal. O app simula esse período **no passado recente**, com os números oficiais do Banco Central, e compara quatro aplicações já descontando impostos, taxas e inflação:

- **Poupança**
- **CDB** (percentual do CDI ajustável)
- **LCI/LCA** (percentual do CDI ajustável; isenta de IR, com carência)
- **Tesouro Selic**

🔗 **Acesse:** https://0holylight.github.io/calculadora-rendimentos/

## O que o app mostra

- **A escada de cada aplicação:** total investido → + rendimento bruto → − impostos e taxas → − inflação → **ganho real**.
- **O custo de deixar na poupança:** quanto você teria a mais na melhor alternativa.
- **Ganho real mês a mês:** um gráfico de quanto cada aplicação estaria acima da inflação se você resgatasse em cada mês.

## De onde vêm os números

Dados do [Sistema Gerenciador de Séries Temporais (SGS)](https://www3.bcb.gov.br/sgspub/) do Banco Central, buscados direto do navegador:

| Série | Código |
|---|---|
| IPCA mensal | 433 |
| Poupança (rentabilidade, aniversário no dia 1º) | 196 |
| CDI diário | 12 |
| Selic diária | 11 |

As regras fixas ficam no código:

- **IR regressivo sobre o rendimento:** 22,5% / 20% / 17,5% / 15%, pelos dias corridos.
- **IOF:** para resgates com menos de 30 dias.
- **Custódia da B3 no Tesouro Selic:** 0,20% ao ano sobre o que passar de R$ 10 mil.
- **Carência da LCI/LCA:** 9 meses.

O **rendimento real** usa a equação de Fisher: `(1 + rendimento líquido) / (1 + inflação) − 1`. Cada depósito é corrigido pelo IPCA a partir do mês em que entrou.

## Conferência

Além dos testes, `npm run conferir` compara o app com gabaritos oficiais do Banco Central: o IPCA acumulado em 12 meses (série 13522) e o CDI e a Selic de cada mês (séries 4391 e 4390). Em janelas de 1, 3 e 10 anos, a diferença fica abaixo de 0,04 ponto percentual. Ela vem só do arredondamento das séries mensais, que têm 2 casas decimais.

## Simplificações

- Todos os depósitos entram no dia 1º do mês, e o resgate é no dia 1º do mês seguinte ao último IPCA divulgado.
- O CDB tem liquidez diária.
- O Tesouro Selic rende a Selic do dia, sem ágio nem deságio no preço.
- A custódia é calculada mês a mês.
- As regras atuais de IR, IOF, custódia e carência valem para o período todo.

> Ferramenta educativa, **não é recomendação de investimento**. Rentabilidade passada não garante rentabilidade futura.

## Como rodar

Requer **Node 24** ou mais novo.

```bash
npm install
npm run dev        # página em http://localhost:5173
npm run terminal -- 1000 12 0 100 90   # versão de terminal: valor, meses, depósito mensal, % CDI do CDB, % CDI da LCI/LCA
npm run typecheck  # conferência de tipos
npm test           # testes das contas, das datas e da busca (Banco Central simulado, sem internet)
npm run conferir   # compara o app com séries oficiais já acumuladas do Banco Central (usa a internet)
npm run build      # gera o site em dist/
```

## Como o código está organizado

| Arquivo | Papel |
|---|---|
| `src/bcb.ts` | Busca as séries no Banco Central, valida o formato (`unknown` → tipos) e converte texto em número |
| `src/calculos.ts` | Contas puras: fatores, IR, IOF, custódia, carência, inflação e a trajetória mês a mês |
| `src/datas.ts` | Contas puras com meses e dias corridos, sem `Date` local, para evitar problemas de fuso |
| `src/simulacao.ts` | Valida o pedido, chama os dois arquivos acima e devolve um objeto `Simulacao` |
| `src/App.tsx`, `src/Grafico.tsx` | A página: formulário, carrossel de aplicações, placar e gráfico |
| `src/terminal.ts` | A mesma simulação, exibida no terminal |

Feito com TypeScript (strict, sem `any`), React 19 e Vite.

## Licença

MIT
