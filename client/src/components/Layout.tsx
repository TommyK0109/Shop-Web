import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "./Navbar";
import { CartDrawer } from "./CartDrawer";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

export function Layout() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="site-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main
        id="main-content"
        className={
          location.pathname === "/"
            ? "site-container landing-main"
            : "site-container page-main"
        }
      >
        {typeof (location.state as { signupNotice?: unknown } | null)?.signupNotice === "string" && (
          <p role="status" className="auth-success signup-notice">{(location.state as { signupNotice: string }).signupNotice}</p>
        )}
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-container footer-grid">
          <div className="footer-brand">
            <Brand />
            <p>
              A place for things you love.
              <br />
              And things you didn’t know you needed.
            </p>
            <span className="footer-tagline">
              <Icon name="heart" width="15" height="15" /> A little more joy in
              the everyday.
            </span>
          </div>
          <div>
            <h2>Explore</h2>
            <Link to="/#products">Shop all products</Link>
            <Link to="/?category=electronics#products">Electronics</Link>
            <Link to="/?category=fashion#products">Fashion</Link>
            <Link to="/?category=home-kitchen#products">Home & Kitchen</Link>
          </div>
          <div>
            <h2>Your account</h2>
            <Link to="/account">My profile</Link>
            <Link to="/orders">My orders</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create an account</Link>
          </div>
          <div>
            <h2>Our marketplace</h2>
            <Link to="/seller/apply">
              Become a seller <Icon name="arrowUp" width="13" height="13" />
            </Link>
            <Link to="/seller">Seller dashboard</Link>
            <Link to="/#why-storefront">Why Storefront?</Link>
          </div>
        </div>
        <div className="site-container footer-bottom">
          <span>
            © {new Date().getFullYear()} Storefront. All rights reserved.
          </span>
          <span>
            Made for your everyday <span className="brand-dot">✳</span>
          </span>
        </div>
      </footer>
      <CartDrawer />
    </div>
  );
}
