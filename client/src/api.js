let onUnauthorized = () => {};

/** Registers a callback fired when the session has expired (401 from a protected route). */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    const err = new Error(data.details?.join(', ') || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  popularStocks: () => request('/market/popular'),

  accounts: () => request('/accounts'),
  transactions: (accountId) => request(`/transactions${accountId ? `?accountId=${accountId}` : ''}`),
  deposit: (accountId, amount, description) =>
    request(`/accounts/${accountId}/deposit`, { method: 'POST', body: { amount, description } }),
  withdraw: (accountId, amount, description) =>
    request(`/accounts/${accountId}/withdraw`, { method: 'POST', body: { amount, description } }),
  transfer: (fromAccountId, toAccountNumber, amount, description) =>
    request('/transfers', { method: 'POST', body: { fromAccountId, toAccountNumber, amount, description } }),
};
