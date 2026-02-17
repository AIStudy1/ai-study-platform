import { Link } from "react-router-dom";

function Home() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>LearnFlow</h1>
      <p style={styles.subtitle}>
        Your AI Study Architect — Personalized learning powered by intelligence.
      </p>

      <div style={styles.buttons}>
        <Link to="/register" style={styles.primaryBtn}>
          Get Started
        </Link>

        <Link to="/login" style={styles.secondaryBtn}>
          Login
        </Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: "center",
    marginTop: "100px",
    padding: "20px"
  },
  title: {
    fontSize: "48px",
    marginBottom: "20px"
  },
  subtitle: {
    fontSize: "18px",
    marginBottom: "40px",
    maxWidth: "600px",
    margin: "0 auto 40px"
  },
  buttons: {
    display: "flex",
    justifyContent: "center",
    gap: "20px"
  },
  primaryBtn: {
    padding: "12px 24px",
    backgroundColor: "#4f46e5",
    color: "white",
    textDecoration: "none",
    borderRadius: "6px"
  },
  secondaryBtn: {
    padding: "12px 24px",
    border: "2px solid #4f46e5",
    color: "#4f46e5",
    textDecoration: "none",
    borderRadius: "6px"
  }
};

export default Home;
