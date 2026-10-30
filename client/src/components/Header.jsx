export default function Header({ user, theme, onToggleTheme, onLogout }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <h1 className="logo">
          <span className="logo__mark" aria-hidden="true">◆</span> Nova Bank
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
