import { useState } from "react";
import Chatbot from "./components/Chatbot";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const DEFAULT_PROFILE = {
  name: "Lucas Debize",
  role: "Développeur IA Junior / Full-Stack",
  tagline: "Étudiant Epitech · Passionné de code & d'IA",
  availability: "Stage 6 mois / CDI (Mars 2027)",
  location: "Lyon, France",
  stats: [
    { value: "12", label: "Projets" },
    { value: "2", label: "Expériences" },
    { value: "32+", label: "Technos" },
  ],
  links: [
    { label: "Portfolio", href: "https://lucas-debize.github.io/portfolio/" },
    { label: "CV PDF", href: "https://lucas-debize.github.io/portfolio/assets/images/CV.pdf" },
    { label: "GitHub", href: "https://github.com/lucas-debize" },
    { label: "LinkedIn", href: "https://linkedin.com/in/lucas-debize" },
  ],
  focus: ["IA", "Automatisation", "Web", "Logiciel"],
};

function App() {
  const [customProfile, setCustomProfile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("file"); // "file" | "text"
  const [pastedText, setPastedText] = useState("");
  const [customName, setCustomName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const activeProfile = customProfile
    ? {
        name: customProfile.name || customProfile.filename || "Profil Personnalisé",
        role: "Profil / CV Importé",
        tagline: "Analyse documentaire personnalisée",
        availability: customProfile.length ? `${customProfile.length} caractères extraits` : "Document actif",
        location: "Mode Analyseur",
        stats: [
          { value: "1", label: "Document" },
          { value: customProfile.pages ? `${customProfile.pages}` : "1", label: "Page(s)" },
          { value: "IA", label: "Analyse" },
        ],
        focus: ["Analyse CV", "Compétences", "Matching Postes"],
      }
    : DEFAULT_PROFILE;

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function processFile(file) {
    setUploading(true);
    setUploadError("");

    try {
      if (file.name.endsWith(".txt") || file.name.endsWith(".json") || file.type.includes("text")) {
        const text = await file.text();
        if (!text.trim()) {
          throw new Error("Le fichier texte est vide.");
        }
        setCustomProfile({
          name: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          customText: text,
          length: text.length,
        });
        setIsModalOpen(false);
        return;
      }

      if (file.name.endsWith(".pdf") || file.type.includes("pdf")) {
        // Lecture base64 et envoi au backend pour extraction PDF
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const res = await fetch(`${BACKEND_URL}/api/parse-cv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64,
            filename: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.text) {
          throw new Error(data.error || "Impossible d'extraire le texte du PDF.");
        }

        setCustomProfile({
          name: data.filename?.replace(/\.pdf$/i, "") || "CV PDF",
          filename: data.filename || file.name,
          customText: data.text,
          pages: data.pages,
          length: data.length,
        });
        setIsModalOpen(false);
        return;
      }

      throw new Error("Format non supporté. Veuillez sélectionner un fichier PDF ou TXT.");
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleTextSubmit(e) {
    e.preventDefault();
    if (!pastedText.trim()) {
      setUploadError("Veuillez saisir ou coller du texte.");
      return;
    }

    setCustomProfile({
      name: customName.trim() || "CV Personnalisé",
      filename: "Texte collé",
      customText: pastedText.trim(),
      length: pastedText.trim().length,
    });
    setIsModalOpen(false);
  }

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow--1" aria-hidden="true" />
      <div className="bg-glow bg-glow--2" aria-hidden="true" />

      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">
              {customProfile ? "CV" : "LD"}
            </div>
            <div>
              <p className="brand-eyebrow">
                {customProfile ? "Analyseur de profil · Mode Custom" : "Portfolio · Assistant IA"}
              </p>
              <h1>{activeProfile.name}</h1>
            </div>
          </div>
          <nav className="header-links" aria-label="Liens externes">
            {DEFAULT_PROFILE.links.map((link) => (
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
          {/* Carte Principale */}
          <div className="profile-card profile-card--hero">
            <div className="profile-badge">
              {customProfile ? "Profil Custom" : "Disponible"}
            </div>
            <h2>{activeProfile.role}</h2>
            <p className="profile-tagline">{activeProfile.tagline}</p>
            <div className="profile-meta">
              <span className="meta-chip">{activeProfile.availability}</span>
              <span className="meta-chip">{activeProfile.location}</span>
            </div>
          </div>

          {/* Carte Sélecteur de CV Custom */}
          <div className="profile-card profile-card--custom">
            {customProfile ? (
              <>
                <div className="custom-status-badge">
                  <span className="status-dot" />
                  <span>CV personnalisé actif</span>
                </div>
                <h4 className="custom-title">
                  {customProfile.name || customProfile.filename}
                </h4>
                <p className="card-desc">
                  L&apos;IA analyse ce document pour répondre à toutes vos questions.
                </p>
                <div className="custom-card-actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setCustomProfile(null);
                      setPastedText("");
                      setCustomName("");
                    }}
                  >
                    ↺ Profil Lucas
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setIsModalOpen(true)}
                  >
                    ✏️ Changer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4 className="custom-title">Analyser un autre CV</h4>
                <p className="card-desc">
                  Chargez un PDF ou collez le texte d&apos;un autre profil pour le faire analyser par l&apos;IA.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--upload-trigger"
                  onClick={() => setIsModalOpen(true)}
                >
                  <span>📄 Charger un autre CV</span>
                </button>
              </>
            )}
          </div>

          <div className="profile-card">
            <h3 className="card-title">Focus</h3>
            <div className="focus-tags">
              {activeProfile.focus.map((item) => (
                <span key={item} className="focus-tag">
                  {item}
                </span>
              ))}
            </div>
            <p className="card-desc">
              {customProfile
                ? "Interrogez l'assistant pour évaluer les points forts, compétences et expériences de ce document."
                : "Développement applicatif, interfaces modernes et expérimentations autour de l'intelligence artificielle."}
            </p>
          </div>

          <div className="profile-card">
            <h3 className="card-title">En chiffres</h3>
            <div className="stats-grid">
              {activeProfile.stats.map((stat) => (
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
              {customProfile ? (
                <>
                  <li>Demandez un résumé en 3 points du CV</li>
                  <li>Évaluez les compétences pour un poste</li>
                  <li>Posez des questions sur son parcours</li>
                </>
              ) : (
                <>
                  <li>Demandez mes compétences en IA &amp; Web</li>
                  <li>Interrogez mon expérience (MyAIFactory, SBDR)</li>
                  <li>Posez une question sur ma disponibilité</li>
                </>
              )}
            </ul>
          </div>
        </aside>

        <section className="chat-panel">
          <Chatbot customProfile={customProfile} />
        </section>
      </main>

      {/* Modal de chargement de CV / Texte personnalisé */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Charger un CV ou document personnalisé</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>

            <div className="modal-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === "file" ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab("file");
                  setUploadError("");
                }}
              >
                📁 Fichier PDF / Texte
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === "text" ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab("text");
                  setUploadError("");
                }}
              >
                ✍️ Coller du texte
              </button>
            </div>

            {activeTab === "file" ? (
              <div className="modal-body">
                <label className="dropzone">
                  <input
                    type="file"
                    accept=".pdf,.txt,.json"
                    onChange={handleFileSelected}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                  <span className="dropzone-icon">📥</span>
                  <span className="dropzone-title">
                    {uploading ? "Extraction du texte en cours..." : "Cliquez ou glissez un fichier CV (PDF ou TXT)"}
                  </span>
                  <span className="dropzone-hint">
                    Format PDF ou TXT (taille max 10 Mo)
                  </span>
                </label>

                {uploadError && <div className="modal-error">{uploadError}</div>}
              </div>
            ) : (
              <form onSubmit={handleTextSubmit}>
                <div className="modal-body">
                  <div>
                    <label className="custom-field-label">Nom du profil ou intitulé (optionnel) :</label>
                    <input
                      type="text"
                      className="custom-text-input"
                      placeholder="Ex : Jane Doe - Data Scientist"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="custom-field-label">Texte du CV ou profil :</label>
                    <textarea
                      className="custom-textarea"
                      placeholder="Collez ici le contenu texte d'un CV, profil LinkedIn, compétences, expériences..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={8}
                    />
                  </div>

                  {uploadError && <div className="modal-error">{uploadError}</div>}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn btn--primary">
                    Appliquer ce profil
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>
          Propulsé par React, Express &amp; Groq / Gemini · Projet{" "}
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
