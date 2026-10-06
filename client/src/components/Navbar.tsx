import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useMySeller } from "../hooks/useSeller";
import { useUiStore } from "../store/uiStore";
import { useRagCapabilities } from "../hooks/useRag";
import { accountName, departments } from "../lib/storefront";
import { ProductSearchBar } from "./ProductSearchBar";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { UserAvatar } from "./UserAvatar";

export function Navbar() {
  const { data: ragCapabilities } = useRagCapabilities();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: cartData } = useCart();
  const { data: sellerData } = useMySeller();
  const toggleCart = useUiStore((s) => s.toggleCart);
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const itemCount = isAuthenticated
    ? (cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
    : 0;
  const activeCategory = new URLSearchParams(location.search).get("category");

  useEffect(() => setProfileOpen(false), [location.key, isAuthenticated]);
  useEffect(() => {
    if (!profileOpen) return;
    function dismiss(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [profileOpen]);

  return (
    <header className="site-header">
      <div className="announcement">
        <div className="site-container announcement-inner">
          <span>
            <Icon name="sparkle" width="13" height="13" /> Good finds. For every
            kind of everyday.
          </span>
          <Link to={sellerData?.seller ? "/seller" : "/seller/apply"}>
            Become a seller <Icon name="arrowUp" width="13" height="13" />
          </Link>
        </div>
      </div>
      <div className="site-container main-nav">
        <Brand />
        <ProductSearchBar />
        <div className="nav-actions">
          {isAuthenticated && user ? (
            <div
              className="profile-dropdown"
              ref={profileRef}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setProfileOpen(false);
              }}
            >
              <button
                ref={profileButtonRef}
                className="profile-trigger"
                type="button"
                aria-label="Account options"
                aria-expanded={profileOpen}
                aria-controls={profileOpen ? "account-menu" : undefined}
                onClick={() => setProfileOpen((open) => !open)}
              >
                <UserAvatar user={user} className="avatar-small" />
                <span className="profile-trigger-label">
                  Hi, {accountName(user.email).split(" ")[0]}
                </span>
                <Icon name="chevron" width="14" height="14" />
              </button>
              {profileOpen && (
                <nav
                  id="account-menu"
                  className="account-menu"
                  aria-label="Your account"
                >
                  <div className="account-menu-heading">
                    <strong>{accountName(user.email)}</strong>
                    <span>{user.email}</span>
                  </div>
                  <Link to="/account">
                    <Icon name="user" /> Your profile
                  </Link>
                  <Link to="/orders">
                    <Icon name="box" /> Your orders
                  </Link>
                  <Link to={sellerData?.seller ? "/seller" : "/seller/apply"}>
                    <Icon name="store" />
                    {sellerData?.seller ? "Your store" : "Start selling"}
                  </Link>
                  {user.role === "admin" && (
                    <Link to="/admin">
                      <Icon name="shield" />
                      Admin dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={logout.isPending}
                    onClick={() => {
                      setProfileOpen(false);
                      logout.mutate();
                    }}
                  >
                    <Icon name="logout" />
                    {logout.isPending ? "Signing out…" : "Sign out"}
                  </button>
                </nav>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="sign-in-link"
                state={{ from: location }}
              >
                <Icon name="user" />
                <span>Sign in</span>
              </Link>
              <Link
                to="/register"
                className="button button-orange signup-link"
                state={{ from: location }}
              >
                Sign up
              </Link>
            </>
          )}
          <span className="nav-divider" />
          <button
            type="button"
            onClick={toggleCart}
            aria-label="Open cart"
            className="cart-trigger"
          >
            <Icon name="bag" width="22" height="22" />
            <span className="cart-label">Cart</span>
            <span className="cart-count">{itemCount}</span>
          </button>
        </div>
      </div>
      <div className="category-nav-border">
        <nav
          className="site-container category-nav"
          aria-label="Shop categories"
        >
          <Link
            to="/#products"
            className={
              !activeCategory && location.pathname === "/" ? "active" : ""
            }
          >
            <Icon name="grid" width="16" height="16" /> All products
          </Link>
          <span className="category-divider" />
          {departments.map((category) => (
            <Link
              key={category.slug}
              to={`/?category=${category.slug}#products`}
              className={activeCategory === category.slug ? "active" : ""}
            >
              {category.name
                .replace(" & Personal Care", "")
                .replace(" & Outdoors", "")}
            </Link>
          ))}
          {ragCapabilities?.enabled && (
            <Link to="/assistant" className="assistant-nav">
              <Icon name="sparkle" width="15" height="15" />
              Shopping assistant
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
