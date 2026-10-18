# Chatbot Portfolio IA (Groq & Fallback Gemini)

Assistant virtuel intelligent pour portfolio de développeur, conçu avec React, Express et un moteur d'IA hybride **Groq (Llama 3.3 70B)** avec repli automatique sur **Google Gemini**.

---

## 🚀 Accès Rapide

### 1. Démo en direct (Sans installation ni clé API)
Pour les recruteurs et visiteurs souhaitant tester directement le portfolio et son univers :
👉 **[Accéder au portfolio en ligne](https://lucas-debize.github.io/portfolio/)**  
*(CV officiel également accessible directement : [Télécharger le CV](https://lucas-debize.github.io/portfolio/assets/images/CV.pdf))*

### 2. Test en local (Développeurs & Évaluateurs)
Une seule commande suffit pour tout installer et démarrer :

```bash
# 1. Cloner et configurer l'environnement
cp backend/.env.example backend/.env
# Renseignez votre GROQ_API_KEY (gsk_...) ou GEMINI_API_KEY dans backend/.env

# 2. Installation de toutes les dépendances (racine, backend, frontend)
npm run setup

# 3. Démarrage simultané du backend (port 3001) et du frontend (port 5173)
npm run dev
```

Ouvrez ensuite [http://localhost:5173](http://localhost:5173).

---

## 📸 Aperçu

Interface desktop :

![Interface desktop du chatbot portfolio](assets/interface-desktop.png)

Conversation avec l'assistant IA :

![Exemple de conversation avec l'assistant](assets/chat-demo.png)

---

## 🛠️ Stack & Architecture

| Couche | Technologie | Rôle |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 6 | Interface chat réactive avec stream & suggestions |
| **Backend** | Node.js + Express | API REST, orchestration IA, validation de tokens |
| **Moteur IA Principal** | **Groq (Llama 3.3 70B)** | Réponses ultra-rapides (~200ms), modèle de pointe |
| **Moteur IA Secours** | **Google Gemini** | Fallback automatique en cas de rate-limit ou indisponibilité |
| **Données Profil** | `profile.json` + `CV.pdf` | Contexte injecté dynamiquement dans le prompt système |
| **Orchestration** | `concurrently` | Lancement et arrêt unifiés des services en un seul terminal |

### Schéma d'exécution & Fallback

```
                    ┌─────────────────────────┐
                    │  Utilisateur / Navigateur│
                    └───────────┬─────────────┘
                                │ HTTP / Vite (5173)
                                ▼
                    ┌─────────────────────────┐
                    │   Backend Express (3001)│
                    └───────────┬─────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼ (Prioritaire)               ▼ (Secours si indisponible/429)
       ┌──────────────────┐          ┌──────────────────┐
       │   Groq Cloud     │          │  Google Gemini   │
       │(Llama 3.3 70B /  │          │(Flash Lite /     │
       │  Llama 3.1 8B)   │          │  3.6 Flash)      │
       └──────────────────┘          └──────────────────┘
```

---

## ⚙️ Configuration (`backend/.env`)

Le fichier `backend/.env.example` détaille les options disponibles :

```env
# Moteur principal recommandé (Groq - Llama 3.3 70B, ultra-rapide)
GROQ_API_KEY=gsk_votre_cle_groq_ici
GROQ_MODEL=llama-3.3-70b-versatile

# Moteur de secours (Google Gemini)
GEMINI_API_KEY=votre_cle_gemini_ici
GEMINI_MODEL=gemini-flash-lite-latest

# Liaison CV Portfolio (Local ou Production)
CV_URL=https://lucas-debize.github.io/portfolio/assets/images/CV.pdf

# Optionnel : chemin vers un fichier de profil personnalisé (défaut : ./profile.json)
PROFILE_PATH=

PORT=3001
```

- **Clé Groq** : Obtenez une clé gratuite sur [console.groq.com/keys](https://console.groq.com/keys) (format `gsk_...`).
- **Clé Gemini** : Obtenez une clé sur [Google AI Studio](https://aistudio.google.com/apikey) (format `AIza...` ou `AQ...`).
- Vous pouvez renseigner uniquement l'une des deux clés ou les deux pour bénéficier de la bascule automatique à tolérance de panne.

---

## 🌐 Déploiement Prêt à l'Emploi (Zero-Rewrite)

Le frontend et le backend sont architecturés pour être déployés ou intégrés dans un portfolio existant sans modifier une seule ligne de code source.

### 1. Déploiement du Backend (Render, Railway, Fly.io ou VPS)
1. Déployez le dossier `backend/` sur votre plateforme de choix (ex: Render Web Service).
2. Configurez les variables d'environnement dans le dashboard de la plateforme :
   - `GROQ_API_KEY=gsk_...`
   - `GEMINI_API_KEY=...` (optionnel pour fallback)
   - `CV_URL=https://lucas-debize.github.io/portfolio/assets/images/CV.pdf`
3. Récupérez l'URL publique de votre backend (ex: `https://mon-chatbot-backend.onrender.com`).

### 2. Déploiement du Frontend (GitHub Pages, Vercel ou intégration portfolio)
1. Lors du build du frontend, définissez la variable d'environnement `VITE_BACKEND_URL` :
   ```bash
   VITE_BACKEND_URL=https://mon-chatbot-backend.onrender.com npm run build
   ```
2. Le frontend interrogera automatiquement votre backend en production, tout en continuant à cibler `http://localhost:3001` en local par défaut.

---

## 🔌 Points d'Entrée API

### `POST /api/chat`
Envoie un message à l'assistant.

**Requête :**
```json
{
  "message": "Quels sont tes projets en IA ?"
}
```

**Réponse (Succès 200) :**
```json
{
  "reply": "Lucas a notamment développé Prospecthor (plateforme SaaS avec NLP chez SBDR Team) et RAG Monitor...",
  "provider": "groq"
}
```

**Réponse (Erreur 503) :**
```json
{
  "error": "L'IA n'est pas configurée. Ajoutez une clé GROQ_API_KEY ou GEMINI_API_KEY valide dans backend/.env.",
  "code": "AI_NOT_CONFIGURED"
}
```

### `GET /api/ai-status`
Vérifie la disponibilité et les fournisseurs actifs.

**Réponse :**
```json
{
  "available": true,
  "primaryProvider": "groq",
  "fallbackAvailable": true,
  "activeModel": "llama-3.3-70b-versatile"
}
```

### `GET /api/health`
Vérification de l'état de l'application et chargement du profil.

---

## 📁 Structure du Projet

```
chatbot-portfolio/
├── package.json          # Orchestrateur racine (scripts setup, dev, build)
├── README.md             # Guide complet et documentation
├── assets/               # Captures d'écran et illustrations
├── backend/
│   ├── server.js         # API Express, client Groq, fallback Gemini
│   ├── profile.json      # Base de connaissances du profil et lien CV
│   ├── .env.example      # Modèle de variables d'environnement
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── components/
        │   └── Chatbot.jsx  # Composant Chatbot (portable et réutilisable)
        └── styles.css
```

---

## 📜 Licence

MIT © [Lucas Debize](https://github.com/lucas-debize)
