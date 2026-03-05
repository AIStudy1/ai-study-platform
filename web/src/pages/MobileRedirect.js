import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function MobileRedirect() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
  || user?.email?.split("@")[0]
  || "there";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .store-btn:hover { transform: translateY(-2px); opacity: 0.9; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#0d1117",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif", padding: 24,
        position: "relative", overflow: "hidden",
        textAlign: "center",
      }}>

        {/* Background glows */}
        <div style={{
          position: "absolute", top: "10%", left: "20%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(110,231,247,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "15%",
          width: 350, height: 350, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ animation: "fadeUp 0.5s ease forwards", maxWidth: 480, width: "100%" }}>

          {/* Clickable logo → Home */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <div
                onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                title="Back to Home"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: "#0d1117",
                  cursor: "pointer", transition: "opacity 0.2s",
                }}>A</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>AI Study</div>
                <div style={{ color: "#4b5563", fontSize: 11 }}>Student Portal</div>
              </div>
            </a>
          </div>

          {/* Floating phone icon */}
          <div style={{
            fontSize: 80, marginBottom: 28,
            animation: "float 3s ease-in-out infinite",
            display: "inline-block",
          }}>📱</div>

          {/* Greeting */}
          <h1 style={{
            fontFamily: "'Syne', sans-serif", color: "#f1f5f9",
            fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em",
            marginBottom: 12,
          }}>
            Hi {firstName}! 👋
          </h1>

          <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.6, marginBottom: 8 }}>
            Your AI Study experience is on our <span style={{ color: "#6ee7f7", fontWeight: 600 }}>mobile app</span>.
          </p>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, marginBottom: 40 }}>
            Access your Moodle courses, chat with your AI assistant, earn XP and badges — all from your phone.
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            {["🤖 AI Assistant", "📚 Moodle Courses", "🏅 Gamification", "🔥 Streaks & XP"].map(f => (
              <span key={f} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13,
                background: "#1a1f2e", border: "1px solid #2a2f42", color: "#9ca3af",
              }}>{f}</span>
            ))}
          </div>

          {/* App store buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button className="store-btn" style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 24px", borderRadius: 12,
              background: "linear-gradient(135deg, #1a1f2e, #141824)",
              border: "1px solid #2a2f42", cursor: "pointer",
              transition: "all 0.2s", color: "#f1f5f9",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <span style={{ fontSize: 28 }}>🍎</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Download on the</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>App Store</div>
              </div>
            </button>

            <button className="store-btn" style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 24px", borderRadius: 12,
              background: "linear-gradient(135deg, #1a1f2e, #141824)",
              border: "1px solid #2a2f42", cursor: "pointer",
              transition: "all 0.2s", color: "#f1f5f9",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <span style={{ fontSize: 28 }}>🤖</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Get it on</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Google Play</div>
              </div>
            </button>
          </div>

          {/* Demo notice */}
          <div style={{
            background: "linear-gradient(135deg, #0a1628, #0d1a2e)",
            border: "1px solid #1e3a5f", borderRadius: 12,
            padding: "16px 20px", marginBottom: 32, marginTop: 12,
          }}>
            <div style={{ color: "#6ee7f7", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              🚀 Demo Mode
            </div>
            <div style={{ color: "#4b5563", fontSize: 12, lineHeight: 1.6 }}>
              The app is currently in demo phase. Scan the Expo QR code to preview the mobile experience.
            </div>
          </div>

          {/* Sign out */}
          <button onClick={handleLogout} style={{
            background: "transparent", border: "1px solid #2a2f42",
            borderRadius: 10, padding: "10px 24px",
            color: "#6b7280", fontSize: 13, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
          }}>
            ← Sign out
          </button>
        </div>
      </div>
    </>
  );
}