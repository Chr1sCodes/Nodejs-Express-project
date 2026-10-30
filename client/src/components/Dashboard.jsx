import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../format.js';
import AccountCard from './AccountCard.jsx';
import TransactionList from './TransactionList.jsx';
import MoneyModal from './MoneyModal.jsx';

export default function Dashboard({ user, notify }) {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // null = all accounts
  const [modal, setModal] = useState(null); // { mode, accountId }
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [{ accounts, summary }, txs] = await Promise.all([
        api.accounts(),
        api.transactions(selectedId),
      ]);
      setAccounts(accounts);
      setSummary(summary);
      setTransactions(txs);
    } catch (err) {
      if (err.status !== 401) notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedId, notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = async ({ mode, accountId, toAccountNumber, amount, description }) => {
    if (mode === 'deposit') await api.deposit(accountId, amount, description);
    else if (mode === 'withdraw') await api.withdraw(accountId, amount, description);
    else await api.transfer(accountId, toAccountNumber, amount, description);

    const verb = { deposit: 'Deposited', withdraw: 'Withdrew', transfer: 'Transferred' }[mode];
    notify(`${verb} ${formatMoney(Math.round(Number(amount) * 100))}`);
    setModal(null);
    refresh();
  };

  const copyNumber = async (number) => {
    try {
      await navigator.clipboard.writeText(number);
      notify('Account number copied');
    } catch {
      notify(`Account number: ${number}`);
    }
  };

  if (loading) {
    return (
      <div className="loading" aria-live="polite">
        <span className="spinner" /> Loading your accounts…
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <main className="container dashboard">
      <section className="overview">
        <div>
          <p className="overview__greeting">
            {greeting}, {user.name.split(' ')[0]}
          </p>
          <p className="overview__label">Total balance</p>
          <p className="overview__total">{formatMoney(summary.totalCents)}</p>
        </div>
        <div className="overview__month">
          <div>
            <span className="overview__label">In this month</span>
            <strong className="amount--in">+{formatMoney(summary.monthInCents)}</strong>
          </div>
          <div>
            <span className="overview__label">Out this month</span>
            <strong className="amount--out">−{formatMoney(summary.monthOutCents)}</strong>
          </div>
        </div>
        <div className="quick-actions">
          <button className="btn btn--light" onClick={() => setModal({ mode: 'deposit' })}>
            ＋ Deposit
          </button>
          <button className="btn btn--light" onClick={() => setModal({ mode: 'withdraw' })}>
            − Withdraw
          </button>
          <button className="btn btn--light" onClick={() => setModal({ mode: 'transfer' })}>
            ⇄ Transfer
          </button>
        </div>
      </section>

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className="section-title">
          Your accounts
        </h2>
        <div className="accounts">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              selected={a.id === selectedId}
              onSelect={() => setSelectedId(a.id === selectedId ? null : a.id)}
              onAction={(mode) => setModal({ mode, accountId: a.id })}
              onCopy={() => copyNumber(a.number)}
            />
          ))}
        </div>
      </section>

      <TransactionList
        transactions={transactions}
        accounts={accounts}
        selected={selected}
        onFilterChange={setSelectedId}
      />

      {modal && (
        <MoneyModal
          mode={modal.mode}
          initialAccountId={modal.accountId ?? accounts[0]?.id}
          accounts={accounts}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </main>
  );
}
