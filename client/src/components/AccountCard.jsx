import { ACCOUNT_LABELS, formatMoney, maskNumber } from '../format.js';

export default function AccountCard({ account, selected, onSelect, onAction, onCopy }) {
  return (
    <article className={`account account--${account.type} ${selected ? 'is-selected' : ''}`}>
      <button
        className="account__main"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${ACCOUNT_LABELS[account.type]} account ${maskNumber(account.number)}, balance ${formatMoney(account.balanceCents)}. ${selected ? 'Showing only this account' : 'Show only this account'}`}
      >
        <span className="account__type">{ACCOUNT_LABELS[account.type]}</span>
        <span className="account__balance">{formatMoney(account.balanceCents)}</span>
        <span className="account__number">{maskNumber(account.number)}</span>
      </button>
      <div className="account__actions">
        <button className="chip" onClick={() => onAction('deposit')}>
          Deposit
        </button>
        <button className="chip" onClick={() => onAction('withdraw')}>
          Withdraw
        </button>
        <button className="chip" onClick={() => onAction('transfer')}>
          Transfer
        </button>
        <button className="chip chip--ghost" onClick={onCopy} title="Copy full account number">
          Copy #
        </button>
      </div>
    </article>
  );
}
