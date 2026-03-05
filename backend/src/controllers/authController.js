import supabase from "../config/supabaseClient.js";

/**
 * Register user via Supabase Auth
 * This creates the auth user and stores role metadata.
 */
export const register = async (req, res) => {
  const { email, password, full_name, role } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role: role || "student",
        },
      },
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: data.user,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


/**
 * Login via Supabase Auth
 * Supabase returns access_token + session
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", data.user.id)
      .single();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      session: data.session,
      user: {
        ...data.user,
        role: profile?.role || "student",         
        full_name: profile?.full_name || data.user.user_metadata?.full_name || "",
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export const resetPassword = async (req, res) => {
  const { email } = req.body;
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return res.status(400).json({ success: false, message: error.message });
  return res.status(200).json({ success: true, message: "Reset email sent" });
};