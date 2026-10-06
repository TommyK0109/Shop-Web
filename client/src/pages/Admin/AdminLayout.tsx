import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin/sellers", label: "Sellers" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
];

export function AdminLayout() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500">Platform-wide oversight across every seller.</p>
      </header>

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
