# BTC 24h Race Bot — Scale-In Momentum with Trailing Stop

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/mamamuda-wikwik/btc-race-24h-20261123/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/mamamuda-wikwik/btc-race-24h-20261123/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

## What this is

A bot that trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on 1-minute on-chain prices, with $1,000 of paper money. It races only if it made money on the published 24-hour dev window, and it is ranked by net PnL on the 24 hours that start 15 minutes after the deadline.

## Strategy

The dev window is a slow uptrend (+3.64%) buried in 1-minute noise. Fast crossovers whipsaw — the EMA(8)/EMA(21) baseline trades 76 times and loses $86 to fees — while buy-and-hold banks the whole move (+$33.62). So this bot stays invested like a holder, with two differences that matter on an unseen race window:

1. **Scale-in.** Half the cash on the first tradable batch, the rest only once the close is above its 24-bar EMA (trend confirmation). In a falling market the second half never fires, so only half the capital rides the drop.
2. **Trailing stop.** It sells everything if the position value falls 2.5% below its peak at a close, and re-enters on the same EMA confirmation. On the dev window the stop never fires (max drawdown 1.98%), so the bot keeps the holder's gain and adds a little by buying the second half into an early dip.

Long only, one symbol (CBBTC), one open position, no leverage. A full-size round trip costs about 26 bps in fees, slippage and impact, so every trade has to earn more than that.

## Dev-window result (local replay, 13 bps/leg fee model)

- Net PnL: **+$35.33** on $1,000 (beats buy-and-hold's +$33.62)
- Trades: 3 (buy 50%, buy 50% on EMA confirmation, flatten at the end)
- Max drawdown: 1.98% (trailing stop never fired)

## Files

- `main.ts` — the bot (Node 22, TypeScript, erasable syntax). Speaks `agent-fun/bars-replay/v1` through the SDK shim.
- `vendor/makefun-bars.ts` — the kit's SDK shim, byte-identical, kept under `vendor/`.
- `LICENSE` — MIT.

## Run

```sh
node main.ts
```

The harness sends `hello` once, then one batch per minute, then `done`. The bot answers every batch with exactly one reply. No network, no wall clock, no environment reads — time is the bar time in each batch.
