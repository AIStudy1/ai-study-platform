import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";

// GET /api/ai/conversations?agentId=tutor
export const listConversations = async (req, res) => {
  try {
    const authed = getAuthedSupabaseClient(req.accessToken);
    const agentId = req.query.agentId ?? null;

    let q = authed
      .from("ai_conversations")
      .select("id, agent_id, title, title_is_auto, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    if (agentId) q = q.eq("agent_id", agentId);

    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/conversations { agentId, title? }
export const createConversation = async (req, res) => {
  try {
    const authed = getAuthedSupabaseClient(req.accessToken);
    const { agentId, title } = req.body ?? {};

    if (!agentId) {
      return res.status(400).json({ success: false, message: "agentId is required" });
    }

    const { data, error } = await authed
      .from("ai_conversations")
      .insert({
        user_id: req.user.id,
        agent_id: agentId,
        title: title ?? "New chat",
        title_is_auto: title ? false : true,
      })
      .select("id, agent_id, title, title_is_auto, created_at, updated_at")
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ai/conversations/:id/messages
export const getConversationMessages = async (req, res) => {
  try {
    const authed = getAuthedSupabaseClient(req.accessToken);
    const conversationId = req.params.id;

    const { data, error } = await authed
      .from("ai_messages")
      .select("id, role, content, agent_id, created_at")
      .eq("user_id", req.user.id)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return res.status(200).json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

