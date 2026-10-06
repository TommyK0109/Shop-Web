import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../api/types";

/**
 * Role gate on top of ProtectedRoute's authentication gate. This is a UI
 * convenience only — every admin endpoint runs requireRole("admin") server
 * side, so hiding the route is not what keeps a customer out of it.
 */
export function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p className="py-12 text-center text-gray-500">Loading…</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-900">You don't have access to this area.</p>
        <p className="mt-1 text-sm text-gray-500">Signed in as {user?.email}.</p>
      </div>
    );
  }

  return <Outlet />;
}
