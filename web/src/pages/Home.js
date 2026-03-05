import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const navigate = useNavigate();
  const { token, isAdmin, isStudent } = useAuth();

  const handleCTA = () => {
    if (token && isAdmin) navigate("/dashboard");
    else if (token && isStudent) navigate("/mobile");
    else navigate("/login");
  };

  const features = [
    {
      icon: "🤖",
      title: "AI Study Assistant",
      desc: "Chat with an AI tutor that knows your courses. Get explanations, summaries, and practice questions instantly.",
      color: "#6ee7f7",
    },
    {
      icon: "📚",
      title: "Moodle Integration",
      desc: "Connect your Moodle account and access all your courses, materials, and assignments in one place.",
      color: "#a78bfa",
    },
    {
      icon: "🏅",
      title: "Gamified Learning",
      desc: "Earn XP, level up, maintain streaks, and unlock badges as you study. Learning has never been this fun.",
      color: "#34d399",
    },
    {
      icon: "📊",
      title: "Admin Dashboard",
      desc: "Track student progress, monitor engagement, and get real-time analytics across all courses.",
      color: "#fb923c",
    },
  ];

  const stats = [
    { value: "AI-Powered", label: "Study Assistant" },
    { value: "Moodle", label: "Integration" },
    { value: "Real-time", label: "Analytics" },
    { value: "Gamified", label: "Experience" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(110,231,247,0.3); }
        .feature-card:hover { transform: translateY(-4px); border-color: #3a3f52 !important; }
        .nav-link:hover { color: #f1f5f9 !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Navbar ── */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(13,17,23,0.85)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid #1e2336",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 48px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#0d1117", fontSize: 16,
            }}>A</div>
            <span style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18 }}>AI Study</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Features", "About"].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="nav-link" style={{
                color: "#6b7280", fontSize: 14, textDecoration: "none", transition: "color 0.2s",
              }}>{l}</a>
            ))}
            <button onClick={handleCTA} style={{
              padding: "9px 20px", borderRadius: 10,
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              border: "none", color: "#0d1117", fontWeight: 700,
              fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s",
            }}>
              {token && isAdmin ? "Dashboard →" : "Sign in →"}
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "120px 24px 80px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Background glows */}
          <div style={{
            position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
            width: 800, height: 500, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(110,231,247,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", top: "40%", left: "20%",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#1a1f2e", border: "1px solid #2a2f42",
            borderRadius: 20, padding: "6px 16px", marginBottom: 32,
            animation: "fadeUp 0.4s ease forwards",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite", display: "inline-block" }} />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>ISS Junior Project — Demo Phase</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Syne', sans-serif", color: "#f1f5f9",
            fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.1,
            marginBottom: 24, maxWidth: 800,
            animation: "fadeUp 0.5s ease 0.1s both",
          }}>
            Study smarter with{" "}
            <span style={{
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>AI-powered</span>{" "}
            learning
          </h1>

          <p style={{
            color: "#6b7280", fontSize: "clamp(16px, 2vw, 20px)",
            lineHeight: 1.7, maxWidth: 560, marginBottom: 48,
            animation: "fadeUp 0.5s ease 0.2s both",
          }}>
            Connect your Moodle account, chat with an AI tutor, earn XP and badges, and track your progress — all in one app built for ISS students.
          </p>

          {/* CTA buttons */}
          <div style={{
            display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap",
            animation: "fadeUp 0.5s ease 0.3s both",
          }}>
            <button onClick={handleCTA} className="cta-btn" style={{
              padding: "14px 32px", borderRadius: 12,
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              border: "none", color: "#0d1117", fontWeight: 700,
              fontSize: 16, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
            }}>
              {token && isAdmin ? "Go to Dashboard →" : "Get Started →"}
            </button>
            <button onClick={() => document.getElementById("features").scrollIntoView({ behavior: "smooth" })} style={{
              padding: "14px 32px", borderRadius: 12,
              background: "transparent", border: "1px solid #2a2f42",
              color: "#9ca3af", fontWeight: 600, fontSize: 16,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s",
            }}>
              See Features
            </button>
          </div>

          {/* Floating phone mockup */}
          <div style={{
            marginTop: 80, fontSize: 120,
            animation: "float 4s ease-in-out infinite",
            filter: "drop-shadow(0 20px 40px rgba(110,231,247,0.15))",
          }}>📱</div>
        </section>

        {/* ── Stats strip ── */}
        <section style={{
          borderTop: "1px solid #1e2336", borderBottom: "1px solid #1e2336",
          padding: "40px 48px",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", color: "#6ee7f7", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
              <div style={{ color: "#4b5563", fontSize: 13 }}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── Features ── */}
        <section id="features" style={{ padding: "100px 48px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", color: "#f1f5f9", fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>
              Everything you need to study better
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16 }}>Built for ISS students and administrators</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="feature-card" style={{
                background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)",
                border: "1px solid #2a2f42", borderRadius: 16,
                padding: "32px", transition: "all 0.25s",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: -20, right: -20,
                  width: 100, height: 100, borderRadius: "50%",
                  background: f.color, opacity: 0.06, filter: "blur(20px)",
                }} />
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", color: "#f1f5f9", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── About / CTA section ── */}
        <section id="about" style={{
          margin: "0 48px 100px", borderRadius: 20,
          background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)",
          border: "1px solid #2a2f42", padding: "64px 48px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600, height: 300, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(110,231,247,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <h2 style={{ fontFamily: "'Syne', sans-serif", color: "#f1f5f9", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
            Built at ISS, for ISS
          </h2>
          <p style={{ color: "#6b7280", fontSize: 16, lineHeight: 1.7, maxWidth: 500, margin: "0 auto 40px" }}>
            AI Study is a junior project developed by ISS students to make studying more effective, engaging, and fun using the power of AI.
          </p>
          <button onClick={handleCTA} className="cta-btn" style={{
            padding: "14px 36px", borderRadius: 12,
            background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
            border: "none", color: "#0d1117", fontWeight: 700,
            fontSize: 16, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
          }}>
            {token && isAdmin ? "Go to Dashboard →" : "Sign in →"}
          </button>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: "1px solid #1e2336", padding: "24px 48px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#0d1117", fontSize: 12,
            }}>A</div>
            <span style={{ color: "#4b5563", fontSize: 13 }}>AI Study — ISS Junior Project 2026</span>
          </div>
          <span style={{ color: "#2a2f42", fontSize: 12 }}>Demo Phase</span>
        </footer>
      </div>
    </>
  );
}
