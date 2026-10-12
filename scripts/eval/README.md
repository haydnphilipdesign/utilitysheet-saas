# Provider suggestion evaluation

Run by hand before changing the model, the thinking level, a prompt, the quality
gate or the number of passes. It runs the same suggestion pipeline sellers get,
without the cache, workspace history or telemetry, on a fixed set of places
where the right provider is known, and writes the results to the ignored
`.eval/` folder.

It covers provider suggestions only. Provider search and contact lookups are
not evaluated.

## Cases

- `scripts/eval/cases/hard-cases.json` (committed): hand-written hard places.
  `"verified": false` means the answer has not yet been checked against the
  provider's own site.
- `scripts/eval/cases/local-hard-cases.json` (committed): small-town water and
  sewer, places whose mailing city is not the municipality, and rural propane
  and oil, each read on the provider's own site. It is a separate file so the
  12 cases above stay the same set between runs; run it with
  `--hard-cases scripts/eval/cases/local-hard-cases.json`. Propane and oil
  cases accept one checked dealer although others deliver there too.
- `.eval/cases/silver.json` (ignored, never commit without reading it): built
  from past seller answers by `npm run eval:export`. It reads the live database
  and needs the owner's approval each time. It holds city, state, ZIP and
  provider names only; some names were typed by sellers and can be a person's
  name. Requests a coordinator edited after submission are left out.

A silver answer is what a seller confirmed, not a checked fact. `origin` says
whether sellers picked a name the product suggested (`suggested`, which favors
whatever the product already said) or typed or searched for it (`typed`).

## Running

```powershell
npm run eval:export                       # live database read; ask first
npm run eval:run -- --silver 18 --hard 12 # prints the plan, calls nothing
npm run eval:run -- --silver 18 --hard 12 --label baseline --yes
npm run eval:compare -- .eval/results/a.json .eval/results/b.json
```

`--yes` calls the real model. A case costs up to three model calls (two for
electric, gas, water and sewer), and a call
can run several Google searches from the 5,000 a month production shares. The
run stops after four cases in a row end with a model call failure.

Options (defaults are production's settings as known on 2026-10-12):

| Option | Values | Default |
|---|---|---|
| `--model` | a Gemini model name | `gemini-3.1-flash-lite` |
| `--thinking` | `default`, `minimal`, `low`, `medium`, `high` | `low` |
| `--passes` | `one` (no verify pass), `two` (verify where the product uses it: not for electric, gas, water or sewer) | `two` |
| `--recovery` | `on`, `off` | `on` |
| `--grounding` | `on`, `off` | `on` |
| `--silver`, `--hard` | how many cases of each kind; `0` for none | all |
| `--hard-cases` | path of the hard case file | `scripts/eval/cases/hard-cases.json` |
| `--min-confirmations` | seller answers a silver case needs | `2` |
| `--seed` | changes which cases are picked | `eval` |
| `--concurrency` | 1 to 4 | `2` |
| `--label` | name of the result files | from the settings |

The same seed and limits pick the same cases, so two configurations can be
compared. A prompt or gate change is a code change: run once before and once
after, with different labels. The result file records the commit.

## Reading the results

One CSV row per case and a JSON file with the totals. A name is correct when it
has the product's canonical key of an accepted name ("exact"), or when the
identifying words of one are all in the other ("partial"). Partial is a proxy.

- "Ended on the generic list": the seller would have seen the national list.
- "Extra names per one-provider case": for electric, gas, water and sewer.
- Token cost uses list prices in `eval-core.ts`; search cost is shown at list
  price as if the free allowance were used up.
- Usage of a model call that failed or timed out is not reported by Google, so
  token and search totals are a floor.

Not measured yet: latency per pass, and the share of sources from the
provider's own or a government site (the pipeline keeps a source count only).

A change ships only if it does not lower the top-answer and top-3 rates and
improves at least one of accuracy, latency or cost.
