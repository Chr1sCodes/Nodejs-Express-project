const SERVICES = [
  {
    icon: '🏦',
    title: 'Checking accounts',
    text: 'An everyday account for paying bills and spending, opened automatically when you join.',
  },
  {
    icon: '🐷',
    title: 'Savings accounts',
    text: 'A separate account for setting money aside, kept apart from your spending.',
  },
  {
    icon: '⇄',
    title: 'Instant transfers',
    text: 'Move money between your own accounts, or send it to another member by account number.',
  },
  {
    icon: '💵',
    title: 'Deposits & withdrawals',
    text: 'Add or take out money at any time, and see your balance update instantly.',
  },
  {
    icon: '📊',
    title: 'Activity & monthly summary',
    text: 'A full transaction history with running balances, plus your money in and out this month.',
  },
  {
    icon: '🔒',
    title: 'Secure online banking',
    text: 'Hashed passwords, sessions that expire, and money movements that either fully complete or don’t happen at all.',
  },
];

export default function Home({ onGetStarted }) {
  return (
    <main className="home container">
      <section className="home__intro">
        <h2 className="home__title">
          <span className="logo__mark" aria-hidden="true">◆</span> Nova Bank
        </h2>
        <p className="home__tagline">Simple, secure banking for everyday life.</p>
      </section>

      <section className="home__services" aria-labelledby="services-heading">
        <h3 id="services-heading" className="home__subtitle">
          Our banking services
        </h3>
        <ul className="services">
          {SERVICES.map((s) => (
            <li key={s.title} className="service">
              <span className="service__icon" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <h4 className="service__title">{s.title}</h4>
                <p className="service__text">{s.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--primary btn--block" onClick={onGetStarted}>
          Sign in or open an account
        </button>
      </section>
    </main>
  );
}
