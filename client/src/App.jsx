import { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import Header from './components/Header.jsx';
import Toasts from './components/Toasts.jsx';
import { useLocalStorage } from './hooks.js';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session, null = signed out
  const [authFocus, setAuthFocus] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useLocalStorage(
    'theme',
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const notify = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      notify('Your session has expired. Please sign in again.', 'error');
    });
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, [notify]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      notify('You have been signed out');
    }
  };

  return (
    <div className="app">
      <Header
        user={user}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onLogout={handleLogout}
        onAccountClick={() => setAuthFocus((n) => n + 1)}
      />
      {user === undefined ? (
        <div className="loading" aria-live="polite">
          <span className="spinner" /> Loading…
        </div>
      ) : user ? (
        <Dashboard user={user} notify={notify} />
      ) : (
        <AuthPage
          focusSignal={authFocus}
          onAuthenticated={(u, isNew) => {
            setUser(u);
            notify(isNew ? `Welcome to Nova Bank, ${u.name}!` : `Welcome back, ${u.name}`);
          }}
        />
      )}
      <Toasts toasts={toasts} />
    </div>
  );
}
