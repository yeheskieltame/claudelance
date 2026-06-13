"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself, where the
 * normal error.tsx (which renders inside the layout) cannot. Must ship its own
 * <html>/<body>. Kept minimal and dependency-free so it renders even when the
 * app shell is the thing that failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100svh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#121010",
          color: "#f0ece6",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", color: "#9a948c", lineHeight: 1.6, margin: 0 }}>
          The app failed to load. Your funds and on-chain state are unaffected. Reload to try again.
        </p>
        {error.digest ? (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6b655d", margin: 0 }}>
            ref: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            borderRadius: "9999px",
            border: "none",
            background: "#c2683f",
            color: "#fff",
            padding: "0.625rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
