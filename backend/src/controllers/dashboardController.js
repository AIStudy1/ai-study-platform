import supabase from "../config/supabaseClient.js";

/**
 * GET /api/dashboard/stats
 */
export const getStats = async (req, res) => {
  try {
    const [
      { count: totalStudents },
      { count: totalCourses },
      { count: activeEnrollments },
      { count: completedEnrollments },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("courses").select("*", { count: "exact", head: true }),
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    const { data: progressData } = await supabase
      .from("enrollments")
      .select("progress");

    const avgProgress = progressData && progressData.length > 0
      ? Math.round(progressData.reduce((sum, e) => sum + (e.progress || 0), 0) / progressData.length)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalStudents: totalStudents || 0,
        totalCourses: totalCourses || 0,
        activeEnrollments: activeEnrollments || 0,
        completedEnrollments: completedEnrollments || 0,
        avgProgress,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dashboard/students
 */
export const getStudents = async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from("users")
      .select(`
        id,
        full_name,
        email,
        created_at,
        xp,
        level,
        streak_days,
        enrollments (
          status,
          progress,
          course_id,
          courses (title)
        )
      `)
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      xp: s.xp || 0,
      level: s.level || 1,
      streak_days: s.streak_days || 0,
      joined: new Date(s.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      enrollments: s.enrollments || [],
      courseCount: s.enrollments?.length || 0,
      avgProgress: s.enrollments?.length > 0
        ? Math.round(s.enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / s.enrollments.length)
        : 0,
      status: s.enrollments?.some(e => e.status === "active") ? "active" : "inactive",
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dashboard/course-distribution
 */
export const getCourseDistribution = async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from("courses")
      .select(`
        id,
        title,
        enrollments (id)
      `);

    if (error) throw error;

    const distribution = courses.map((c) => ({
      name: c.title,
      value: c.enrollments?.length || 0,
    })).filter(c => c.value > 0);

    return res.status(200).json({ success: true, data: distribution });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dashboard/weekly-signups
 */
export const getWeeklySignups = async (req, res) => {
  try {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const start = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { count } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "student")
        .gte("created_at", start)
        .lte("created_at", end);

      result.push({ day: days[new Date(start).getDay()], signups: count || 0 });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dashboard/recent-activity
 */
export const getRecentActivity = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        status,
        progress,
        enrolled_at,
        users (full_name, email),
        courses (title)
      `)
      .order("enrolled_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const formatted = data.map((e) => ({
      user: e.users?.full_name || "Unknown",
      action: e.progress === 100 ? "Completed course" : e.status === "active" ? "Enrolled in course" : "Started course",
      course: e.courses?.title || "Unknown",
      time: timeAgo(e.enrolled_at),
      type: e.progress === 100 ? "badge" : "session",
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
export const getFeaturedCourses = async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from("courses")
      .select(`id, title, description, category, level, lessons, duration, created_at, enrollments (id)`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = (courses || []).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category || "General",
      level: c.level || "beginner",
      lessons: c.lessons || 0,
      duration: c.duration || null,
      students: c.enrollments?.length || 0,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};