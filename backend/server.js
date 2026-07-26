import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let profile;
try {
  const profilePath = join(__dirname, "profile.json");
  profile = JSON.parse(readFileSync(profilePath, "utf-8"));
} catch (error) {
  console.error("Erreur lors du chargement de profile.json:", error.message);
  process.exit(1);
}

function buildSystemPrompt(profileData) {
  return `Tu es l'assistant portfolio de ${profileData.name}, ${profileData.role}.
${profileData.tagline}. ${profileData.availability}.

Tu réponds aux questions des visiteurs (recruteurs, collaborateurs, curieux) sur son profil, compétences, projets, expérience, formation, disponibilité et contacts.

Règles importantes :
- Réponds en français, de manière professionnelle mais chaleureuse
- Utilise UNIQUEMENT les informations du profil ci-dessous
- Si tu ne connais pas la réponse, dis-le honnêtement
- Sois concis (2-4 phrases maximum sauf si on demande des détails)
- Ne invente jamais d'informations
- Mentionne les projets pertinents quand c'est utile (Prospecthor, RAG Monitor, Elyrii, Assistant RH IA, Chatbot Portfolio, etc.)

Profil complet :
${JSON.stringify(profileData, null, 2)}`;
}

function isValidGeminiKey(apiKey) {
  return apiKey.startsWith("AIza") || apiKey.startsWith("AQ.");
}

function getAiConfigError() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === "your_api_key_here") {
    return {
      status: 503,
      code: "AI_NOT_CONFIGURED",
      error:
        "L'IA n'est pas configurée. Ajoutez une clé GEMINI_API_KEY valide dans backend/.env.",
    };
  }

  if (!isValidGeminiKey(apiKey)) {
    return {
      status: 503,
      code: "AI_INVALID_KEY",
      error:
        "La clé GEMINI_API_KEY semble invalide. Créez une clé sur Google AI Studio (https://aistudio.google.com/apikey), format AIza ou AQ.",
    };
  }

  return null;
}

const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return [...new Set([preferred, ...GEMINI_FALLBACK_MODELS])];
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
      error:
        `Quota dépassé pour le modèle ${model}. Consultez https://ai.dev/rate-limit.`,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      code: "AI_AUTH_ERROR",
      error:
        "Clé API Gemini refusée. Vérifiez GEMINI_API_KEY dans backend/.env.",
    };
  }

  if (status === 404) {
    return {
      status: 503,
      code: "AI_MODEL_NOT_FOUND",
      retryable: true,
      error: `Modèle ${model} indisponible pour ce compte.`,
    };
  }

  return {
    status: 503,
    code: "AI_UNAVAILABLE",
    retryable: false,
    error: apiMessage
      ? `L'IA Gemini est indisponible : ${apiMessage}`
      : "L'IA Gemini est indisponible. Réessayez dans quelques instants.",
  };
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
      error: "L'IA Gemini n'a pas renvoyé de réponse. Réessayez.",
    };
    throw err;
  }

  return reply.trim();
}

async function callGemini(message, profileData) {
  const configError = getAiConfigError();
  if (configError) {
    const err = new Error(configError.error);
    err.aiError = configError;
    throw err;
  }

  const apiKey = process.env.GEMINI_API_KEY.trim();
  const models = getModelCandidates();
  let lastError = null;

  for (const model of models) {
    try {
      const reply = await requestGeminiModel(model, message, profileData, apiKey);
      if (model !== models[0]) {
        console.warn(`Modèle de repli: ${model}`);
      }
      return reply;
    } catch (error) {
      lastError = error;
      if (error.aiError?.retryable) {
        console.warn(`Modèle ${model} indisponible:`, error.message);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", profile: profile.name });
});

app.get("/api/ai-status", (_req, res) => {
  const configError = getAiConfigError();
  if (configError) {
    return res.status(configError.status).json({
      available: false,
      code: configError.code,
      error: configError.error,
    });
  }

  return res.json({
    available: true,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  });
});

app.post("/api/chat", async (req, res) => {
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

    const reply = await callGemini(trimmedMessage, profile);
    res.json({ reply });
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
