import { useMemo, useState } from 'react';
import { ACCOUNT_LABELS, TX_LABELS, formatDateTime, formatMoney, isCredit, maskNumber } from '../format.js';

const ICONS = { deposit: '↓', withdrawal: '↑', transfer_in: '⇠', transfer_out: '⇢' };

export default function TransactionList({ transactions, accounts, selected, onFilterChange }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (!type || (type === 'in' ? isCredit(t.type) : !isCredit(t.type))) &&
        (!q || `${t.description} ${t.counterparty ?? ''}`.toLowerCase().includes(q))
    );
  }, [transactions, query, type]);

  return (
    <section className="panel" aria-labelledby="tx-heading">
      <div className="panel__header">
        <h2 id="tx-heading" className="section-title">
          Recent activity
          {selected && (
            <span className="muted">
              {' '}
              · {ACCOUNT_LABELS[selected.type]} {maskNumber(selected.number)}
            </span>
          )}
        </h2>
        <div className="filters">
          <input
            type="search"
            className="input input--sm"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search transactions"
          />
          <select
            className="input input--sm"
            value={selected?.id ?? ''}
            onChange={(e) => onFilterChange(e.target.value ? Number(e.target.value) : null)}
            aria-label="Filter by account"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {ACCOUNT_LABELS[a.type]} {maskNumber(a.number)}
              </option>
            ))}
          </select>
          <select
            className="input input--sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by direction"
          >
            <option value="">All types</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">
            🧾
          </p>
          <p>
            {transactions.length === 0
              ? 'No transactions yet. Make a deposit to get started.'
              : 'No transactions match your filters.'}
          </p>
        </div>
      ) : (
        <ul className="tx-list">
          {filtered.map((t) => {
            const credit = isCredit(t.type);
            return (
              <li key={t.id} className="tx">
                <span className={`tx__icon ${credit ? 'tx__icon--in' : 'tx__icon--out'}`} aria-hidden="true">
                  {ICONS[t.type]}
                </span>
                <div className="tx__body">
                  <span className="tx__title">{t.description}</span>
                  <span className="tx__meta">
                    {TX_LABELS[t.type]}
                    {t.counterparty && ` · ${credit ? 'from' : 'to'} ${t.counterparty}`}
                    {!selected && ` · ${ACCOUNT_LABELS[t.accountType]} ${maskNumber(t.accountNumber)}`}
                  </span>
                  <time className="tx__date" dateTime={t.createdAt}>
                    {formatDateTime(t.createdAt)}
                  </time>
                </div>
                <div className="tx__amounts">
                  <strong className={credit ? 'amount--in' : 'amount--out'}>
                    {credit ? '+' : '−'}
                    {formatMoney(t.amountCents)}
                  </strong>
                  <span className="tx__balance">Bal. {formatMoney(t.balanceAfterCents)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
