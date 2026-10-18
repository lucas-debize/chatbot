import { useState, useRef, useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const API_URL = `${BACKEND_URL}/api/chat`;
const AI_STATUS_URL = `${BACKEND_URL}/api/ai-status`;
const MAX_CHARS = 500;

const DEFAULT_SUGGESTIONS = [
  "Quelles sont tes compétences en IA ?",
  "Parle-moi de MyAIFactory et SBDR Team",
  "Quels projets personnels as-tu réalisés ?",
  "Quelle est ta disponibilité actuelle ?",
  "Où puis-je télécharger ton CV ?",
];

const CUSTOM_SUGGESTIONS = [
  "Résume ce CV en 3 points clés",
  "Quelles sont les compétences techniques du candidat ?",
  "Ce profil correspond-il à un poste de Développeur IA ?",
  "Quelles sont ses expériences professionnelles ?",
  "Quels sont ses points forts et axes d'amélioration ?",
];

const CONFIG_ERROR_CODES = new Set(["AI_NOT_CONFIGURED", "AI_INVALID_KEY"]);

function isConfigError(code) {
  return CONFIG_ERROR_CODES.has(code);
}

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Bonjour ! Je suis l'assistant portfolio de Lucas Debize, étudiant Epitech orienté IA et full-stack. Posez-moi des questions sur ses compétences, projets (Prospecthor, RAG Monitor, Elyrii, Assistant RH IA), expérience ou disponibilité.",
};

function Chatbot({ customProfile }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [aiStatusMessage, setAiStatusMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastSendTimeRef = useRef(0);

  // Synchronise le message de bienvenue et l'état quand un profil personnalisé est chargé/réinitialisé
  useEffect(() => {
    if (customProfile) {
      setMessages([
        {
          role: "assistant",
          content: `Mode analyse de document actif pour « ${
            customProfile.name || customProfile.filename || "le CV personnalisé"
          } ». Posez-moi toutes vos questions sur ce profil (compétences, parcours, résumé, adéquation avec un poste...) !`,
        },
      ]);
    } else {
      setMessages([INITIAL_MESSAGE]);
    }
  }, [customProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    async function checkAiStatus() {
      try {
        const response = await fetch(AI_STATUS_URL);
        const data = await response.json();

        if (!response.ok || !data.available) {
          if (isConfigError(data.code)) {
            setAiAvailable(false);
            setAiStatusMessage(
              data.error ||
                "L'IA est indisponible. Vérifiez la configuration du backend (Groq ou Gemini)."
            );
          }
        }
      } catch {
        setAiAvailable(false);
        setAiStatusMessage(
          "Impossible de vérifier l'état de l'IA. Vérifiez que le backend est démarré."
        );
      }
    }

    checkAiStatus();
  }, []);

  async function sendMessage(text) {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    // Anti-flood client-side (1,5 s de délai minimal)
    const now = Date.now();
    if (now - lastSendTimeRef.current < 1500) return;
    lastSendTimeRef.current = now;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          ...(customProfile ? { customProfile } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 || data.code === "RATE_LIMIT_EXCEEDED") {
          throw new Error(
            data.error ||
              "Limite de débit atteinte. Veuillez patienter une minute avant d'envoyer un nouveau message."
          );
        }
        if (isConfigError(data.code)) {
          setAiAvailable(false);
          setAiStatusMessage(data.error);
        }
        throw new Error(
          data.error || "L'IA est indisponible. Réessayez plus tard."
        );
      }

      setAiAvailable(true);
      setAiStatusMessage(null);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Impossible de contacter le serveur. Vérifiez que le backend est démarré."
          : err.message
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  function handleReset() {
    if (customProfile) {
      setMessages([
        {
          role: "assistant",
          content: `Mode analyse de document réinitialisé pour « ${
            customProfile.name || customProfile.filename || "le CV personnalisé"
          } ». Que souhaitez-vous savoir ?`,
        },
      ]);
    } else {
      setMessages([INITIAL_MESSAGE]);
    }
    setInput("");
    setError(null);
    inputRef.current?.focus();
  }

  function handleInputChange(e) {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setInput(value);
    }
  }

  const suggestions = customProfile ? CUSTOM_SUGGESTIONS : DEFAULT_SUGGESTIONS;

  return (
    <div className="chatbot">
      <div className="chatbot-header">
        <div className="chatbot-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3c-4.4 0-8 2.7-8 6v4l-2 2v1h20v-1l-2-2V9c0-3.3-3.6-6-8-6Z" />
            <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div>
          <h2 className="chatbot-title">
            {customProfile ? "Analyseur de CV IA" : "Assistant portfolio"}
          </h2>
          <p className="chatbot-subtitle">
            {customProfile
              ? `Document actif : ${customProfile.name || customProfile.filename || "CV Personnalisé"}`
              : "Réponses générées par IA (Groq / Gemini) à partir du profil et du CV"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleReset}
          disabled={loading}
          title="Nouvelle conversation"
        >
          Nouveau
        </button>
      </div>

      {!aiAvailable && aiStatusMessage && (
        <div className="ai-status-banner" role="alert">
          <strong>IA indisponible</strong>
          <span>{aiStatusMessage}</span>
        </div>
      )}

      <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((msg, index) => (
          <div key={index} className={`message message--${msg.role}`}>
            <div className="message-avatar" aria-hidden="true">
              {msg.role === "user" ? (
                <span className="avatar avatar--user">Vous</span>
              ) : (
                <span className="avatar avatar--bot">IA</span>
              )}
            </div>
            <div className="message-bubble">
              <p className="message-text">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message message--assistant message--loading" aria-label="L'assistant répond">
            <div className="message-avatar" aria-hidden="true">
              <span className="avatar avatar--bot">IA</span>
            </div>
            <div className="message-bubble">
              <div className="typing-indicator" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="suggestions" aria-label="Suggestions de questions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestion-btn"
            onClick={() => sendMessage(suggestion)}
            disabled={loading || !aiAvailable}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={
              aiAvailable
                ? customProfile
                  ? "Ex : Quels sont les points forts de ce profil ?"
                  : "Ex : Parle-moi de ton expérience chez MyAIFactory"
                : "IA indisponible, configurez GROQ_API_KEY ou GEMINI_API_KEY"
            }
            disabled={loading || !aiAvailable}
            maxLength={MAX_CHARS}
            aria-label="Votre message"
          />
          <span className="char-count" aria-hidden="true">
            {input.length}/{MAX_CHARS}
          </span>
        </div>
        <button
          type="submit"
          className="btn btn--primary btn--send"
          disabled={loading || !input.trim() || !aiAvailable}
          aria-label="Envoyer le message"
        >
          <span>Envoyer</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default Chatbot;
