import supabase from "../config/supabaseClient.js";

/**
 * GET /api/activity
 * Get activity history for the logged in user
 */
export const getActivity = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/activity
 * Log a new activity manually (e.g. opened a file, started a chapter)
 */
export const logActivity = async (req, res) => {
  try {
    const { type, description } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        message: "Type and description are required",
      });
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .insert({
        user_id: req.user.id,
        type,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Activity logged",
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/activity
 * Clear all activity for the logged in user
 */
export const clearActivity = async (req, res) => {
  try {
    const { error } = await supabase
      .from("activity_logs")
      .delete()
      .eq("user_id", req.user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Activity history cleared",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};