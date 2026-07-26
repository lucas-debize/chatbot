import Chatbot from "./components/Chatbot";

const PROFILE = {
  name: "Lucas Debize",
  role: "Dev IA / Full-Stack",
  tagline: "Passionné de code & d'IA",
  availability: "Part-time · 4-5 mois",
  location: "Lyon, France",
  stats: [
    { value: "9", label: "Projets" },
    { value: "3", label: "Domaines" },
    { value: "32+", label: "Technos" },
  ],
  links: [
    { label: "Portfolio", href: "https://lucas-debize.github.io/portfolio/" },
    { label: "GitHub", href: "https://github.com/lucas-debize" },
    { label: "LinkedIn", href: "https://linkedin.com/in/lucas-debize" },
  ],
  focus: ["IA", "Web", "Logiciel"],
};

function App() {
  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow--1" aria-hidden="true" />
      <div className="bg-glow bg-glow--2" aria-hidden="true" />

      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">LD</div>
            <div>
              <p className="brand-eyebrow">Portfolio · Assistant IA</p>
              <h1>{PROFILE.name}</h1>
            </div>
          </div>
          <nav className="header-links" aria-label="Liens externes">
            {PROFILE.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="header-link"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <aside className="profile-panel">
          <div className="profile-card profile-card--hero">
            <div className="profile-badge">Disponible</div>
            <h2>{PROFILE.role}</h2>
            <p className="profile-tagline">{PROFILE.tagline}</p>
            <div className="profile-meta">
              <span className="meta-chip">{PROFILE.availability}</span>
              <span className="meta-chip">{PROFILE.location}</span>
            </div>
          </div>

          <div className="profile-card">
            <h3 className="card-title">Focus</h3>
            <div className="focus-tags">
              {PROFILE.focus.map((item) => (
                <span key={item} className="focus-tag">
                  {item}
                </span>
              ))}
            </div>
            <p className="card-desc">
              Développement applicatif, interfaces modernes et expérimentations
              autour de l&apos;intelligence artificielle.
            </p>
          </div>

          <div className="profile-card">
            <h3 className="card-title">En chiffres</h3>
            <div className="stats-grid">
              {PROFILE.stats.map((stat) => (
                <div key={stat.label} className="stat-item">
                  <span className="stat-value">{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-card profile-card--hint">
            <h3 className="card-title">Comment m&apos;utiliser</h3>
            <ul className="hint-list">
              <li>Demandez mes compétences ou projets IA</li>
              <li>Interrogez mon expérience chez SBDR Team</li>
              <li>Posez une question recrutement</li>
            </ul>
          </div>
        </aside>

        <section className="chat-panel">
          <Chatbot />
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Propulsé par React, Express &amp; Google Gemini · Projet{" "}
          <a
            href="https://github.com/lucas-debize"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lucas Debize
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
