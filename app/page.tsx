import { auth } from "@/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <span style={styles.badge}>CloudBib v1</span>
        <h1 style={styles.title}>CloudBib läuft</h1>
        <p style={styles.text}>
          Basis-App, Datenbank und Auth sind vorbereitet.
        </p>

        <div style={styles.actions}>
          {session?.user ? (
            <Link href="/dashboard" style={styles.link}>
              Zum Dashboard
            </Link>
          ) : (
            <Link href="/signin" style={styles.link}>
              Anmelden
            </Link>
          )}

          <Link href="/api/health" style={styles.linkSecondary}>
            API Healthcheck
          </Link>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(180deg, #0b1020 0%, #11182d 50%, #161f38 100%)",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "720px",
    borderRadius: "20px",
    padding: "32px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    color: "#f5f7fb",
  },
  badge: {
    display: "inline-block",
    marginBottom: "16px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#2b6ef2",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "40px",
    lineHeight: 1.1,
  },
  text: {
    marginTop: "16px",
    marginBottom: "24px",
    fontSize: "17px",
    lineHeight: 1.6,
    color: "#dbe4ff",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  link: {
    textDecoration: "none",
    color: "#ffffff",
    background: "#1d4ed8",
    padding: "12px 16px",
    borderRadius: "12px",
    fontWeight: 600,
  },
  linkSecondary: {
    textDecoration: "none",
    color: "#ffffff",
    background: "#334155",
    padding: "12px 16px",
    borderRadius: "12px",
    fontWeight: 600,
  },
};
