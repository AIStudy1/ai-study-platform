import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── SM-2 Spaced Repetition ───────────────────────────────────────────────────
// rating: 5=Easy, 4=Good, 2=Hard, 1=Again
function sm2(card, rating) {
  let { interval_days, ease_factor, total_reviews, correct_reviews } = card;
  ease_factor = parseFloat(ease_factor) || 2.5;

  if (rating >= 3) {
    // Correct
    if (total_reviews === 0)      interval_days = 1;
    else if (total_reviews === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);

    ease_factor = ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    correct_reviews += 1;
  } else {
    // Incorrect — reset
    interval_days = 1;
    ease_factor = ease_factor - 0.2;
  }

  ease_factor = Math.max(1.3, ease_factor);
  interval_days = Math.max(1, interval_days);
  total_reviews += 1;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval_days);

  return { interval_days, ease_factor, total_reviews, correct_reviews, next_review_at: nextReview.toISOString() };
}

function parseJSON(raw) {
  const clean = String(raw).replace(/```json|```/g, "").trim();
  const match = clean.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

// ─── POST /api/flashcards/generate ───────────────────────────────────────────
export const generateFlashcards = async (req, res) => {
  try {
    const { courseId, chapterId, chapterTitle, chapterContent } = req.body;
    if (!chapterContent) {
      return res.status(400).json({ success: false, message: "chapterContent is required" });
    }

    const db = getAuthedSupabaseClient(req.accessToken);

    // Check if flashcards already exist for this chapter
    const { data: existing } = await db
      .from("flashcards")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("chapter_id", chapterId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Return existing cards instead of regenerating
      const { data: cards } = await db
        .from("flashcards")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: true });
      return res.status(200).json({ success: true, data: cards, existing: true });
    }

    // Let AI decide count based on content length
    const wordCount = chapterContent.split(/\s+/).length;
    const cardHint = wordCount < 200 ? "5 to 7" : wordCount < 500 ? "8 to 10" : "11 to 15";
    const contentSnip = chapterContent.slice(0, 6000);

    const raw = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a flashcard designer. Create high-quality study flashcards.\n" +
            "Respond with a JSON array ONLY. No markdown, no extra text.\n" +
            "Choose the best format per card:\n" +
            "- 'qa': question on front, answer on back (for facts/concepts)\n" +
            "- 'term': term on front, definition + example on back\n" +
            "- 'concept': key idea on front, detailed explanation on back\n" +
            "Make each card self-contained and memorable.",
        },
        {
          role: "user",
          content:
            `Chapter: "${chapterTitle}"\n\n` +
            `Content:\n${contentSnip}\n\n` +
            `Generate ${cardHint} flashcards. JSON array format:\n` +
            `[\n` +
            `  {\n` +
            `    "front": "question or term",\n` +
            `    "back": "answer or definition + example",\n` +
            `    "card_type": "qa|term|concept"\n` +
            `  }\n` +
            `]`,
        },
      ],
    });

    const cards = parseJSON(raw.choices[0].message.content);

    const toInsert = cards.map((c) => ({
      user_id:    req.user.id,
      course_id:  courseId,
      chapter_id: chapterId,
      front:      String(c.front || "").trim(),
      back:       String(c.back  || "").trim(),
      card_type:  c.card_type || "qa",
    }));

    const { data: inserted, error: insertErr } = await db
      .from("flashcards")
      .insert(toInsert)
      .select();
    if (insertErr) throw insertErr;

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "flashcards_generated",
      description: `Generated ${inserted.length} flashcards for "${chapterTitle}" 🃏`,
    });

    return res.status(201).json({ success: true, data: inserted, existing: false });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/flashcards/due ──────────────────────────────────────────────────
export const getFlashcardsDue = async (req, res) => {
  try {
    const { courseId, limit = 20 } = req.query;
    const db = getAuthedSupabaseClient(req.accessToken);

    let query = db
      .from("flashcards")
      .select("*, chapters(title), ai_courses(title)")
      .eq("user_id", req.user.id)
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(parseInt(limit));

    if (courseId) query = query.eq("course_id", courseId);

    const { data, error } = await query;
    if (error) throw error;

    // Also get total due count
    const { count } = await db
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .lte("next_review_at", new Date().toISOString());

    return res.status(200).json({ success: true, data: data || [], totalDue: count || 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/flashcards/stats ────────────────────────────────────────────────
export const getFlashcardStats = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);

    const { count: totalDue } = await db
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .lte("next_review_at", new Date().toISOString());

    const { count: totalCards } = await db
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id);

    const { data: recent } = await db
      .from("flashcards")
      .select("correct_reviews, total_reviews")
      .eq("user_id", req.user.id)
      .gt("total_reviews", 0);

    const accuracy = recent && recent.length > 0
      ? Math.round(
          (recent.reduce((a, c) => a + c.correct_reviews, 0) /
           recent.reduce((a, c) => a + c.total_reviews, 0)) * 100
        )
      : 0;

    return res.status(200).json({
      success: true,
      data: { totalDue: totalDue || 0, totalCards: totalCards || 0, accuracy },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/flashcards/:id/review ────────────────────────────────────────
// rating: 5=Easy, 4=Good, 2=Hard, 1=Again
export const reviewFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (![1, 2, 4, 5].includes(Number(rating))) {
      return res.status(400).json({ success: false, message: "rating must be 1, 2, 4, or 5" });
    }

    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: card, error: fetchErr } = await db
      .from("flashcards")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();
    if (fetchErr) throw fetchErr;

    const updated = sm2(card, Number(rating));
    const { error: updateErr } = await db
      .from("flashcards")
      .update(updated)
      .eq("id", id)
      .eq("user_id", req.user.id);
    if (updateErr) throw updateErr;

    // Award XP for correct answers
    const xpGain = rating >= 4 ? 5 : rating === 2 ? 2 : 0;
    if (xpGain > 0) {
      await supabase.rpc("increment_xp", { user_id: req.user.id, amount: xpGain }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from("users")
          .select("xp, weekly_xp")
          .eq("id", req.user.id)
          .single()
          .then(({ data: u }) => {
            if (u) {
              supabase
                .from("users")
                .update({ xp: (u.xp || 0) + xpGain, weekly_xp: (u.weekly_xp || 0) + xpGain })
                .eq("id", req.user.id);
            }
          });
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        nextReviewAt:  updated.next_review_at,
        intervalDays:  updated.interval_days,
        xpGained:      xpGain,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/flashcards/session-complete ────────────────────────────────────
// Called when user finishes a full review session — records streak activity
export const completeReviewSession = async (req, res) => {
  try {
    const { cardsReviewed, correctCount } = req.body;
    const db = getAuthedSupabaseClient(req.accessToken);
    const todayStr = new Date().toISOString().split("T")[0];

    // Record as streak activity
    await db.from("streaks").upsert(
      { user_id: req.user.id, date: todayStr, activity_type: "flashcard", xp_earned: correctCount * 5 },
      { onConflict: "user_id,date", ignoreDuplicates: true }
    );

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "flashcard_session",
      description: `Reviewed ${cardsReviewed} flashcards (${correctCount} correct) 🃏`,
    });

    return res.status(200).json({ success: true, data: { xpEarned: correctCount * 5 } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Friends ──────────────────────────────────────────────────────────────────

// GET /api/friends
export const getFriends = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: rows, error } = await db
      .from("friends")
      .select("id, status, invite_code, user_id, friend_id")
      .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`);
    if (error) throw error;

    const friendIds = (rows || []).map((r) =>
      r.user_id === req.user.id ? r.friend_id : r.user_id
    );

    let friendProfiles = [];
    if (friendIds.length > 0) {
      const { data: profiles } = await supabase
        .from("users")
        .select("id, full_name, username, avatar_url, xp, weekly_xp, level, streak_days, league_tier")
        .in("id", friendIds);
      friendProfiles = profiles || [];
    }

    const enriched = (rows || []).map((r) => {
      const isRequester = r.user_id === req.user.id;
      const otherId = isRequester ? r.friend_id : r.user_id;
      const profile = friendProfiles.find((p) => p.id === otherId);
      return {
        id:         r.id,
        status:     r.status,
        direction:  isRequester ? "sent" : "received",
        friend:     profile || null,
      };
    });

    return res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/friends/search  { query: "username or name" }
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || String(query).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Search query must be at least 2 characters" });
    }

    const q = String(query).trim().toLowerCase();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, username, avatar_url, level, league_tier")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq("id", req.user.id)
      .limit(15);
    if (error) throw error;

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/friends/add  { friendId } OR { inviteCode }
export const addFriend = async (req, res) => {
  try {
    const { friendId, inviteCode } = req.body;
    const db = getAuthedSupabaseClient(req.accessToken);

    let targetId = friendId;

    if (!targetId && inviteCode) {
      // Look up by invite code
      const { data: row } = await supabase
        .from("friends")
        .select("user_id")
        .eq("invite_code", String(inviteCode).toUpperCase())
        .eq("status", "pending")
        .single();
      if (!row) {
        return res.status(404).json({ success: false, message: "Invalid or expired invite code" });
      }
      targetId = row.user_id;
    }

    if (!targetId) {
      return res.status(400).json({ success: false, message: "friendId or inviteCode required" });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot add yourself" });
    }

    // Check existing relationship
    const { data: existing } = await db
      .from("friends")
      .select("id, status")
      .or(
        `and(user_id.eq.${req.user.id},friend_id.eq.${targetId}),` +
        `and(user_id.eq.${targetId},friend_id.eq.${req.user.id})`
      )
      .single();

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ success: false, message: "Already friends" });
      }
      // If they sent us a request, accept it
      if (existing) {
        await db
          .from("friends")
          .update({ status: "accepted" })
          .eq("id", existing.id);
        return res.status(200).json({ success: true, data: { status: "accepted" } });
      }
    }

    // Send friend request
    const { data: newRow, error } = await db
      .from("friends")
      .insert({ user_id: req.user.id, friend_id: targetId, status: "pending" })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ success: true, data: { status: "pending", id: newRow.id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/friends/:id/respond  { action: 'accept' | 'reject' }
export const respondToFriend = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const db = getAuthedSupabaseClient(req.accessToken);

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accept or reject" });
    }

    if (action === "accept") {
      await db
        .from("friends")
        .update({ status: "accepted" })
        .eq("id", id)
        .eq("friend_id", req.user.id);
    } else {
      await db
        .from("friends")
        .delete()
        .eq("id", id)
        .eq("friend_id", req.user.id);
    }

    return res.status(200).json({ success: true, data: { action } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/friends/invite-code  — generate a shareable invite code
export const getMyInviteCode = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    // Generate a 6-char alphanumeric code tied to this user
    const code = Buffer.from(req.user.id)
      .toString("base64")
      .replace(/[^A-Z0-9]/gi, "")
      .slice(0, 6)
      .toUpperCase();

    // Upsert a placeholder "pending" row so the code resolves to this user
    await db.from("friends").upsert(
      { user_id: req.user.id, friend_id: req.user.id, invite_code: code, status: "pending" },
      { onConflict: "user_id,friend_id" }
    );

    return res.status(200).json({ success: true, data: { code } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
