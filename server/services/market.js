// Simulated quotes for the home page. These are NOT real market prices.
const SAMPLE_STOCKS = [
  ['AAPL', 'Apple Inc.', 227.5],
  ['MSFT', 'Microsoft Corp.', 418.2],
  ['NVDA', 'NVIDIA Corp.', 135.4],
  ['AMZN', 'Amazon.com Inc.', 186.9],
  ['GOOGL', 'Alphabet Inc.', 166.3],
  ['META', 'Meta Platforms Inc.', 575.1],
  ['TSLA', 'Tesla Inc.', 248.6],
  ['JPM', 'JPMorgan Chase & Co.', 221.8],
];

const HISTORY_LENGTH = 30;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Keeps an in-memory random walk per symbol. Prices only advance when a snapshot is
 * requested, by however many ticks have elapsed, so an idle server does no work.
 */
export function createMarket({ tickMs = 5000, now = Date.now, random = Math.random } = {}) {
  const stocks = SAMPLE_STOCKS.map(([symbol, name, open]) => ({ symbol, name, open, price: open, history: [open] }));

  const step = () => {
    for (const s of stocks) {
      // Up to ±0.4% per tick, with a gentle pull back toward the opening price.
      const drift = (s.open - s.price) / s.open / 20;
      s.price = Math.max(0.01, round2(s.price * (1 + (random() - 0.5) * 0.008 + drift)));
      s.history.push(s.price);
      if (s.history.length > HISTORY_LENGTH) s.history.shift();
    }
  };

  for (let i = 1; i < HISTORY_LENGTH; i++) step();
  let lastTick = now();

  return {
    snapshot() {
      const elapsed = Math.min(Math.floor((now() - lastTick) / tickMs), HISTORY_LENGTH);
      for (let i = 0; i < elapsed; i++) step();
      if (elapsed > 0) lastTick = now();
      return {
        updatedAt: new Date(lastTick).toISOString(),
        sample: true,
        stocks: stocks.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          change: round2(s.price - s.open),
          changePercent: round2(((s.price - s.open) / s.open) * 100),
          history: [...s.history],
        })),
      };
    },
  };
}
