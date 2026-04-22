import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";

// ─── League config ────────────────────────────────────────────────────────────
const LEAGUES = [
  { tier: "bronze",   label: "Bronze",   emoji: "🥉", minXP: 0,    color: "#cd7f32" },
  { tier: "silver",   label: "Silver",   emoji: "🥈", minXP: 100,  color: "#9ca3af" },
  { tier: "gold",     label: "Gold",     emoji: "🥇", minXP: 300,  color: "#eab308" },
  { tier: "diamond",  label: "Diamond",  emoji: "💎", minXP: 600,  color: "#3b82f6" },
  { tier: "legend",   label: "Legend",   emoji: "👑", minXP: 1000, color: "#8b5cf6" },
];

export function getTierForXP(weeklyXP) {
  let tier = LEAGUES[0];
  for (const l of LEAGUES) {
    if (weeklyXP >= l.minXP) tier = l;
  }
  return tier;
}

// ─── GET /api/streaks ─────────────────────────────────────────────────────────
export const getStreak = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: user, error: userErr } = await db
      .from("users")
      .select("id, streak_days, longest_streak, streak_freeze_count, streak_shield_active, weekly_xp, league_tier, last_streak_date")
      .eq("id", req.user.id)
      .single();
    if (userErr) throw userErr;

    // Last 7 days of streak activity for calendar dots
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const { data: recentDays } = await db
      .from("streaks")
      .select("date, activity_type, xp_earned")
      .eq("user_id", req.user.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    const tierInfo = getTierForXP(user.weekly_xp || 0);
    const nextTier = LEAGUES[LEAGUES.findIndex(l => l.tier === tierInfo.tier) + 1] || null;

    return res.status(200).json({
      success: true,
      data: {
        currentStreak:      user.streak_days || 0,
        longestStreak:      user.longest_streak || 0,
        freezeCount:        user.streak_freeze_count || 0,
        shieldActive:       user.streak_shield_active || false,
        weeklyXP:           user.weekly_xp || 0,
        leagueTier:         tierInfo,
        nextLeagueTier:     nextTier,
        lastStudyDate:      user.last_streak_date,
        recentDays:         recentDays || [],
        leagueXPToNext:     nextTier ? nextTier.minXP - (user.weekly_xp || 0) : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/streaks/record ─────────────────────────────────────────────────
// Called after: chapter complete, quiz pass, flashcard review session
export const recordStudyActivity = async (req, res) => {
  try {
    const { activityType = "chapter", xpEarned = 0 } = req.body;
    const db = getAuthedSupabaseClient(req.accessToken);

    const todayStr = new Date().toISOString().split("T")[0];

    // Upsert today's streak row (idempotent — only counts once per day)
    const { error: streakErr } = await db
      .from("streaks")
      .upsert(
        { user_id: req.user.id, date: todayStr, activity_type: activityType, xp_earned: xpEarned },
        { onConflict: "user_id,date", ignoreDuplicates: false }
      );
    if (streakErr) throw streakErr;

    // Fetch current user state
    const { data: user, error: userErr } = await db
      .from("users")
      .select("streak_days, longest_streak, last_streak_date, streak_freeze_count, streak_shield_active, weekly_xp")
      .eq("id", req.user.id)
      .single();
    if (userErr) throw userErr;

    const lastDate = user.last_streak_date ? new Date(user.last_streak_date) : null;
    const today = new Date(todayStr);

    let newStreak = user.streak_days || 0;
    let newLongest = user.longest_streak || 0;
    let streakBroken = false;

    if (!lastDate) {
      // First ever study day
      newStreak = 1;
    } else {
      const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already studied today — no change to streak count
      } else if (diffDays === 1) {
        // Consecutive day
        newStreak = newStreak + 1;
        // Award shield after 7-day streak
        if (newStreak % 7 === 0) {
          await db
            .from("users")
            .update({ streak_shield_active: true })
            .eq("id", req.user.id);
        }
      } else if (diffDays === 2 && (user.streak_shield_active || user.streak_freeze_count > 0)) {
        // Missed 1 day but shield/freeze absorbs it
        if (user.streak_shield_active) {
          await db
            .from("users")
            .update({ streak_shield_active: false })
            .eq("id", req.user.id);
        } else {
          await db
            .from("users")
            .update({ streak_freeze_count: Math.max(0, user.streak_freeze_count - 1) })
            .eq("id", req.user.id);
        }
        newStreak = newStreak + 1;
      } else {
        // Streak broken
        newStreak = 1;
        streakBroken = true;
      }
    }

    newLongest = Math.max(newLongest, newStreak);

    // Update weekly XP + league tier
    const newWeeklyXP = (user.weekly_xp || 0) + xpEarned;
    const newTier = getTierForXP(newWeeklyXP).tier;

    await db
      .from("users")
      .update({
        streak_days:     newStreak,
        longest_streak:  newLongest,
        last_streak_date: todayStr,
        weekly_xp:       newWeeklyXP,
        league_tier:     newTier,
      })
      .eq("id", req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        newStreak,
        longestStreak: newLongest,
        streakBroken,
        weeklyXP: newWeeklyXP,
        leagueTier: getTierForXP(newWeeklyXP),
        shieldEarned: newStreak % 7 === 0 && newStreak > 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/streaks/freeze ─────────────────────────────────────────────────
// Spend 50 XP to add a streak freeze
export const buyStreakFreeze = async (req, res) => {
  try {
    const FREEZE_COST = 50;
    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: user, error } = await db
      .from("users")
      .select("xp, streak_freeze_count")
      .eq("id", req.user.id)
      .single();
    if (error) throw error;

    if ((user.xp || 0) < FREEZE_COST) {
      return res.status(400).json({ success: false, message: `Need ${FREEZE_COST} XP to buy a streak freeze.` });
    }
    if ((user.streak_freeze_count || 0) >= 3) {
      return res.status(400).json({ success: false, message: "You already have the maximum 3 freezes." });
    }

    await db
      .from("users")
      .update({
        xp: user.xp - FREEZE_COST,
        streak_freeze_count: (user.streak_freeze_count || 0) + 1,
      })
      .eq("id", req.user.id);

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "streak_freeze_bought",
      description: `Bought streak freeze (-${FREEZE_COST} XP) ❄️`,
    });

    return res.status(200).json({
      success: true,
      data: { freezeCount: (user.streak_freeze_count || 0) + 1, xpSpent: FREEZE_COST },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/streaks/leaderboard ────────────────────────────────────────────
// type: 'global' | 'friends'  period: 'weekly' | 'alltime'
export const getLeaderboard = async (req, res) => {
  try {
    const { type = "global", period = "weekly" } = req.query;
    const db = getAuthedSupabaseClient(req.accessToken);

    let rows = [];

    if (type === "global") {
      const xpCol = period === "weekly" ? "weekly_xp" : "xp";
      const { data, error } = await supabase
        .from("users")
        .select(`id, full_name, username, avatar_url, xp, weekly_xp, level, league_tier, streak_days`)
        .order(xpCol, { ascending: false })
        .limit(100);
      if (error) throw error;
      rows = data || [];
    } else {
      // Friends leaderboard — fetch accepted friends + self
      const { data: friendRows } = await db
        .from("friends")
        .select("friend_id, user_id")
        .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`)
        .eq("status", "accepted");

      const friendIds = new Set([req.user.id]);
      (friendRows || []).forEach((f) => {
        friendIds.add(f.user_id === req.user.id ? f.friend_id : f.user_id);
      });

      const xpCol = period === "weekly" ? "weekly_xp" : "xp";
      const { data, error } = await supabase
        .from("users")
        .select(`id, full_name, username, avatar_url, xp, weekly_xp, level, league_tier, streak_days`)
        .in("id", [...friendIds])
        .order(xpCol, { ascending: false });
      if (error) throw error;
      rows = data || [];
    }

    // Attach rank + tier info + flag current user
    const xpField = period === "weekly" ? "weekly_xp" : "xp";
    const ranked = rows.map((u, i) => ({
      rank:        i + 1,
      id:          u.id,
      fullName:    u.full_name || "Student",
      username:    u.username  || null,
      avatarUrl:   u.avatar_url || null,
      xp:          u.xp || 0,
      weeklyXP:    u.weekly_xp || 0,
      displayXP:   u[xpField] || 0,
      level:       u.level || 1,
      streakDays:  u.streak_days || 0,
      leagueTier:  getTierForXP(u.weekly_xp || 0),
      isMe:        u.id === req.user.id,
    }));

    const myEntry = ranked.find((r) => r.isMe);

    return res.status(200).json({
      success: true,
      data: { board: ranked, myRank: myEntry?.rank || null, myEntry },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/streaks/weekly-reset ──────────────────────────────────────────
// Called by a cron job every Monday. Snapshots league history + resets weekly_xp.
export const weeklyReset = async (req, res) => {
  // Simple auth check — only callable with service role or a secret header
  const secret = req.headers["x-reset-secret"];
  if (secret !== process.env.WEEKLY_RESET_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // last Monday
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data: allUsers } = await supabase
      .from("users")
      .select("id, weekly_xp, league_tier")
      .order("weekly_xp", { ascending: false });

    if (!allUsers) return res.status(200).json({ success: true, message: "No users" });

    const total = allUsers.length;
    const historyRows = allUsers.map((u, i) => {
      const rank = i + 1;
      const pct = rank / total;
      const promoted = pct <= 0.33;
      const demoted  = pct > 0.66;
      const currentIdx = LEAGUES.findIndex(l => l.tier === u.league_tier);
      let newTier = u.league_tier;
      if (promoted && currentIdx < LEAGUES.length - 1) newTier = LEAGUES[currentIdx + 1].tier;
      if (demoted  && currentIdx > 0)                  newTier = LEAGUES[currentIdx - 1].tier;
      return {
        user_id:      u.id,
        week_start:   weekStartStr,
        xp_earned:    u.weekly_xp || 0,
        league_tier:  u.league_tier,
        rank_position: rank,
        promoted,
        demoted,
        _newTier: newTier,
      };
    });

    // Insert league history
    await supabase.from("league_history").upsert(
      historyRows.map(({ _newTier, ...r }) => r),
      { onConflict: "user_id,week_start" }
    );

    // Reset weekly_xp + update tiers
    for (const row of historyRows) {
      await supabase
        .from("users")
        .update({ weekly_xp: 0, league_tier: row._newTier })
        .eq("id", row.user_id);
    }

    return res.status(200).json({ success: true, message: `Reset ${total} users` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
