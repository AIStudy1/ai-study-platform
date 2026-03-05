<<<<<<< HEAD
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}`,
=======
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: insufficient permissions",
>>>>>>> feature/supabase-migration
      });
    }

    next();
  };
};
<<<<<<< HEAD
=======

// Alias for compatibility
export const requireRole = (role) => authorizeRoles(role);
>>>>>>> feature/supabase-migration
