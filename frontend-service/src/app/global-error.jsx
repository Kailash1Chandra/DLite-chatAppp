'use client';

export default function GlobalError({ error, reset }) {
  // Minimal UI with no dependency on app CSS.
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 520, width: '100%', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 18, padding: 18 }}>
            <h1 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h1>
            <p style={{ marginTop: 10, marginBottom: 14, fontSize: 14, color: 'rgba(0,0,0,0.75)' }}>
              A critical error occurred. You can try again.
            </p>
            <button
              onClick={reset}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: 'none',
                background: '#ea580c',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <pre style={{ marginTop: 14, fontSize: 11, whiteSpace: 'pre-wrap', color: 'rgba(0,0,0,0.6)' }}>
              {String(error?.message || '')}
            </pre>
          </div>
        </div>
      </body>
    </html>
  );
}

