import { useEffect, useState } from 'react';
import { api } from '../api.js';

const REFRESH_MS = 5000;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signed = (n, suffix = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}${suffix}`;

function Sparkline({ points, up }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 32;
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / range) * (h - 4)).toFixed(1)}`)
    .join('');
  return (
    <svg className={`spark ${up ? 'spark--up' : 'spark--down'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PopularStocks() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      api
        .popularStocks()
        .then((d) => !cancelled && (setData(d), setError('')))
        .catch(() => !cancelled && setError('Market data is unavailable right now.'));
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="stocks" aria-labelledby="stocks-heading">
      <div className="stocks__head">
        <h3 id="stocks-heading" className="home__subtitle">
          Popular stocks
        </h3>
        {data && (
          <span className="stocks__updated">
            Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      <div className="stocks__card">
        {error && !data ? (
          <p className="stocks__empty">{error}</p>
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
