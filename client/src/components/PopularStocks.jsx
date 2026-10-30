import { useEffect, useState } from 'react';
import { api } from '../api.js';

const REFRESH_MS = 5000;
const RETRY_MIN_MS = 1000;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signed = (n, suffix = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}${suffix}`;

function Sparkline({ points, up }) {
  if (points.length < 2) return null;
  const w = 160;
  const h = 44;
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / range) * (h - 4)).toFixed(1)}`)
    .join('');
  return (
    <svg className={`spark ${up ? 'spark--up' : 'spark--down'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PopularStocks() {
  const [data, setData] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let retryMs = RETRY_MIN_MS;

    const schedule = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(load, ms);
    };

    // On failure, retry quickly (1s, 2s, 4s, capped at the normal refresh) so the
    // table recovers soon after the API comes back, e.g. after a server restart.
    function load() {
      if (document.hidden) return;
      api
        .popularStocks()
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setReconnecting(false);
          retryMs = RETRY_MIN_MS;
          schedule(REFRESH_MS);
        })
        .catch(() => {
          if (cancelled) return;
          setReconnecting(true);
          schedule(retryMs);
          retryMs = Math.min(retryMs * 2, REFRESH_MS);
        });
    }

    const onVisible = () => {
      if (!document.hidden) load();
    };

    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <section className="stocks" aria-labelledby="stocks-heading">
      <div className="stocks__head">
        <h3 id="stocks-heading" className="home__subtitle">
          Popular stocks
        </h3>
        {data && (
          <span className="stocks__updated" role="status">
            {reconnecting
              ? 'Reconnecting…'
              : `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`}
          </span>
        )}
      </div>

      <div className="stocks__card">
        {reconnecting && !data ? (
          <p className="stocks__empty" role="status">
            <span className="spinner" /> Reconnecting to market data…
          </p>
        ) : !data ? (
          <p className="stocks__empty">
            <span className="spinner" /> Loading quotes…
          </p>
        ) : (
          <table className="stocks__table">
            <thead className="visually-hidden">
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Trend</th>
                <th scope="col">Price</th>
                <th scope="col">Change today</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => {
                const up = s.change >= 0;
                return (
                  <tr key={s.symbol}>
                    <th scope="row" className="stock__name">
                      <strong>{s.symbol}</strong>
                      <span>{s.name}</span>
                    </th>
                    <td className="stock__trend">
                      <Sparkline points={s.history} up={up} />
                    </td>
                    <td className="stock__price">{usd.format(s.price)}</td>
                    <td className="stock__change">
                      <span className={`pill ${up ? 'pill--up' : 'pill--down'}`}>
                        {signed(s.changePercent, '%')}
                      </span>
                      <small className={up ? 'amount--in' : 'amount--out'}>{signed(s.change)}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="stocks__note">Sample data for demonstration only. These are not real market prices.</p>
    </section>
  );
}
