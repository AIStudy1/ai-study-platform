import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useState, useEffect } from "react";

function Navbar() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for auth state change
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    // Detect mobile screen
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    handleResize(); // initial check

    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); // redirect after logout
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <nav style={styles.nav}>
      <h2 style={styles.logo}>LearnFlow</h2>

      {/* Hamburger button for mobile */}
      {isMobile && (
        <button
          style={styles.hamburger}
          onClick={() => setShowLinks(!showLinks)}
        >
          ☰
        </button>
      )}

      {/* Links */}
      <div
        style={{
          ...styles.links,
          flexDirection: isMobile ? "column" : "row",
          display: isMobile ? (showLinks ? "flex" : "none") : "flex",
        }}
      >
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/assessment" style={styles.link}>Assessment</Link>

        {!user && (
          <>
            <Link to="/login" style={styles.link}>Login</Link>
            <Link to="/register" style={styles.link}>Register</Link>
          </>
        )}

        {user && (
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    backgroundColor: "#111",
    color: "white",
    position: "relative",
  },
  logo: {
    margin: 0,
  },
  links: {
    display: "flex",
    gap: "15px",
    alignItems: "center",
  },
  link: {
    color: "white",
    textDecoration: "none",
    margin: "5px 0",
  },
  logoutButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "5px 10px",
    cursor: "pointer",
    borderRadius: "4px",
  },
  hamburger: {
    fontSize: "24px",
    color: "white",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
};

export default Navbar;
