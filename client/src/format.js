const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatMoney = (cents) => currency.format(cents / 100);

export const maskNumber = (number) => `•••• ${number.slice(-4)}`;

export const ACCOUNT_LABELS = { checking: 'Checking', savings: 'Savings' };

export const TX_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
};

export const isCredit = (type) => type === 'deposit' || type === 'transfer_in';

export function formatDateTime(iso) {
  const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
