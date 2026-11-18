"use client";

/** Last-resort error page (the root layout itself failed). Plain HTML, no providers. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F6F8F2", color: "#0D1A14", padding: "4rem 1rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem" }}>Something went wrong · केही गडबड भयो</h1>
        <p>Your money and messages are safe. Please try again.</p>
        <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: ".75rem 1.25rem", background: "#1E8E4E", color: "#fff", border: 0, borderRadius: 6, fontWeight: 700 }}>Try again</button>
      </body>
    </html>
  );
}
