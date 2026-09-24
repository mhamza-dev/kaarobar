"use client";

/**
 * The last resort: the root layout itself failed. It renders its own
 * document without the app's styles, so it is deliberately plain and
 * inline-styled — anything fancier could fail for the same reason.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 24,
          textAlign: "center",
        }}
      >
        <title>Kaarobar — something went wrong</title>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Kaarobar couldn&apos;t load</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>
            {error.digest ? `Reference ${error.digest}. ` : ""}Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
