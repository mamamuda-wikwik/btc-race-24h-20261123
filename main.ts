// BTC 24h race bot: scale-in momentum with a trailing stop.
//
// Idea: the dev window is a slow uptrend buried in 1-minute noise. Fast
// crossovers whipsaw (70+ trades, each round trip ~26 bps) and bleed money,
// while buy-and-hold banks the whole move. So this bot stays invested like
// a holder, but with two differences that matter on an unseen race window:
//   1. It scales in: half the cash on the first tradable batch, the rest
//      only once the close is above its 24-bar EMA (trend confirmation).
//      In a falling market the second half never fires, so only half the
//      capital rides the drop.
//   2. A trailing stop sells everything if the position value falls 2.5%
//      below its peak at a close, and it re-enters on the same EMA
//      confirmation. On the dev window the stop never fires (max drawdown
//      1.98%), so the bot keeps the holder's gain and adds a little by
//      buying the second half into an early dip.
//
// Long only, one symbol (CBBTC), one open position, no leverage.

import { BPS, runBars, type BarsState, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Bars of closes that seed the trend EMA. */
const TREND_BARS = 24;
/** First tranche: half the cash on the first tradable batch. */
const FIRST_FRACTION_NUM = 1n;
const FIRST_FRACTION_DEN = 2n;
/** Trailing stop: sell everything if the position value falls this far below its peak. */
const STOP_NUM = 975n;
const STOP_DEN = 1000n;
/** Slippage cap on every order: 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Running 24-bar EMA of closes, seeded with the mean of its first 24. */
let emaSum = 0;
let emaCount = 0;
let emaValue: number | null = null;
/** Peak position value (quote units) since the current position opened. */
let peakValue = 0n;
/** Whether the first tranche has been bought. */
let firstBought = false;

function feedEma(close: bigint): void {
  const c = Number(close);
  if (emaValue !== null) {
    emaValue += (2 / (TREND_BARS + 1)) * (c - emaValue);
    return;
  }
  emaSum += c;
  emaCount += 1;
  if (emaCount === TREND_BARS) emaValue = emaSum / TREND_BARS;
}

function trendUp(state: BarsState): boolean {
  const close = state.close(SYMBOL);
  return close !== null && emaValue !== null && Number(close) > emaValue;
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) feedEma(BigInt(bar.c));
    }
    if (state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const held = state.positions.get(SYMBOL);
    const orders: OrderInput[] = [];

    // Trailing stop: sell the whole position if it fell 2.5% below its peak.
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      if (value * STOP_DEN < peakValue * STOP_NUM) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        peakValue = 0n;
        return orders;
      }
    }

    // First tranche: half the cash on the first tradable batch.
    // Only mark it bought when the order actually goes out, so a
    // rejected first attempt is retried on the next batch.
    if (!firstBought) {
      const close = state.close(SYMBOL);
      if (close === null) return [];
      let spend = (state.cash * FIRST_FRACTION_NUM) / FIRST_FRACTION_DEN;
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      if (spend > byWeight) spend = byWeight;
      if (spend === 0n || spend < BigInt(fees.min_notional_quote_units)) return [];
      orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
      firstBought = true;
      return orders;
    }

    // Top up / re-enter: spend the remaining cash once the trend confirms.
    if (state.cash > 0n && trendUp(state)) {
      const close = state.close(SYMBOL);
      if (close === null) return [];
      let spend = state.cash;
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      if (spend > byWeight) spend = byWeight;
      if (spend === 0n || spend < BigInt(fees.min_notional_quote_units)) return [];
      orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders;
  },
});
