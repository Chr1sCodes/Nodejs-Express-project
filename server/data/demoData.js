// Demo users and their transaction history. Shared by the SQLite seeder (seed.js) and the
// browser-only demo API (client/src/demoApi.js), so keep this file free of Node imports.

export const DEMO_PASSWORD = 'Demo1234';

/** Pre-registered demo users. All share DEMO_PASSWORD. Account numbers are fixed so they're easy to transfer to. */
export const DEMO_USERS = [
  {
    key: 'ada',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    accounts: { checking: '1000000001', savings: '1000000002' },
  },
  {
    key: 'alan',
    name: 'Alan Turing',
    email: 'alan@example.com',
    accounts: { checking: '1000000003', savings: '1000000004' },
  },
  {
    key: 'grace',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    accounts: { checking: '1000000005', savings: '1000000006' },
  },
];

/**
 * Chronological activity applied on top of zero balances. `at` is "user.accountType".
 * `daysAgo` backdates entries so the dashboard has realistic history.
 */
export const ACTIVITY = [
  { daysAgo: 45, type: 'deposit', at: 'ada.checking', amount: 4200_00, description: 'Opening deposit' },
  { daysAgo: 45, type: 'deposit', at: 'alan.checking', amount: 3100_00, description: 'Opening deposit' },
  { daysAgo: 44, type: 'deposit', at: 'grace.checking', amount: 5800_00, description: 'Opening deposit' },
  { daysAgo: 40, type: 'transfer', from: 'ada.checking', to: 'ada.savings', amount: 1500_00, description: 'Monthly savings' },
  { daysAgo: 38, type: 'withdrawal', at: 'alan.checking', amount: 120_00, description: 'ATM withdrawal' },
  { daysAgo: 35, type: 'transfer', from: 'grace.checking', to: 'grace.savings', amount: 2500_00, description: 'Emergency fund' },
  { daysAgo: 30, type: 'withdrawal', at: 'ada.checking', amount: 1450_00, description: 'Rent' },
  { daysAgo: 30, type: 'withdrawal', at: 'grace.checking', amount: 1800_00, description: 'Rent' },
  { daysAgo: 28, type: 'transfer', from: 'alan.checking', to: 'ada.checking', amount: 42_50, description: 'Dinner split' },
  { daysAgo: 25, type: 'deposit', at: 'alan.checking', amount: 2650_00, description: 'Paycheck' },
  { daysAgo: 21, type: 'withdrawal', at: 'grace.checking', amount: 86_34, description: 'Groceries' },
  { daysAgo: 18, type: 'transfer', from: 'grace.checking', to: 'alan.checking', amount: 250_00, description: 'Conference tickets' },
  { daysAgo: 14, type: 'deposit', at: 'ada.checking', amount: 3200_00, description: 'Paycheck' },
  { daysAgo: 12, type: 'withdrawal', at: 'alan.checking', amount: 64_99, description: 'Electric bill' },
  { daysAgo: 9, type: 'transfer', from: 'alan.checking', to: 'alan.savings', amount: 800_00, description: 'Savings' },
  { daysAgo: 7, type: 'transfer', from: 'ada.checking', to: 'grace.checking', amount: 120_00, description: 'Book club' },
  { daysAgo: 5, type: 'deposit', at: 'grace.checking', amount: 4100_00, description: 'Paycheck' },
  { daysAgo: 3, type: 'withdrawal', at: 'ada.checking', amount: 58_20, description: 'Coffee & snacks' },
  { daysAgo: 2, type: 'transfer', from: 'grace.savings', to: 'grace.checking', amount: 300_00, description: 'Top up checking' },
  { daysAgo: 1, type: 'deposit', at: 'alan.savings', amount: 15_75, description: 'Interest' },
];
