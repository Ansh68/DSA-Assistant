"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Types ──────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "streaming" | "done" | "error";

interface TimestampResult {
  video_id: string;
  video_title: string;
  start_time: number;
  end_time: number;
  start_timestamp: string;
  end_timestamp: string;
  reranker_score: number;
}

interface QueryState {
  status: Status;
  query: string;
  normalizedQuery: string;
  answer: string;
  results: TimestampResult[];
  error: string | null;
}

/* ─── Config ─────────────────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EXAMPLE_QUERIES = [
  "Two pointer kya hota hai?",
  "Binary search explain karo",
  "Sliding window technique ka use kab hota hai?",
  "Recursion aur iteration mein kya difference hai?",
  "Merge sort kaise kaam karta hai?",
];

/* ─── SSE Parser ─────────────────────────────────────────────── */

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      if (!message.trim()) continue;
      let eventType = "";
      let data = "";

      for (const line of message.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ")) data = line.slice(6).trim();
      }

      if (eventType && data) {
        try {
          yield { type: eventType, data: JSON.parse(data) };
        } catch {
          /* skip malformed events */
        }
      }
    }
  }
}

/* ─── Sub-components ─────────────────────────────────────────── */

function StatusBar({ status, normalizedQuery }: { status: Status; normalizedQuery: string }) {
  if (status === "idle" || status === "done") return null;

  if (status === "error") return null; // shown separately

  const isLoading = status === "loading";
  const isStreaming = status === "streaming";

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        marginBottom: "20px",
      }}
    >
      {isLoading ? (
        <>
          <div className="spinner" />
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Analyzing your question...
          </span>
        </>
      ) : (
        <>
          <div className={`status-dot ${isStreaming ? "streaming" : ""}`} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Generating answer
            {normalizedQuery && (
              <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                · queried as{" "}
                <span
                  style={{
                    color: "var(--accent-soft)",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.8rem",
                  }}
                >
                  {normalizedQuery}
                </span>
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}


function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AnswerCard({ answer, status }: { answer: string; status: Status }) {
  const isStreaming = status === "streaming";
  const isEmpty = !answer;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading" && isEmpty) {
    // Skeleton while waiting for first token
    return (
      <div
        className="glass-card animate-fade-in"
        style={{ padding: "28px", marginBottom: "24px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          <span
            style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Answer
          </span>
        </div>
        <div className="skeleton" style={{ height: "14px", width: "90%", marginBottom: "10px" }} />
        <div className="skeleton" style={{ height: "14px", width: "75%", marginBottom: "10px" }} />
        <div className="skeleton" style={{ height: "14px", width: "82%" }} />
      </div>
    );
  }

  if (isEmpty) return null;

  return (
    <div
      className="glass-card animate-fade-in-up"
      style={{ padding: "28px", marginBottom: "24px" }}
    >
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Answer
          </span>
        </div>

        {answer && !isStreaming && (
          <button
            onClick={handleCopy}
            className="copy-button"
            title="Copy answer"
          >
            {copied ? (
              <>
                <CheckIcon />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Rendered Markdown Answer */}
      <div className="answer-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {answer}
        </ReactMarkdown>
        {isStreaming && <span className="cursor-blink" />}
      </div>
    </div>
  );
}


function TimestampCard({
  result,
  index,
  isActive,
  onSelect,
}: {
  result: TimestampResult;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const thumbnailUrl = `https://img.youtube.com/vi/${result.video_id}/mqdefault.jpg`;
  const scorePercent = Math.round(result.reranker_score * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`glass-card glass-card-hover animate-fade-in-up ${isActive ? "card-playing" : ""}`}
      style={{
        display: "block",
        overflow: "hidden",
        cursor: "pointer",
        animationDelay: `${index * 0.08}s`,
        boxShadow: "var(--shadow-card)",
        border: isActive ? "1.5px solid #ffffff" : undefined,
        background: isActive ? "#333333" : undefined,
      }}
    >
      {/* Thumbnail */}
      <div className="thumbnail-wrapper">
        <Image
          src={thumbnailUrl}
          alt={result.video_title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          style={{ objectFit: "cover" }}
          unoptimized
        />
        <div className={`play-overlay ${isActive ? "play-overlay-active" : ""}`}>
          <div className="play-icon">
            {isActive ? (
              <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "12px" }}>
                <span className="eq-bar eq-bar-1" />
                <span className="eq-bar eq-bar-2" />
                <span className="eq-bar eq-bar-3" />
              </div>
            ) : (
              <svg width="14" height="16" viewBox="0 0 14 16" fill="white">
                <path d="M0 0 L14 8 L0 16 Z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px 16px" }}>
        {/* Timestamp badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span className="timestamp-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {result.start_timestamp} → {result.end_timestamp}
          </span>
          {isActive && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--accent-soft)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Playing
            </span>
          )}
        </div>

        {/* Video title */}
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            marginBottom: "12px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {result.video_title}
        </p>

        {/* Score bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="score-bar-track" style={{ flex: 1 }}>
            <div className="score-bar-fill" style={{ width: `${scorePercent}%` }} />
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            {scorePercent}%
          </span>
        </div>
      </div>
    </div>
  );
}


function SourcesSection({
  results,
  status,
  activeVideo,
  onSelectVideo,
  onCloseVideo,
  playerRef,
}: {
  results: TimestampResult[];
  status: Status;
  activeVideo: TimestampResult | null;
  onSelectVideo: (result: TimestampResult) => void;
  onCloseVideo: () => void;
  playerRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (status === "loading" || (results.length === 0 && status !== "done")) return null;

  // Skeleton cards while streaming but results not yet arrived
  if (results.length === 0 && status === "streaming") {
    return (
      <div style={{ marginTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <div
            style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--border-medium)",
            }}
          />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Sources
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card" style={{ overflow: "hidden" }}>
              <div className="skeleton" style={{ aspectRatio: "16/9", borderRadius: "var(--radius-md) var(--radius-md) 0 0" }} />
              <div style={{ padding: "14px 16px 16px" }}>
                <div className="skeleton" style={{ height: "20px", width: "60%", marginBottom: "10px" }} />
                <div className="skeleton" style={{ height: "12px", width: "90%", marginBottom: "6px" }} />
                <div className="skeleton" style={{ height: "12px", width: "70%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div style={{ marginTop: "8px" }}>
      {/* On-platform Embedded Video Player */}
      {activeVideo && (
        <div
          ref={playerRef}
          className="glass-card animate-fade-in"
          style={{
            marginBottom: "24px",
            overflow: "hidden",
            border: "1px solid var(--border-medium)",
            background: "#050810",
          }}
        >
          {/* Player header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minWidth: 0,
                flex: 1,
                marginRight: "12px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={activeVideo.video_title}
              >
                {activeVideo.video_title}
              </span>
              <span className="timestamp-badge" style={{ flexShrink: 0 }}>
                {activeVideo.start_timestamp} → {activeVideo.end_timestamp}
              </span>
            </div>

            <button
              onClick={onCloseVideo}
              className="close-player-button"
              title="Close video player"
              aria-label="Close video player"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Close</span>
            </button>
          </div>

          {/* 16:9 responsive embed */}
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "56.25%",
              background: "#000",
            }}
          >
            <iframe
              key={`${activeVideo.video_id}-${activeVideo.start_time}`}
              src={`https://www.youtube.com/embed/${activeVideo.video_id}?start=${Math.floor(activeVideo.start_time)}&autoplay=1&rel=0`}
              title={activeVideo.video_title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <div
          style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "var(--accent)",
          }}
        />
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Jump to these moments
        </span>
      </div>

      {/* Grid of Timestamp cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {results.map((result, i) => {
          const isCardActive =
            activeVideo?.video_id === result.video_id &&
            activeVideo?.start_time === result.start_time;

          return (
            <TimestampCard
              key={result.video_id + result.start_time}
              result={result}
              index={i}
              isActive={Boolean(isCardActive)}
              onSelect={() => onSelectVideo(result)}
            />
          );
        })}
      </div>
    </div>
  );
}


const TOTAL_WARMUP_SECONDS = 55;

export default function QueryInterface() {
  const [inputValue, setInputValue] = useState("");
  const [activeVideo, setActiveVideo] = useState<TimestampResult | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [warmupSecondsLeft, setWarmupSecondsLeft] = useState(TOTAL_WARMUP_SECONDS);
  const [showReadyNotice, setShowReadyNotice] = useState(false);
  const [state, setState] = useState<QueryState>({
    status: "idle",
    query: "",
    normalizedQuery: "",
    answer: "",
    results: [],
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  // Server warmup check & countdown timer for Render cold starts
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pingServer = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { method: "GET" });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.status === "ok") {
            setIsWarmingUp(false);
            setShowReadyNotice(true);
            setTimeout(() => {
              if (isMounted) setShowReadyNotice(false);
            }, 3000);
            return true;
          }
        }
      } catch {
        // Server is still waking up from Render cold sleep
      }
      return false;
    };

    // Quick initial check
    pingServer().then((ready) => {
      if (ready && interval) clearInterval(interval);
    });

    interval = setInterval(() => {
      setWarmupSecondsLeft((prev) => {
        if (prev <= 1) {
          if (interval) clearInterval(interval);
          setIsWarmingUp(false);
          setShowReadyNotice(true);
          setTimeout(() => {
            if (isMounted) setShowReadyNotice(false);
          }, 3000);
          return 0;
        }

        // Ping server every 3 seconds while counting down
        if (prev % 3 === 0) {
          pingServer().then((ready) => {
            if (ready && interval) clearInterval(interval);
          });
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({
      status: "idle",
      query: "",
      normalizedQuery: "",
      answer: "",
      results: [],
      error: null,
    });
    setInputValue("");
    setActiveVideo(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Handle browser back button: return to main home page instead of leaving the site
  useEffect(() => {
    const handlePopState = () => {
      handleReset();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handleReset]);

  const handleQuery = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Push browser history state on query so hitting Back returns to main page
    if (typeof window !== "undefined" && state.status === "idle") {
      window.history.pushState({ view: "results" }, "");
    }

    // Cancel any ongoing request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Clear input box and reset any active video player
    setInputValue("");
    setActiveVideo(null);

    setState({
      status: "loading",
      query: trimmed,
      normalizedQuery: "",
      answer: "",
      results: [],
      error: null,
    });

    // Scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    try {
      const response = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();

      for await (const event of parseSSEStream(reader)) {
        if (event.type === "meta") {
          setState((prev) => ({
            ...prev,
            status: "streaming",
            normalizedQuery: event.data.normalized_query ?? "",
          }));
        } else if (event.type === "token") {
          setState((prev) => ({
            ...prev,
            answer: prev.answer + (event.data.content ?? ""),
          }));
        } else if (event.type === "results") {
          setState((prev) => ({
            ...prev,
            results: event.data.results ?? [],
          }));
        } else if (event.type === "done") {
          setState((prev) => ({ ...prev, status: "done" }));
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        error: (err as Error).message,
      }));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(inputValue);
  };

  const isActive = state.status !== "idle";
  const isBusy = state.status === "loading" || state.status === "streaming";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "0 24px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo - click returns to main page */}
          <button
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
              fontFamily: "inherit",
              textAlign: "left",
            }}
            title="Return to main page"
            aria-label="Return to main page"
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* Play icon */}
              <svg width="10" height="12" viewBox="0 0 10 12" fill="#000000">
                <path d="M0 0 L10 6 L0 12 Z" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#ffffff", letterSpacing: "-0.01em" }}>
              DSA Assistant
            </span>
          </button>

        </div>
      </header>

      {/* ── Server Warmup Banner ─────────────────────────────────── */}
      {isWarmingUp && (
        <div className="warmup-banner">
          <div className="warmup-spinner" />
          <span>
            Wait for <strong style={{ color: "#ffffff", fontWeight: 600 }}>{warmupSecondsLeft}s</strong> to heat up the server
          </span>
          <div
            className="warmup-progress-bar"
            style={{
              width: `${Math.min(100, Math.max(0, ((TOTAL_WARMUP_SECONDS - warmupSecondsLeft) / TOTAL_WARMUP_SECONDS) * 100))}%`,
            }}
          />
        </div>
      )}

      {showReadyNotice && !isWarmingUp && (
        <div className="warmup-banner" style={{ background: "var(--bg-secondary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ color: "#ffffff", fontWeight: 500 }}>Server is ready</span>
        </div>
      )}

      {/* ── Hero / Search ────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
          padding: isActive ? "48px 24px 32px" : "96px 24px 64px",
          transition: "padding 0.4s ease",
        }}
      >
        {/* Heading — shown only when idle */}
        {!isActive && (
          <div
            className="animate-fade-in"
            style={{ textAlign: "center", marginBottom: "40px" }}
          >
            <h1
              className="gradient-text"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.2rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                marginBottom: "16px",
              }}
            >
              Ask Anything About DSA
            </h1>
            <p
              style={{
                fontSize: "1rem",
                color: "var(--text-secondary)",
                maxWidth: "520px",
                margin: "0 auto",
                lineHeight: 1.7,
              }}
            >
              Get AI-powered Hinglish answers from your course videos — with
              exact timestamps to jump right to the explanation.
            </p>
          </div>
        )}

        {/* Search bar */}
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <form onSubmit={handleSubmit}>
            <div className="search-wrapper">
              <input
                id="query-input"
                className="search-input"
                type="text"
                placeholder={isWarmingUp ? `Wait for server to heat up (${warmupSecondsLeft}s)...` : "DSA ke baare mein kuch bhi pucho..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isWarmingUp) handleQuery(inputValue);
                  }
                }}
                disabled={isBusy || isWarmingUp}
                autoFocus={!isWarmingUp}
                autoComplete="off"
              />
              <button
                id="submit-button"
                type="submit"
                className="search-button"
                disabled={isBusy || isWarmingUp || !inputValue.trim()}
                aria-label="Search"
              >
                {isBusy ? (
                  <div className="spinner" style={{ borderTopColor: "#fff" }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* Example queries — idle only */}
          {!isActive && (
            <div
              className="animate-fade-in"
              style={{
                marginTop: "20px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  className="query-chip"
                  disabled={isBusy || isWarmingUp}
                  style={{
                    cursor: isWarmingUp ? "not-allowed" : "pointer",
                    opacity: isWarmingUp ? 0.45 : 1,
                  }}
                  onClick={() => {
                    if (!isWarmingUp) handleQuery(q);
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Results ──────────────────────────────────────────────── */}
      {isActive && (
        <section
          ref={resultsRef}
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            width: "100%",
            padding: "0 24px 80px",
          }}
        >
          <div className="divider" style={{ marginBottom: "32px" }} />

          {/* Error state */}
          {state.status === "error" && (
            <div
              className="animate-fade-in"
              style={{
                padding: "16px 20px",
                background: "#2a2a2a",
                border: "1px solid #525252",
                borderRadius: "var(--radius-md)",
                color: "#f4f4f5",
                fontSize: "0.9rem",
                marginBottom: "24px",
              }}
            >
              <strong>Error:</strong> {state.error}. Make sure the backend is
              running on port 8000.
            </div>
          )}

          {/* Status bar */}
          <StatusBar status={state.status} normalizedQuery={state.normalizedQuery} />

          {/* Answer */}
          <AnswerCard answer={state.answer} status={state.status} />

          {/* Sources / Timestamps */}
          <SourcesSection
            results={state.results}
            status={state.status}
            activeVideo={activeVideo}
            onSelectVideo={(video) => {
              setActiveVideo(video);
              setTimeout(() => {
                playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }, 50);
            }}
            onCloseVideo={() => setActiveVideo(null)}
            playerRef={playerRef}
          />
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border-subtle)",
          padding: "20px 24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.78rem",
        }}
      >
        Answers are generated from course transcripts only. Always verify with
        the full video.
      </footer>
    </div>
  );
}
