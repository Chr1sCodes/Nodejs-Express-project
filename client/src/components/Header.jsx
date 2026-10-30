function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

export default function Header({ user, theme, onToggleTheme, onLogout, onHome, onAccountClick }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <h1 className="logo">
          <button type="button" className="logo__btn" onClick={onHome} aria-label="Nova Bank home">
            <span className="logo__mark" aria-hidden="true">◆</span> Nova Bank
          </button>
        </h1>
        <div className="header__actions">
          <button
            className="btn btn--ghost btn--icon"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user === null && (
            <button
              className="btn btn--ghost btn--icon person-btn"
              onClick={onAccountClick}
              aria-label="Sign in or create an account"
              title="Sign in / Sign up"
            >
              <PersonIcon />
            </button>
          )}
          {user && (
            <>
              <span className="header__user" title={user.email}>
                <span className="avatar" aria-hidden="true">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="header__name">{user.name}</span>
              </span>
              <button className="btn btn--ghost" onClick={onLogout}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
