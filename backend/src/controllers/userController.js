import supabase from "../config/supabaseClient.js";

/**
 * GET /api/user/profile
 * Get the logged in user's profile
 */
export const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, xp, level, streak_days, study_hours, avatar_url, created_at")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/user/profile
 * Update the logged in user's profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { full_name, avatar_url } = req.body;

    const updates = {};
    if (full_name) updates.full_name = full_name.trim();
    if (avatar_url) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/user/goal
 * Get the logged in user's daily goal
 */
export const getGoal = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", req.user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return res.status(200).json({
      success: true,
      data: data || {
        user_id: req.user.id,
        goal_minutes: 30,
        studied_minutes: 0,
        last_reset: new Date().toISOString(),
        streak_days: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/user/goal
 * Update daily goal target minutes
 */
export const updateGoal = async (req, res) => {
  try {
    const { goal_minutes } = req.body;

    if (!goal_minutes || goal_minutes < 5 || goal_minutes > 480) {
      return res.status(400).json({
        success: false,
        message: "Goal must be between 5 and 480 minutes",
      });
    }

    // Upsert — create if not exists
    const { data, error } = await supabase
      .from("daily_goals")
      .upsert({
        user_id: req.user.id,
        goal_minutes,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Daily goal updated",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/user/goal/progress
 * Add studied minutes to today's goal
 */
export const addStudyProgress = async (req, res) => {
  try {
    const { minutes } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: "Minutes must be greater than 0",
      });
    }

    // Get current goal
    const { data: current } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", req.user.id)
      .single();

    const today = new Date().toDateString();
    const lastReset = current?.last_reset
      ? new Date(current.last_reset).toDateString()
      : null;

    // Reset if it's a new day
    let studied_minutes = current?.studied_minutes || 0;
    let streak_days = current?.streak_days || 0;

    if (lastReset !== today) {
      // Check if goal was reached yesterday to maintain streak
      if (current && current.studied_minutes >= current.goal_minutes) {
        streak_days += 1;

        // Award XP for streak
        await awardXP(req.user.id, 50);

        // Log activity
        await supabase.from("activity_logs").insert({
          user_id: req.user.id,
          type: "goal_reached",
          description: `Daily goal reached! 🎯 Day ${streak_days} streak`,
        });
      } else if (lastReset !== null) {
        // Streak broken
        streak_days = 0;
      }

      studied_minutes = 0;
    }

    studied_minutes += minutes;
    const goal_minutes = current?.goal_minutes || 30;
    const goalJustReached = studied_minutes >= goal_minutes &&
      (studied_minutes - minutes) < goal_minutes;

    const { data, error } = await supabase
      .from("daily_goals")
      .upsert({
        user_id: req.user.id,
        goal_minutes,
        studied_minutes,
        streak_days,
        last_reset: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update study hours on user profile
    await supabase.rpc("increment_study_hours", {
      user_id_input: req.user.id,
      minutes_input: minutes,
    });

    return res.status(200).json({
      success: true,
      message: goalJustReached ? "Daily goal reached! 🎯 +50 XP" : "Progress updated",
      data: {
        ...data,
        goal_reached: goalJustReached,
        percent: Math.min(Math.round((studied_minutes / goal_minutes) * 100), 100),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function awardXP(userId, amount) {
  const { data: user } = await supabase
    .from("users")
    .select("xp, level")
    .eq("id", userId)
    .single();

  if (!user) return;

  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 1000) + 1;

  await supabase
    .from("users")
    .update({ xp: newXP, level: newLevel })
    .eq("id", userId);
}