import supabase from "../config/supabaseClient.js";

// ─── Badge definitions ────────────────────────────────────────────────────────
const BADGES = [
  { id: "first_login",       name: "Welcome!",          icon: "👋", description: "Logged in for the first time",          xp_reward: 10  },
  { id: "first_quiz",        name: "Quiz Starter",      icon: "📝", description: "Completed your first quiz",             xp_reward: 20  },
  { id: "first_pass",        name: "Passing Grade",     icon: "✅", description: "Passed your first quiz",               xp_reward: 50  },
  { id: "streak_3",          name: "On Fire",           icon: "🔥", description: "3-day login streak",                   xp_reward: 30  },
  { id: "streak_7",          name: "Week Warrior",      icon: "⚡", description: "7-day login streak",                   xp_reward: 100 },
  { id: "streak_30",         name: "Unstoppable",       icon: "🏆", description: "30-day login streak",                  xp_reward: 500 },
  { id: "first_course",      name: "Course Creator",    icon: "🎓", description: "Created your first AI course",         xp_reward: 30  },
  { id: "course_complete",   name: "Graduate",          icon: "🎯", description: "Completed all chapters in a course",   xp_reward: 200 },
  { id: "quiz_perfect",      name: "Perfectionist",     icon: "💯", description: "Scored 100% on a quiz",               xp_reward: 100 },
  { id: "level_5",           name: "Rising Star",       icon: "⭐", description: "Reached level 5",                     xp_reward: 100 },
  { id: "level_10",          name: "Scholar",           icon: "🦉", description: "Reached level 10",                    xp_reward: 250 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function awardXP(userId, amount) {
  const { data: user } = await supabase
    .from("users")
    .select("xp, level")
    .eq("id", userId)
    .single();
  if (!user) return;
  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 1000) + 1;
  await supabase.from("users").update({ xp: newXP, level: newLevel }).eq("id", userId);
  return { newXP, newLevel };
}

async function getUserBadgeIds(userId) {
  const { data } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  return (data || []).map((b) => b.badge_id);
}

async function awardBadge(userId, badgeId) {
  const badge = BADGES.find((b) => b.id === badgeId);
  if (!badge) return null;

  // Check if already earned
  const { data: existing } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", badgeId)
    .single();

  if (existing) return null; // already have it

  await supabase.from("user_badges").insert({ user_id: userId, badge_id: badgeId });
  await awardXP(userId, badge.xp_reward);
  await supabase.from("activity_logs").insert({
    user_id: userId,
    type: "badge_earned",
    description: `Badge unlocked: ${badge.icon} ${badge.name}`,
  });

  return badge;
}

// ─── Main check function (called after every action) ─────────────────────────

export async function checkAndAwardBadges(userId, context = {}) {
  const earned = [];
  const existingIds = await getUserBadgeIds(userId);

  const { data: user } = await supabase
    .from("users")
    .select("xp, level, streak_days")
    .eq("id", userId)
    .single();

  if (!user) return earned;

  // First login
  if (!existingIds.includes("first_login")) {
    const b = await awardBadge(userId, "first_login");
    if (b) earned.push(b);
  }

  // Streak badges
  const streak = user.streak_days || 0;
  if (streak >= 3  && !existingIds.includes("streak_3"))  { const b = await awardBadge(userId, "streak_3");  if (b) earned.push(b); }
  if (streak >= 7  && !existingIds.includes("streak_7"))  { const b = await awardBadge(userId, "streak_7");  if (b) earned.push(b); }
  if (streak >= 30 && !existingIds.includes("streak_30")) { const b = await awardBadge(userId, "streak_30"); if (b) earned.push(b); }

  // Level badges
  const level = user.level || 1;
  if (level >= 5  && !existingIds.includes("level_5"))  { const b = await awardBadge(userId, "level_5");  if (b) earned.push(b); }
  if (level >= 10 && !existingIds.includes("level_10")) { const b = await awardBadge(userId, "level_10"); if (b) earned.push(b); }

  // Context-based badges
  if (context.quizCompleted && !existingIds.includes("first_quiz")) {
    const b = await awardBadge(userId, "first_quiz");
    if (b) earned.push(b);
  }
  if (context.quizPassed && !existingIds.includes("first_pass")) {
    const b = await awardBadge(userId, "first_pass");
    if (b) earned.push(b);
  }
  if (context.quizScore === 100 && !existingIds.includes("quiz_perfect")) {
    const b = await awardBadge(userId, "quiz_perfect");
    if (b) earned.push(b);
  }
  if (context.courseCreated && !existingIds.includes("first_course")) {
    const b = await awardBadge(userId, "first_course");
    if (b) earned.push(b);
  }
  if (context.courseCompleted && !existingIds.includes("course_complete")) {
    const b = await awardBadge(userId, "course_complete");
    if (b) earned.push(b);
  }

  return earned;
}

// ─── Streak logic (called on login) ──────────────────────────────────────────

export async function updateLoginStreak(userId) {
  const { data: user } = await supabase
    .from("users")
    .select("streak_days, last_login_date")
    .eq("id", userId)
    .single();

  if (!user) return;

  const today = new Date().toDateString();
  const lastLogin = user.last_login_date
    ? new Date(user.last_login_date).toDateString()
    : null;

  if (lastLogin === today) return; // already logged in today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastLogin === yesterday.toDateString();

  const newStreak = wasYesterday ? (user.streak_days || 0) + 1 : 1;

  await supabase
    .from("users")
    .update({ streak_days: newStreak, last_login_date: new Date().toISOString() })
    .eq("id", userId);

  return newStreak;
}

// ─── GET /api/rewards/badges ──────────────────────────────────────────────────

export const getUserBadges = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_id, earned_at")
      .eq("user_id", req.user.id)
      .order("earned_at", { ascending: false });

    if (error) throw error;

    const earnedIds = (data || []).map((b) => b.badge_id);

    const allBadges = BADGES.map((badge) => {
      const earned = data?.find((b) => b.badge_id === badge.id);
      return {
        ...badge,
        earned: !!earned,
        earned_at: earned?.earned_at || null,
      };
    });

    return res.status(200).json({ success: true, data: allBadges });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/rewards/leaderboard ────────────────────────────────────────────

export const getLeaderboard = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, xp, level, streak_days, avatar_url")
      .eq("role", "student")
      .order("xp", { ascending: false })
      .limit(20);

    if (error) throw error;

    const leaderboard = (data || []).map((u, index) => ({
      rank: index + 1,
      id: u.id,
      full_name: u.full_name,
      xp: u.xp || 0,
      level: u.level || 1,
      streak_days: u.streak_days || 0,
      avatar_url: u.avatar_url,
      isMe: u.id === req.user.id,
    }));

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};