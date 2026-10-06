import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMySeller } from "../hooks/useSeller";

/**
  * A route that only renders its children if the user has a seller account.
 */
export function SellerRoute() {
  const { data, isLoading, isError } = useMySeller();
  const location = useLocation();

  if (isLoading) {
    return <p className="py-12 text-center text-gray-500">Loading…</p>;
  }

  if (isError) {
    return <p className="py-12 text-center text-red-600">Couldn't load your store.</p>;
  }

  if (!data?.seller) {
    return <Navigate to="/seller/apply" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
