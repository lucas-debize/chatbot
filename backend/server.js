import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Limiteur général pour les routes API (120 req / 15 min)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});
app.use("/api/", generalLimiter);

// Limiteur strict pour la route de chat (15 messages / minute par IP)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de messages envoyés. Veuillez patienter une minute avant de réessayer.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

let profile;
try {
  const profilePath = process.env.PROFILE_PATH || join(__dirname, "profile.json");
  profile = JSON.parse(readFileSync(profilePath, "utf-8"));
} catch (error) {
  console.error("Erreur lors du chargement de profile.json:", error.message);
  process.exit(1);
}

function buildSystemPrompt(profileData) {
  if (profileData.customText) {
    return `Tu es un assistant expert en analyse de profil et de CV.
Tu réponds aux questions de l'utilisateur en te basant STRICTEMENT et EXCLUSIVEMENT sur le document ci-dessous :

--- DOCUMENT DU CANDIDAT ---
${profileData.customText}

Règles importantes :
- Réponds en français (ou dans la langue de la question), avec précision, objectivité et clarté
- Utilise UNIQUEMENT les faits réels mentionnés dans ce document. N'invente jamais d'informations
- Sois concis (2-4 phrases max sauf si on demande une analyse détaillée ou un résumé exhaustif)
- Si une information n'est pas précisée dans le document, indique-le honnêtement`;
  }

  const cvLink =
    process.env.CV_URL ||
    profileData.contact?.cv ||
    "https://lucas-debize.github.io/portfolio/assets/images/CV.pdf";

  return `Tu es l'assistant portfolio de ${profileData.name}, ${profileData.role}.
${profileData.tagline || ""}. ${profileData.availability || ""}.

Tu réponds aux questions des visiteurs (recruteurs, collaborateurs, curieux) sur son profil, compétences, projets, expérience, formation, disponibilité et contacts.

Règles importantes :
- Réponds en français, de manière professionnelle mais chaleureuse
- Utilise UNIQUEMENT les informations du profil ci-dessous
- Si tu ne connais pas la réponse, dis-le honnêtement
- Sois concis (2-4 phrases maximum sauf si on demande des détails)
- Ne invente jamais d'informations
- Mentionne les projets pertinents quand c'est utile (MyAIFactory, SBDR Team, Prospecthor, RAG Monitor, Elyrii, Assistant RH IA, etc.)
- Si l'utilisateur demande à consulter ou télécharger le CV, fournis-lui directement ce lien : ${cvLink}

Profil complet :
${JSON.stringify(profileData, null, 2)}`;
}

function getGroqKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || apiKey === "your_groq_api_key_here") return null;
  return apiKey;
}

function getGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here" || apiKey === "your_api_key_here") {
    return null;
  }
  return apiKey;
}

function isValidGroqKey(apiKey) {
  return typeof apiKey === "string" && apiKey.startsWith("gsk_");
}

function isValidGeminiKey(apiKey) {
  return (
    typeof apiKey === "string" &&
    (apiKey.startsWith("AIza") || apiKey.startsWith("AQ."))
  );
}

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
];

const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];

function getGroqModelCandidates() {
  const preferred = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  return [...new Set([preferred, ...GROQ_FALLBACK_MODELS])];
}

function getGeminiModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return [...new Set([preferred, ...GEMINI_FALLBACK_MODELS])];
}

function mapGroqError(status, errorBody, model) {
  let parsed;
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    parsed = null;
  }

  const apiMessage = parsed?.error?.message || "";

  if (status === 429) {
    return {
      status: 503,
      code: "AI_QUOTA_EXCEEDED",
      retryable: true,
      provider: "groq",
      error: `Quota dépassé pour le modèle ${model} (Groq). ${apiMessage}`.trim(),
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      code: "AI_AUTH_ERROR",
      retryable: false,
      provider: "groq",
      error: "Clé API Groq refusée. Vérifiez GROQ_API_KEY dans backend/.env.",
    };
  }

  if (status === 404) {
    return {
      status: 503,
      code: "AI_MODEL_NOT_FOUND",
      retryable: true,
      provider: "groq",
      error: `Modèle Groq ${model} indisponible.`,
    };
  }

  return {
    status: 503,
    code: "AI_UNAVAILABLE",
    retryable: false,
    provider: "groq",
    error: apiMessage
      ? `L'IA Groq est indisponible : ${apiMessage}`
      : "L'IA Groq est indisponible. Réessayez dans quelques instants.",
  };
}

function mapGeminiError(status, errorBody, model) {
  let parsed;
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    parsed = null;
  }

  const apiMessage = parsed?.error?.message || "";

  if (status === 429) {
    return {
      status: 503,
      code: "AI_QUOTA_EXCEEDED",
      retryable: true,
      provider: "gemini",
      error: `Quota dépassé pour le modèle ${model}. Consultez https://ai.dev/rate-limit.`,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      code: "AI_AUTH_ERROR",
      retryable: false,
      provider: "gemini",
      error: "Clé API Gemini refusée. Vérifiez GEMINI_API_KEY dans backend/.env.",
    };
  }

  if (status === 404) {
    return {
      status: 503,
      code: "AI_MODEL_NOT_FOUND",
      retryable: true,
      provider: "gemini",
      error: `Modèle ${model} indisponible pour ce compte.`,
    };
  }

  return {
    status: 503,
    code: "AI_UNAVAILABLE",
    retryable: false,
    provider: "gemini",
    error: apiMessage
      ? `L'IA Gemini est indisponible : ${apiMessage}`
      : "L'IA Gemini est indisponible. Réessayez dans quelques instants.",
  };
}

async function requestGroqModel(model, message, profileData, apiKey) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(profileData) },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const mapped = mapGroqError(response.status, errorBody, model);
    const err = new Error(mapped.error);
    err.aiError = mapped;
    throw err;
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    const err = new Error("L'IA Groq n'a pas renvoyé de réponse.");
    err.aiError = {
      status: 503,
      code: "AI_EMPTY_RESPONSE",
      retryable: true,
      provider: "groq",
      error: "L'IA Groq n'a pas renvoyé de réponse. Réessayez.",
    };
    throw err;
  }

  return reply.trim();
}

async function requestGeminiModel(model, message, profileData, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(profileData) }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const mapped = mapGeminiError(response.status, errorBody, model);
    const err = new Error(mapped.error);
    err.aiError = mapped;
    throw err;
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) {
    const err = new Error("L'IA Gemini n'a pas renvoyé de réponse.");
    err.aiError = {
      status: 503,
      code: "AI_EMPTY_RESPONSE",
      retryable: true,
      provider: "gemini",
      error: "L'IA Gemini n'a pas renvoyé de réponse. Réessayez.",
    };
    throw err;
  }

  return reply.trim();
}

async function tryGroq(message, profileData, apiKey) {
  const models = getGroqModelCandidates();
  let lastError = null;

  for (const model of models) {
    try {
      const reply = await requestGroqModel(model, message, profileData, apiKey);
      if (model !== models[0]) {
        console.warn(`Modèle Groq de repli utilisé: ${model}`);
      }
      return { reply, provider: "groq", model };
    } catch (error) {
      lastError = error;
      if (error.aiError?.retryable) {
        console.warn(`Modèle Groq ${model} indisponible:`, error.message);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function tryGemini(message, profileData, apiKey) {
  const models = getGeminiModelCandidates();
  let lastError = null;

  for (const model of models) {
    try {
      const reply = await requestGeminiModel(model, message, profileData, apiKey);
      if (model !== models[0]) {
        console.warn(`Modèle Gemini de repli utilisé: ${model}`);
      }
      return { reply, provider: "gemini", model };
    } catch (error) {
      lastError = error;
      if (error.aiError?.retryable) {
        console.warn(`Modèle Gemini ${model} indisponible:`, error.message);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function callAI(message, profileData) {
  const groqKey = getGroqKey();
  const geminiKey = getGeminiKey();

  const groqValid = Boolean(groqKey && isValidGroqKey(groqKey));
  const geminiValid = Boolean(geminiKey && isValidGeminiKey(geminiKey));

  if (!groqKey && !geminiKey) {
    const err = new Error(
      "L'IA n'est pas configurée. Ajoutez une clé GROQ_API_KEY ou GEMINI_API_KEY valide dans backend/.env."
    );
    err.aiError = {
      status: 503,
      code: "AI_NOT_CONFIGURED",
      error: err.message,
    };
    throw err;
  }

  // Si Groq est renseigné mais que son format est invalide
  if (groqKey && !groqValid) {
    if (geminiValid) {
      console.warn("[WARN] Clé Groq invalide, basculement sur Gemini...");
      return await tryGemini(message, profileData, geminiKey);
    }
    const err = new Error(
      "La clé GROQ_API_KEY semble invalide (elle doit commencer par gsk_)."
    );
    err.aiError = {
      status: 503,
      code: "AI_INVALID_KEY",
      error: err.message,
    };
    throw err;
  }

  // Si Groq est valide, on tente Groq en priorité
  if (groqValid) {
    try {
      return await tryGroq(message, profileData, groqKey);
    } catch (groqError) {
      if (geminiValid) {
        console.warn(
          `[WARN] Groq indisponible (${groqError.message}), basculement sur Gemini...`
        );
        return await tryGemini(message, profileData, geminiKey);
      }
      throw groqError;
    }
  }

  // Si seul Gemini est configuré et valide
  if (geminiValid) {
    return await tryGemini(message, profileData, geminiKey);
  }

  // Gemini était renseigné mais format invalide
  const err = new Error(
    "La clé GEMINI_API_KEY semble invalide (format AIza ou AQ.)."
  );
  err.aiError = {
    status: 503,
    code: "AI_INVALID_KEY",
    error: err.message,
  };
  throw err;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", profile: profile.name });
});

app.get("/api/ai-status", (_req, res) => {
  const groqKey = getGroqKey();
  const geminiKey = getGeminiKey();

  const groqValid = Boolean(groqKey && isValidGroqKey(groqKey));
  const geminiValid = Boolean(geminiKey && isValidGeminiKey(geminiKey));

  if (!groqKey && !geminiKey) {
    return res.status(503).json({
      available: false,
      code: "AI_NOT_CONFIGURED",
      error:
        "L'IA n'est pas configurée. Ajoutez une clé GROQ_API_KEY ou GEMINI_API_KEY valide dans backend/.env.",
      primaryProvider: "none",
      fallbackAvailable: false,
      activeModel: "",
      model: "",
    });
  }

  if (!groqValid && !geminiValid) {
    return res.status(503).json({
      available: false,
      code: "AI_INVALID_KEY",
      error:
        "Les clés d'API configurées semblent invalides. Vérifiez GROQ_API_KEY (gsk_...) ou GEMINI_API_KEY (AIza... / AQ.).",
      primaryProvider: "none",
      fallbackAvailable: false,
      activeModel: "",
      model: "",
    });
  }

  const primaryProvider = groqValid ? "groq" : "gemini";
  const fallbackAvailable = groqValid ? geminiValid : false;
  const activeModel = groqValid
    ? process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
    : process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  return res.json({
    available: true,
    primaryProvider,
    fallbackAvailable,
    activeModel,
    model: activeModel,
  });
});
app.get("/api/profile", (_req, res) => {
  res.json(profile);
});

app.post("/api/parse-cv", async (req, res) => {
  try {
    const { base64, text, filename } = req.body || {};

    if (text && typeof text === "string" && text.trim()) {
      const cleaned = text.trim();
      return res.json({
        text: cleaned,
        filename: filename || "Texte collé",
        length: cleaned.length,
      });
    }

    if (base64 && typeof base64 === "string") {
      const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      }).promise;

      let fullText = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item) => item.str);
        fullText += strings.join(" ") + "\n";
      }

      const cleaned = fullText.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
      return res.json({
        text: cleaned,
        filename: filename || "CV.pdf",
        pages: doc.numPages,
        length: cleaned.length,
      });
    }

    return res.status(400).json({ error: "Fournissez soit 'text' soit 'base64' (fichier PDF)." });
  } catch (error) {
    console.error("Erreur parse-cv:", error);
    res.status(500).json({ error: "Impossible de lire le document : " + error.message });
  }
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Le message est requis." });
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      return res.status(400).json({ error: "Le message ne peut pas être vide." });
    }

    if (trimmedMessage.length > 500) {
      return res.status(400).json({ error: "Le message ne peut pas dépasser 500 caractères." });
    }

    const activeProfile = req.body.customProfile || profile;
    const result = await callAI(trimmedMessage, activeProfile);
    res.json({ reply: result.reply, provider: result.provider });
  } catch (error) {
    if (error.aiError) {
      console.error("Erreur IA:", error.aiError.code, "-", error.message);
      return res.status(error.aiError.status).json({
        error: error.aiError.error,
        code: error.aiError.code,
      });
    }

    console.error("Erreur /api/chat:", error.message);
    res.status(500).json({
      error: "Une erreur est survenue. Veuillez réessayer.",
      code: "SERVER_ERROR",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
});
