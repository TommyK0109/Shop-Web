import { Link, NavLink, Outlet } from "react-router-dom";
import { useMySeller } from "../../hooks/useSeller";
import { SELLER_STATUS_HINT, SELLER_STATUS_LABEL, SELLER_STATUS_STYLE } from "../../lib/sellerStatus";

const TABS = [
  { to: "/seller/products", label: "Products" },
  { to: "/seller/orders", label: "Orders" },
  { to: "/seller/payments", label: "Payments" },
];

export function SellerLayout() {
  // SellerRoute has already resolved this query, so it's a cache read.
  const { data } = useMySeller();
  const seller = data?.seller;

  if (!seller) return null;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{seller.businessName}</h1>
          <p className="text-sm text-gray-500">
            Your store ·{" "}
            {seller.status === "approved" ? (
              <Link to={`/sellers/${seller.slug}`} className="text-link hover:underline">
                View public page
              </Link>
            ) : (
              <span>/sellers/{seller.slug}</span>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${SELLER_STATUS_STYLE[seller.status]}`}
        >
          {SELLER_STATUS_LABEL[seller.status]}
        </span>
      </header>

      {seller.status !== "approved" && (
        <p className="mb-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {SELLER_STATUS_HINT[seller.status]}
        </p>
      )}

      <nav className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm ${
                isActive
                  ? "border-accent-dark font-medium text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
