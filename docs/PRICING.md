# Pricing: what a run costs, and what you keep

Three separate numbers, and it matters that they are not confused:

| | |
|---|---|
| **Provider cost** | What fal.ai or OpenAI charges for the call. This is the real cost. |
| **Credits** | This service's unit. A run costs `provider USD × multiplier` credits. |
| **Credit price** | What one credit is sold for. **This is the only number that sets your markup.** |

## Credit formula

ModelDeck's credit formula:

```
image credits = ceil(provider USD × 250)
video credits = provider USD × 320 per second
```

An edit multiplier of 1.3 applies to image models whose price is not already
flat. A 2× factor applies to reference-video edits where the provider bills
input plus output.

## Markup

`CREDIT_PRICE_USD` (default `0.004`) is the only number that sets your markup:

| `CREDIT_PRICE_USD` | Image markup | Video markup |
|---|---|---|
| 0.004 (default) | **1.00×** | **1.28×** |
| 0.0165 | 4.13× | 5.28× |
| 0.058 | 14.5× | 18.6× |

At `0.004` an image costs exactly what the provider charges and a video costs
1.28×. Raise it to add a margin.

## Credits are not a subscription

ModelDeck skips the subscription layer entirely: users pay the model provider
directly (fal.ai / OpenAI), so there is no subscription, no credit pack, and
no checkout to build. The credit ledger still exists to make the cost of a run
visible.

## fal.ai billing

fal.ai bills **USD**, not a separate credit unit, and never charges for server
errors (HTTP 5xx). Every model in the catalogue shows its provider cost up
front. New fal accounts get 2 concurrent jobs; excess jobs queue. Self-serve
cap is 40 concurrent.

See `docs/MODEL-REGISTRY.md` for every model, its upstream id and its price.
