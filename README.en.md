<p align="right"><a href="README.md">🇧🇷 Português</a> · 🇺🇸 English</p>

# Investment Returns Calculator

**How much does my money really earn?**

You enter an amount, a time frame and, optionally, a monthly deposit. The app compares four investments after taxes, fees and inflation, in two modes:

- **Looking back:** simulates the period **in the recent past**, using official Central Bank of Brazil figures.
- **Future projection:** projects the coming months (up to 5 years) using the **market expectations** from the Central Bank's Focus Survey.

The investments compared:

- **Poupança** (Brazilian savings account)
- **CDB** (bank certificate of deposit, adjustable percentage of the CDI rate)
- **LCI/LCA** (real-estate/agribusiness credit notes, adjustable percentage of the CDI rate; income-tax exempt, with a lock-up period)
- **Tesouro Selic** (government bond that tracks the Selic rate)

🔗 **Try it:** https://0holylight.github.io/calculadora-rendimentos/

> The app and its interface are in Portuguese, since it targets the Brazilian market.

## What the app shows

- **The ladder for each investment:** total invested → + gross return → − taxes and fees → − inflation → **real gain**.
- **The cost of leaving money in savings:** how much more you would have in the best alternative.
- **Shareable link:** the URL stores the simulation (`?valor=500&meses=12&aporte=200&cdb=110`). Whoever opens the link sees the same simulation, recomputed with the latest Central Bank data.
- **Reference rates:** typical market ranges for CDB and LCI/LCA (not an official average: the Central Bank doesn't publish an up-to-date series for this) and the equivalent rate, for example "an LCI/LCA at 90% of the CDI is equivalent to a CDB at ≈ 109% over this period".
- **Shareable image:** a 1080×1350 summary (the cost of leaving money in savings and the real return of each investment), drawn in the browser with `<canvas>`. On mobile it goes straight to the share sheet; on desktop it is downloaded as a PNG.
- **Month-by-month real gain:** a chart showing how far above inflation each investment would be if you redeemed it in each month.

## Where the numbers come from

Data from the Central Bank's [Time Series Management System (SGS)](https://www3.bcb.gov.br/sgspub/), fetched straight from the browser:

| Series                                           | Code |
| ------------------------------------------------ | ---- |
| Monthly IPCA (official inflation index)          | 433  |
| Savings account return (anniversary on the 1st)  | 196  |
| Daily CDI (interbank deposit rate)               | 12   |
| Daily Selic (benchmark interest rate)            | 11   |

For projections, expectations come from the Central Bank's [Expectations API (Olinda)](https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/aplicacao): the median Selic and IPCA for each year and the median IPCA for each month. Today's Selic target comes from series 432, and the TR (reference rate) from series 7811. The Selic follows a straight line to the end-of-year expectation for each year, and the CDI sits 0.10 percentage points below it.

The fixed rules live in the code:

- **Regressive income tax on the return:** 22.5% / 20% / 17.5% / 15%, by calendar days held.
- **IOF (financial operations tax):** for redemptions within 30 days.
- **B3 custody fee on Tesouro Selic:** 0.20% per year on the amount above R$ 10,000.
- **LCI/LCA lock-up period:** 9 months.

The **real return** uses the Fisher equation: `(1 + net return) / (1 + inflation) − 1`. Each deposit is adjusted by the IPCA from the month it was made.

## Verification

Besides the tests, `npm run conferir` compares the app with official Central Bank reference values: the 12-month accumulated IPCA (series 13522) and the monthly CDI and Selic (series 4391 and 4390). Over 1-, 3- and 10-year windows, the difference stays below 0.04 percentage points. It comes only from the rounding of the monthly series, which have 2 decimal places.

## Simplifications

- All deposits are made on the 1st of the month, and redemption happens on the 1st of the month after the latest published IPCA.
- The CDB has daily liquidity.
- Tesouro Selic earns the daily Selic rate, with no premium or discount in the price.
- The custody fee is calculated month by month.
- Current income tax, IOF, custody and lock-up rules apply to the entire period.

> Educational tool, **not investment advice**. Past performance does not guarantee future returns.

## Getting started

Requires **Node 24** or newer.

```bash
npm install
npm run dev        # page at http://localhost:5173
npm run terminal -- 1000 12 0 100 90   # terminal version: amount, months, monthly deposit, CDB % of CDI, LCI/LCA % of CDI
npm run typecheck  # type checking
npm test           # tests for the calculations, dates and data fetching (mocked Central Bank, no internet)
npm run conferir   # compares the app with already-accumulated official Central Bank series (uses the internet)
npm run build      # builds the site into dist/
```

## Code organization

| File                             | Role                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/bcb.ts`                     | Fetches the series from the Central Bank, validates the format (`unknown` → types) and converts text to numbers |
| `src/calculos.ts`                | Pure calculations: factors, income tax, IOF, custody, lock-up, inflation and the month-by-month path     |
| `src/datas.ts`                   | Pure month and calendar-day calculations, with no local `Date`, to avoid time-zone issues                |
| `src/simulacao.ts`               | Validates the request, calls the two files above and returns a `Simulacao` object                        |
| `src/App.tsx`, `src/Grafico.tsx` | The page: form, investment carousel, scoreboard and chart                                               |
| `src/terminal.ts`                | The same simulation, displayed in the terminal                                                          |

## Quality and deployment

Built with TypeScript (strict, no `any`), React 19 and Vite.

- **62 tests** with Vitest covering the calculations, dates and data fetching (mocked Central Bank, no internet).
- **Continuous deployment** with GitHub Actions: on every push to `main`, the tests run and the site is published to GitHub Pages only if they all pass.
- Consistent formatting with Prettier.

## License

MIT
