import { useEffect, useRef, useState } from 'react';
import { ACCOUNT_LABELS, formatMoney, maskNumber } from '../format.js';

const TITLES = { deposit: 'Deposit money', withdraw: 'Withdraw money', transfer: 'Transfer money' };
const OTHER = 'other';

export default function MoneyModal({ mode: initialMode, initialAccountId, accounts, onSubmit, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [accountId, setAccountId] = useState(initialAccountId);
  const firstOtherOwn = accounts.find((a) => a.id !== initialAccountId);
  const [destination, setDestination] = useState(firstOtherOwn ? firstOtherOwn.number : OTHER);
  const [externalNumber, setExternalNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef(null);

  const source = accounts.find((a) => a.id === accountId);
  const ownDestinations = accounts.filter((a) => a.id !== accountId);

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep the destination valid when the source account changes.
  useEffect(() => {
    if (destination !== OTHER && !ownDestinations.some((a) => a.number === destination)) {
      setDestination(ownDestinations[0]?.number ?? OTHER);
    }
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0)
      return 'Enter an amount greater than $0 with up to 2 decimals';
    if (Number(amount) > 1_000_000) return 'Amount exceeds the $1,000,000 limit';
    if (mode !== 'deposit' && source && Math.round(Number(amount) * 100) > source.balanceCents)
      return `Insufficient funds. Available: ${formatMoney(source.balanceCents)}`;
    if (mode === 'transfer' && destination === OTHER && !/^\d{10}$/.test(externalNumber.replace(/\s/g, '')))
      return 'Enter a valid 10-digit account number';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        mode,
        accountId,
        amount: amount.trim(),
        description: description.trim(),
        toAccountNumber: destination === OTHER ? externalNumber.replace(/\s/g, '') : destination,
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="money-title" onMouseDown={onClose}>
      <form className="modal__panel" onSubmit={handleSubmit} onMouseDown={(e) => e.stopPropagation()} noValidate>
        <div className="modal__header">
          <h2 id="money-title">{TITLES[mode]}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="tabs tabs--small" role="tablist">
          {Object.keys(TITLES).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`tabs__btn ${mode === m ? 'is-active' : ''}`}
              onClick={() => {
                setMode(m);
                setError('');
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <label className="field">
          <span>{mode === 'deposit' ? 'To account' : 'From account'}</span>
          <select className="input" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {ACCOUNT_LABELS[a.type]} {maskNumber(a.number)} — {formatMoney(a.balanceCents)}
              </option>
            ))}
          </select>
        </label>

        {mode === 'transfer' && (
          <>
            <label className="field">
              <span>To</span>
              <select className="input" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {ownDestinations.map((a) => (
                  <option key={a.id} value={a.number}>
                    My {ACCOUNT_LABELS[a.type].toLowerCase()} {maskNumber(a.number)}
                  </option>
                ))}
                <option value={OTHER}>Someone else (account number)…</option>
              </select>
            </label>
            {destination === OTHER && (
              <label className="field">
                <span>Recipient account number</span>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="10-digit account number"
                  value={externalNumber}
                  onChange={(e) => setExternalNumber(e.target.value)}
                  maxLength={14}
                />
              </label>
            )}
          </>
        )}

        <label className="field">
          <span>Amount</span>
          <div className="input-group">
            <span className="input-group__prefix">$</span>
            <input
              ref={amountRef}
              className="input input--amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {mode !== 'deposit' && source && (
            <small className="muted">Available: {formatMoney(source.balanceCents)}</small>
          )}
        </label>

        <label className="field">
          <span>
            Description <span className="muted">(optional)</span>
          </span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={140}
            placeholder={mode === 'transfer' ? 'e.g. Rent, Dinner' : 'e.g. Paycheck, ATM'}
          />
        </label>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Processing…' : `Confirm ${mode}`}
          </button>
        </div>
      </form>
    </div>
  );
}
