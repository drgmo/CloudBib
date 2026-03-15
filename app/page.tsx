export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
      }}
    >
      <h1>CloudBib</h1>
      <p style={{ color: "var(--muted)" }}>
        Self-hosted reference manager for teams
      </p>
    </main>
  );
}
