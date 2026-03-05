import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const COLORS = ["#6ee7f7", "#a78bfa", "#34d399", "#fb923c"];

const LEVEL_COLORS = {
  beginner: { bg: "#0a2e1a", color: "#34d399", border: "#34d39933" },
  intermediate: { bg: "#1a2a0a", color: "#fb923c", border: "#fb923c33" },
  advanced: { bg: "#2a1a1a", color: "#f87171", border: "#f8717133" },
};

// ── Fetch hook ─────────────────────────────────────────────────────────────────
const useDashboardData = (endpoint, token) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/dashboard/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
};

// ── Shared components ──────────────────────────────────────────────────────────
const Skeleton = ({ h = 20, w = "100%", mb = 0 }) => (
  <div style={{ height: h, width: w, background: "#2a2f42", borderRadius: 6, marginBottom: mb, opacity: 0.6 }} />
);

const StatCard = ({ label, value, icon, color, loading }) => (
  <div style={{
    background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)",
    border: "1px solid #2a2f42", borderRadius: 16, padding: "24px 28px",
    display: "flex", flexDirection: "column", gap: 12,
    position: "relative", overflow: "hidden",
    transition: "transform 0.2s", cursor: "default",
  }}
    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
  >
    <div style={{
      position: "absolute", top: -20, right: -20, width: 80, height: 80,
      borderRadius: "50%", background: color, opacity: 0.08, filter: "blur(20px)",
    }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    {loading
      ? <div style={{ height: 40, background: "#2a2f42", borderRadius: 8 }} />
      : <div style={{ fontSize: 36, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{value}</div>
    }
  </div>
);

// ── Toggle ─────────────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{
    width: 44, height: 24, borderRadius: 12, cursor: "pointer", transition: "background 0.2s",
    background: value ? "linear-gradient(135deg, #6ee7f7, #a78bfa)" : "#2a2f42",
    position: "relative", flexShrink: 0,
  }}>
    <div style={{
      position: "absolute", top: 3, left: value ? 23 : 3,
      width: 18, height: 18, borderRadius: "50%", background: "#fff",
      transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    }} />
  </div>
);

// ── Settings helpers ───────────────────────────────────────────────────────────
const SettingsSection = ({ title, children }) => (
  <div style={{
    background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)",
    border: "1px solid #2a2f42", borderRadius: 16, padding: 24, marginBottom: 20,
  }}>
    <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 20 }}>{title}</div>
    {children}
  </div>
);

const SettingsRow = ({ icon, label, subtitle, action }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 0", borderBottom: "1px solid #1e2336",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>{label}</div>
        {subtitle && <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
    <div>{action}</div>
  </div>
);

// ── Chart Card wrapper ─────────────────────────────────────────────────────────
const ChartCard = ({ title, subtitle, children, loading }) => (
  <div style={{
    background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)",
    border: "1px solid #2a2f42", borderRadius: 16, padding: 24,
  }}>
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
      {subtitle && <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
    </div>
    {loading ? <Skeleton h={180} /> : children}
  </div>
);

// ── Sidebar ────────────────────────────────────────────────────────────────────
const Sidebar = ({ activeNav, setActiveNav, user, onLogout }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "students", label: "Students", icon: "👥" },
    { id: "courses", label: "Courses", icon: "📚" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <aside style={{
      width: 240, background: "#0f1319", borderRight: "1px solid #1e2336",
      display: "flex", flexDirection: "column", padding: "28px 0",
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
    }}>
      <div style={{ padding: "0 24px 32px", borderBottom: "1px solid #1e2336" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "#0d1117",
              cursor: "pointer", transition: "opacity 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              title="Back to Home"
            >A</div>
          </a>
          <div>
            <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>AI Study</div>
            <div style={{ color: "#4b5563", fontSize: 11 }}>Admin Portal</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: "20px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map(item => (
          <button key={item.id}
            onClick={() => setActiveNav(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 10, border: "none",
              cursor: "pointer", width: "100%", textAlign: "left",
              background: activeNav === item.id ? "linear-gradient(135deg, #1e2a4a, #1a2040)" : "transparent",
              borderLeft: activeNav === item.id ? "2px solid #6ee7f7" : "2px solid transparent",
              color: activeNav === item.id ? "#6ee7f7" : "#6b7280",
              fontSize: 14, fontWeight: activeNav === item.id ? 600 : 400,
              transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
            }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #1e2336" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #a78bfa, #6ee7f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0d1117", fontWeight: 700, fontSize: 14,
          }}>{user?.email?.[0]?.toUpperCase() || "A"}</div>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>Admin</div>
            <div style={{ color: "#4b5563", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email || ""}
            </div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          width: "100%", padding: "8px", borderRadius: 8,
          border: "1px solid #2a2f42", background: "transparent",
          color: "#6b7280", fontSize: 12, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Sign out</button>
      </div>
    </aside>
  );
};

// ── Page Header ────────────────────────────────────────────────────────────────
const PageHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: 36 }}>
    <h1 style={{ fontFamily: "'Syne', sans-serif", color: "#f1f5f9", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
    <p style={{ color: "#4b5563", fontSize: 14, marginTop: 4 }}>{subtitle}</p>
  </div>
);

// ── DASHBOARD PAGE ─────────────────────────────────────────────────────────────
const DashboardPage = ({ token }) => {
  const { data: stats, loading: statsLoading } = useDashboardData("stats", token);
  const { data: distribution, loading: distLoading } = useDashboardData("course-distribution", token);
  const { data: weeklySignups, loading: weeklyLoading } = useDashboardData("weekly-signups", token);
  const { data: activity, loading: activityLoading } = useDashboardData("recent-activity", token);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Students" value={stats?.totalStudents ?? "—"} icon="👥" color="#6ee7f7" loading={statsLoading} />
        <StatCard label="Featured Courses" value={stats?.totalCourses ?? "—"} icon="📚" color="#a78bfa" loading={statsLoading} />
        <StatCard label="Active Enrollments" value={stats?.activeEnrollments ?? "—"} icon="📖" color="#34d399" loading={statsLoading} />
        <StatCard label="Avg. Progress" value={stats ? `${stats.avgProgress}%` : "—"} icon="📊" color="#fb923c" loading={statsLoading} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)", border: "1px solid #2a2f42", borderRadius: 16, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>New Students</div>
            <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>Registrations over the past 7 days</div>
          </div>
          {weeklyLoading ? <Skeleton h={180} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklySignups || []}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6ee7f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6ee7f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" />
                <XAxis dataKey="day" stroke="#4b5563" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                <YAxis stroke="#4b5563" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2a2f42", borderRadius: 8, color: "#f1f5f9" }} />
                <Area type="monotone" dataKey="signups" stroke="#6ee7f7" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)", border: "1px solid #2a2f42", borderRadius: 16, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>Course Enrollments</div>
            <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>Students per course</div>
          </div>
          {distLoading ? <Skeleton h={160} /> : distribution && distribution.length > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <PieChart width={160} height={160}>
                  <Pie data={distribution} cx={75} cy={75} innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {distribution.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.name}</span>
                    </div>
                    <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.value} students</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", marginTop: 60 }}>No enrollment data yet</div>}
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)", border: "1px solid #2a2f42", borderRadius: 16, padding: 24 }}>
        <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Live Activity</div>
        <div style={{ color: "#4b5563", fontSize: 12, marginBottom: 20 }}>Recent student actions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {activityLoading ? [1,2,3].map(i => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: "#2a2f42", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><Skeleton h={14} mb={6} /><Skeleton h={11} w="70%" /></div>
            </div>
          )) : (activity || []).length === 0
            ? <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No activity yet</div>
            : (activity || []).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "#0d1117", border: "1px solid #2a2f42",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>{item.type === "badge" ? "🏅" : item.type === "ai" ? "🤖" : "📖"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{item.user}</div>
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{item.action} · {item.course}</div>
                  </div>
                  <div style={{ color: "#4b5563", fontSize: 11, flexShrink: 0 }}>{item.time}</div>
                </div>
              ))
          }
        </div>
      </div>
    </>
  );
};

// ── STUDENTS PAGE ──────────────────────────────────────────────────────────────
const StudentsPage = ({ token }) => {
  const { data: students, loading } = useDashboardData("students", token);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const filtered = (students || []).filter(s => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <>
      <PageHeader title="Students" subtitle={`${(students || []).length} total students registered`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Students" value={(students || []).length} icon="👥" color="#6ee7f7" loading={loading} />
        <StatCard label="Active" value={(students || []).filter(s => s.status === "active").length} icon="✅" color="#34d399" loading={loading} />
        <StatCard label="Inactive" value={(students || []).filter(s => s.status === "inactive").length} icon="⏸️" color="#f87171" loading={loading} />
      </div>

      <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)", border: "1px solid #2a2f42", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["all", "active", "inactive"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "7px 16px", borderRadius: 8, border: "1px solid",
                borderColor: filter === f ? "#6ee7f7" : "#2a2f42",
                background: filter === f ? "#0a2a3a" : "transparent",
                color: filter === f ? "#6ee7f7" : "#6b7280",
                fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search by name or email..."
            style={{
              background: "#0d1117", border: "1px solid #2a2f42", borderRadius: 8,
              padding: "9px 16px", color: "#e2e8f0", fontSize: 13, outline: "none",
              width: 260, fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 100px", gap: 12, padding: "8px 16px", marginBottom: 4 }}>
          {["Name", "Email", "Status", "Progress", "Joined"].map(h => (
            <span key={h} style={{ color: "#4b5563", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading ? [1,2,3,4,5].map(i => (
          <div key={i} style={{ padding: "14px 16px", marginBottom: 4 }}>
            <Skeleton h={16} mb={6} /><Skeleton h={12} w="50%" />
          </div>
        )) : filtered.length === 0
          ? <div style={{ color: "#4b5563", fontSize: 14, textAlign: "center", padding: "50px 0" }}>
              {search ? "No students match your search" : "No students yet"}
            </div>
          : filtered.map(s => (
              <div key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 100px",
                  gap: 12, padding: "14px 16px", borderRadius: 10, marginBottom: 2,
                  cursor: "pointer", transition: "background 0.15s",
                  background: selected?.id === s.id ? "#1e2a4a" : "transparent",
                  border: selected?.id === s.id ? "1px solid #2a3f6a" : "1px solid transparent",
                }}
                onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.background = "#1a1f2e"; }}
                onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#0d1117", fontWeight: 700, fontSize: 13,
                  }}>{s.full_name?.[0]?.toUpperCase() || "?"}</div>
                  <div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{s.full_name}</div>
                    <div style={{ color: "#4b5563", fontSize: 11, marginTop: 1 }}>{s.courseCount} course{s.courseCount !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13, alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
                <div style={{ alignSelf: "center" }}>
                  <span style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                    background: s.status === "active" ? "#0a2e1a" : "#2a1a1a",
                    color: s.status === "active" ? "#34d399" : "#f87171",
                    border: `1px solid ${s.status === "active" ? "#34d39933" : "#f8717133"}`,
                  }}>{s.status}</span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.avgProgress >= 70 ? "#34d399" : s.avgProgress >= 40 ? "#fb923c" : "#f87171" }}>
                    {s.avgProgress}%
                  </div>
                  <div style={{ height: 3, background: "#1e2336", borderRadius: 2, marginTop: 4, width: 60 }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${s.avgProgress}%`, background: s.avgProgress >= 70 ? "#34d399" : s.avgProgress >= 40 ? "#fb923c" : "#f87171" }} />
                  </div>
                </div>
                <div style={{ color: "#6b7280", fontSize: 12, alignSelf: "center" }}>{s.joined}</div>
              </div>
            ))
        }

        {selected && (
          <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: "#0d1117", border: "1px solid #2a3f6a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18 }}>{selected.full_name}</div>
                <div style={{ color: "#4b5563", fontSize: 13, marginTop: 4 }}>{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#4b5563", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "XP Points", value: selected.xp ?? 0, icon: "⚡" },
                { label: "Level", value: selected.level ?? 1, icon: "🎯" },
                { label: "Streak", value: `${selected.streak_days ?? 0} days`, icon: "🔥" },
              ].map(item => (
                <div key={item.label} style={{ background: "#1a1f2e", borderRadius: 10, padding: "12px 16px", border: "1px solid #2a2f42" }}>
                  <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 6 }}>{item.icon} {item.label}</div>
                  <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{item.value}</div>
                </div>
              ))}
            </div>
            {selected.enrollments?.length > 0 && (
              <div>
                <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Enrolled Courses</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.enrollments.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#1a1f2e", borderRadius: 8, border: "1px solid #2a2f42" }}>
                      <span style={{ color: "#e2e8f0", fontSize: 13 }}>{e.courses?.title || "Unknown course"}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ height: 4, width: 80, background: "#2a2f42", borderRadius: 2 }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${e.progress}%`, background: "#6ee7f7" }} />
                        </div>
                        <span style={{ color: "#6ee7f7", fontSize: 12, fontWeight: 600, minWidth: 32 }}>{e.progress}%</span>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 20,
                          background: e.status === "active" ? "#0a2e1a" : "#1a2a0a",
                          color: e.status === "active" ? "#34d399" : "#86efac",
                        }}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ── COURSES PAGE ───────────────────────────────────────────────────────────────
const CoursesPage = ({ token }) => {
  const { data: courses, loading } = useDashboardData("featured-courses", token);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const categories = ["all", ...new Set((courses || []).map(c => c.category).filter(Boolean))];
  const filtered = (courses || []).filter(c => {
    const matchSearch = c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.category?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.category === filter;
    return matchSearch && matchFilter;
  });

  const totalStudents = (courses || []).reduce((sum, c) => sum + (c.students || 0), 0);
  const totalLessons = (courses || []).reduce((sum, c) => sum + (c.lessons || 0), 0);

  return (
    <>
      <PageHeader title="Featured Courses" subtitle={`${(courses || []).length} platform courses available`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Courses" value={(courses || []).length} icon="📚" color="#a78bfa" loading={loading} />
        <StatCard label="Total Students" value={totalStudents} icon="👥" color="#6ee7f7" loading={loading} />
        <StatCard label="Total Lessons" value={totalLessons} icon="🎓" color="#34d399" loading={loading} />
      </div>

      <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #141824 100%)", border: "1px solid #2a2f42", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "7px 16px", borderRadius: 8, border: "1px solid",
                borderColor: filter === f ? "#a78bfa" : "#2a2f42",
                background: filter === f ? "#1a1040" : "transparent",
                color: filter === f ? "#a78bfa" : "#6b7280",
                fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search by title or category..."
            style={{
              background: "#0d1117", border: "1px solid #2a2f42", borderRadius: 8,
              padding: "9px 16px", color: "#e2e8f0", fontSize: 13, outline: "none",
              width: 260, fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1fr 80px 80px 80px", gap: 12, padding: "8px 16px", marginBottom: 4 }}>
          {["Title", "Category", "Level", "Lessons", "Students", "Duration"].map(h => (
            <span key={h} style={{ color: "#4b5563", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {loading ? [1,2,3,4,5].map(i => (
          <div key={i} style={{ padding: "14px 16px", marginBottom: 4 }}>
            <Skeleton h={16} mb={6} /><Skeleton h={12} w="50%" />
          </div>
        )) : filtered.length === 0
          ? <div style={{ color: "#4b5563", fontSize: 14, textAlign: "center", padding: "50px 0" }}>
              {search ? "No courses match your search" : "No courses yet"}
            </div>
          : filtered.map(c => {
              const lvl = LEVEL_COLORS[c.level?.toLowerCase()] || LEVEL_COLORS.beginner;
              return (
                <div key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  style={{
                    display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1fr 80px 80px 80px",
                    gap: 12, padding: "14px 16px", borderRadius: 10, marginBottom: 2,
                    cursor: "pointer", transition: "background 0.15s",
                    background: selected?.id === c.id ? "#1e1a40" : "transparent",
                    border: selected?.id === c.id ? "1px solid #3a2f6a" : "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (selected?.id !== c.id) e.currentTarget.style.background = "#1a1f2e"; }}
                  onMouseLeave={e => { if (selected?.id !== c.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: "linear-gradient(135deg, #a78bfa, #6ee7f7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#0d1117", fontWeight: 700, fontSize: 13,
                    }}>{c.title?.[0]?.toUpperCase() || "?"}</div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 13, alignSelf: "center", textTransform: "capitalize" }}>{c.category || "—"}</div>
                  <div style={{ alignSelf: "center" }}>
                    <span style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
                      background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}`,
                      textTransform: "capitalize",
                    }}>{c.level || "—"}</span>
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 13, alignSelf: "center" }}>{c.lessons ?? "—"}</div>
                  <div style={{ color: "#6ee7f7", fontSize: 13, fontWeight: 600, alignSelf: "center" }}>{c.students ?? 0}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, alignSelf: "center" }}>{c.duration || "—"}</div>
                </div>
              );
            })
        }

        {selected && (
          <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: "#0d1117", border: "1px solid #3a2f6a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ color: "#f1f5f9", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18 }}>{selected.title}</div>
                <div style={{ color: "#4b5563", fontSize: 13, marginTop: 4, textTransform: "capitalize" }}>{selected.category} · {selected.level}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#4b5563", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "Lessons", value: selected.lessons ?? 0, icon: "📖" },
                { label: "Students", value: selected.students ?? 0, icon: "👥" },
                { label: "Duration", value: selected.duration || "—", icon: "⏱️" },
              ].map(item => (
                <div key={item.label} style={{ background: "#1a1f2e", borderRadius: 10, padding: "12px 16px", border: "1px solid #2a2f42" }}>
                  <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 6 }}>{item.icon} {item.label}</div>
                  <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ── ANALYTICS PAGE ─────────────────────────────────────────────────────────────
const AnalyticsPage = ({ token }) => {
  const { data: analytics, loading } = useDashboardData("analytics", token);

  const completionRate = analytics?.completionRate ?? 0;
  const ringColor = completionRate >= 70 ? "#34d399" : completionRate >= 40 ? "#fb923c" : "#f87171";

  return (
    <>
      <PageHeader title="Analytics" subtitle="Platform performance and student engagement insights" />

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Enrollments" value={analytics?.totalEnrollments ?? "—"} icon="📖" color="#6ee7f7" loading={loading} />
        <StatCard label="Completed" value={analytics?.completedEnrollments ?? "—"} icon="🏅" color="#34d399" loading={loading} />
        <StatCard label="Completion Rate" value={analytics ? `${completionRate}%` : "—"} icon="🎯" color="#a78bfa" loading={loading} />
      </div>

      {/* Top row: bar chart + category pie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>

        {/* Top courses bar chart */}
        <ChartCard title="Top Courses by Enrollment" subtitle="Number of students enrolled per course" loading={loading}>
          {analytics?.topCourses?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.topCourses} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" horizontal={false} />
                <XAxis type="number" stroke="#4b5563" tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#4b5563" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2a2f42", borderRadius: 8, color: "#f1f5f9" }} />
                <Bar dataKey="students" fill="#a78bfa" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "60px 0" }}>No data yet</div>}
        </ChartCard>

        {/* Category breakdown pie */}
        <ChartCard title="By Category" subtitle="Enrollment distribution across categories" loading={loading}>
          {analytics?.categoryBreakdown?.length > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <PieChart width={160} height={160}>
                  <Pie data={analytics.categoryBreakdown} cx={75} cy={75} innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {analytics.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {analytics.categoryBreakdown.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: "#9ca3af", fontSize: 12, textTransform: "capitalize" }}>{item.name}</span>
                    </div>
                    <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", marginTop: 60 }}>No data yet</div>}
        </ChartCard>
      </div>

      {/* Bottom row: progress distribution + completion ring */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>

        {/* Progress distribution bar chart */}
        <ChartCard title="Progress Distribution" subtitle="How far along students are in their courses" loading={loading}>
          {analytics?.progressDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.progressDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" vertical={false} />
                <XAxis dataKey="range" stroke="#4b5563" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                <YAxis stroke="#4b5563" tick={{ fontSize: 12, fill: "#4b5563" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2a2f42", borderRadius: 8, color: "#f1f5f9" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(analytics.progressDistribution || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", padding: "60px 0" }}>No data yet</div>}
        </ChartCard>

        {/* Completion rate ring */}
        <ChartCard title="Completion Rate" subtitle="Percentage of enrollments marked as completed" loading={loading}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 0" }}>
            <div style={{ position: "relative", width: 140, height: 140 }}>
              <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="70" cy="70" r="54" fill="none" stroke="#1e2336" strokeWidth="12" />
                <circle cx="70" cy="70" r="54" fill="none" stroke={ringColor} strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - completionRate / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}>
                <div style={{ color: ringColor, fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                  {completionRate}%
                </div>
                <div style={{ color: "#4b5563", fontSize: 11, marginTop: 4 }}>completed</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#34d399", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{analytics?.completedEnrollments ?? 0}</div>
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>Completed</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#6ee7f7", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                  {(analytics?.totalEnrollments ?? 0) - (analytics?.completedEnrollments ?? 0)}
                </div>
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>In Progress</div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </>
  );
};

// ── SETTINGS PAGE ──────────────────────────────────────────────────────────────
const SettingsPage = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [emailReports, setEmailReports] = useState(false);
  const [activityAlerts, setActivityAlerts] = useState(true);
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetPassword = async () => {
    setResetLoading(true);
    setResetMsg("");
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResetMsg("✅ Reset email sent! Check your inbox.");
    } catch {
      setResetMsg("❌ Failed to send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and platform preferences" />

      <SettingsSection title="👤 Admin Profile">
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 20, borderBottom: "1px solid #1e2336", marginBottom: 8 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, #a78bfa, #6ee7f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0d1117", fontWeight: 800, fontSize: 24,
          }}>{user?.email?.[0]?.toUpperCase() || "A"}</div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16, fontFamily: "'Syne', sans-serif" }}>{user?.full_name || "Admin"}</div>
            <div style={{ color: "#4b5563", fontSize: 13, marginTop: 4 }}>{user?.email}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "#0a2e1a", color: "#34d399", border: "1px solid #34d39933" }}>Admin</span>
            </div>
          </div>
        </div>
        <SettingsRow
          icon="🔑" label="Change Password" subtitle="Send a password reset link to your email"
          action={
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <button onClick={handleResetPassword} disabled={resetLoading} style={{
                padding: "8px 16px", borderRadius: 8,
                background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
                border: "none", color: "#0d1117", fontWeight: 600, fontSize: 13,
                cursor: resetLoading ? "not-allowed" : "pointer",
                opacity: resetLoading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif",
              }}>{resetLoading ? "Sending..." : "Send Reset Link"}</button>
              {resetMsg && <div style={{ fontSize: 12, color: resetMsg.startsWith("✅") ? "#34d399" : "#f87171" }}>{resetMsg}</div>}
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="🔔 Notifications">
        <SettingsRow icon="📧" label="Email Notifications" subtitle="Receive email alerts for important events" action={<Toggle value={notifications} onChange={setNotifications} />} />
        <SettingsRow icon="📊" label="Weekly Reports" subtitle="Get a weekly summary of platform activity" action={<Toggle value={emailReports} onChange={setEmailReports} />} />
        <SettingsRow icon="⚡" label="Activity Alerts" subtitle="Get notified when students enroll or complete courses" action={<Toggle value={activityAlerts} onChange={setActivityAlerts} />} />
      </SettingsSection>

      <SettingsSection title="🌐 Platform Info">
        {[
          { icon: "📱", label: "App Name", value: "AI Study" },
          { icon: "🏷️", label: "Version", value: "1.0.0 — Demo" },
          { icon: "🎓", label: "Course", value: "ISS396 Junior Project" },
          { icon: "🔗", label: "Repository", value: "github.com/mayssgh/ai-study-platform" },
        ].map(item => (
          <SettingsRow key={item.label} icon={item.icon} label={item.label} action={<span style={{ color: "#6b7280", fontSize: 13 }}>{item.value}</span>} />
        ))}
      </SettingsSection>

      <SettingsSection title="⚠️ Session">
        <SettingsRow
          icon="🚪" label="Sign Out" subtitle="Sign out of the admin portal"
          action={
            <button onClick={() => { onLogout(); navigate("/login"); }} style={{
              padding: "8px 16px", borderRadius: 8, background: "transparent",
              border: "1px solid #f8717133", color: "#f87171", fontWeight: 600,
              fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Sign Out</button>
          }
        />
      </SettingsSection>
    </>
  );
};

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("dashboard");

  const handleLogout = () => { logout(); navigate("/login"); };

  const renderPage = () => {
    switch (activeNav) {
      case "dashboard": return <DashboardPage token={token} />;
      case "students":  return <StudentsPage token={token} />;
      case "courses":   return <CoursesPage token={token} />;
      case "analytics": return <AnalyticsPage token={token} />;
      case "settings":  return <SettingsPage user={user} onLogout={handleLogout} />;
      default:          return <DashboardPage token={token} />;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #2a2f42; border-radius: 3px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#0d1117", fontFamily: "'DM Sans', sans-serif" }}>
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} user={user} onLogout={handleLogout} />
        <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", overflowY: "auto" }}>
          {renderPage()}
        </main>
      </div>
    </>
  );
}