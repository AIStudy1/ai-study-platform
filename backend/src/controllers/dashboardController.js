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
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("Featured_courses").select("*", { count: "exact", head: true }),
      supabase.from("featured_enrollments").select("*", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const { data: uniqueEnrolled } = await supabase
      .from("featured_enrollments")
      .select("user_id");

    const uniqueStudentCount = new Set(uniqueEnrolled?.map(e => e.user_id) || []).size;

    const { data: progressData } = await supabase
      .from("featured_enrollments")
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
        uniqueEnrolledStudents: uniqueStudentCount,
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
        featured_enrollments (
          status,
          progress,
          featured_course_id,
          Featured_courses (title)
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
      enrollments: (s.featured_enrollments || []).map(e => ({
        status: e.status,
        progress: e.progress,
        courses: { title: e.Featured_courses?.title || "Unknown course" },
      })),
      courseCount: s.featured_enrollments?.length || 0,
      avgProgress: s.featured_enrollments?.length > 0
        ? Math.round(s.featured_enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / s.featured_enrollments.length)
        : 0,
      status: s.featured_enrollments?.some(e => e.status === "active") ? "active" : "inactive",
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/dashboard/featured-courses
 */
export const getFeaturedCourses = async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from("Featured_courses")
      .select("id, title, category, level, duration, lessons, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const coursesWithCounts = await Promise.all(courses.map(async (c) => {
      const { count } = await supabase
        .from("featured_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("featured_course_id", c.id);

      return { ...c, students: count || 0 };
    }));

    return res.status(200).json({ success: true, data: coursesWithCounts });
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
      .from("Featured_courses")
      .select("id, title")
      .order("title");

    if (error) throw error;

    const distribution = await Promise.all(courses.map(async (c) => {
      const { count } = await supabase
        .from("featured_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("featured_course_id", c.id);

      return { name: c.title, value: count || 0 };
    }));

    return res.status(200).json({
      success: true,
      data: distribution.filter(c => c.value > 0),
    });
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
      .from("featured_enrollments")
      .select(`
        id, status, progress, enrolled_at,
        users (full_name, email),
        Featured_courses (title)
      `)
      .order("enrolled_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const formatted = data.map((e) => ({
      user: e.users?.full_name || "Unknown",
      action: e.progress === 100 ? "Completed course" : e.status === "active" ? "Enrolled in course" : "Started course",
      course: e.Featured_courses?.title || "Unknown",
      time: timeAgo(e.enrolled_at),
      type: e.progress === 100 ? "badge" : "session",
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
/**
 * GET /api/dashboard/analytics
 */
export const getAnalytics = async (req, res) => {
  try {
    const { data: enrollments } = await supabase
      .from("featured_enrollments")
      .select("progress, status, featured_course_id, Featured_courses(title, category)");

    // Progress distribution
    const brackets = { "0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0 };
    enrollments?.forEach(e => {
      if (e.progress <= 25) brackets["0-25"]++;
      else if (e.progress <= 50) brackets["26-50"]++;
      else if (e.progress <= 75) brackets["51-75"]++;
      else brackets["76-100"]++;
    });
    const progressDistribution = Object.entries(brackets).map(([range, count]) => ({ range, count }));

    // Top courses by enrollment count
    const courseMap = {};
    enrollments?.forEach(e => {
      const title = e.Featured_courses?.title || "Unknown";
      courseMap[title] = (courseMap[title] || 0) + 1;
    });
    const topCourses = Object.entries(courseMap)
      .map(([name, students]) => ({ name, students }))
      .sort((a, b) => b.students - a.students);

    // Category breakdown
    const categoryMap = {};
    enrollments?.forEach(e => {
      const cat = e.Featured_courses?.category || "Other";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Completion rate
    const total = enrollments?.length || 0;
    const completed = enrollments?.filter(e => e.status === "completed").length || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: { progressDistribution, topCourses, categoryBreakdown, completionRate, totalEnrollments: total, completedEnrollments: completed },
    });
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