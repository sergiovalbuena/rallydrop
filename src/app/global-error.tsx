"use client";

/** Last-resort error page (the root layout itself failed): plain HTML, no providers. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0E2350",
          color: "#fff",
          fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <p style={{ fontSize: 28, fontWeight: 800 }}>
            rally<span style={{ color: "#D9F23F" }}>drop</span>
          </p>
          <h1 style={{ fontSize: 40, textTransform: "uppercase", margin: "16px 0" }}>Something went wrong</h1>
          <p style={{ opacity: 0.8 }}>
            Please try again. If it keeps happening, contact us and we&apos;ll sort it out.
          </p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button
              onClick={reset}
              style={{
                background: "#D9F23F",
                color: "#0E2350",
                border: 0,
                borderRadius: 999,
                padding: "12px 22px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/book"
              style={{
                color: "#fff",
                border: "1px solid #fff6",
                borderRadius: 999,
                padding: "12px 22px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Book a machine
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
