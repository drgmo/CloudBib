import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Anmelden</h1>
        <p style={styles.text}>
          Melde dich mit deinem Google-Konto an, um CloudBib zu verwenden.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button type="submit" style={styles.button}>
            Mit Google anmelden
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#111827",
    color: "#f9fafb",
    borderRadius: "18px",
    padding: "32px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  title: {
    margin: 0,
    fontSize: "32px",
  },
  text: {
    marginTop: "12px",
    marginBottom: "24px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: "12px",
    padding: "14px 16px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
};
