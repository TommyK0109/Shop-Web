import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMySeller } from "../hooks/useSeller";
import { SELLER_STATUS_LABEL, SELLER_STATUS_STYLE } from "../lib/sellerStatus";
import { accountName } from "../lib/storefront";
import { Icon } from "../components/Icon";
import { UserAvatar } from "../components/UserAvatar";
import { ProfilePhotoUpload } from "../components/ProfilePhotoUpload";
import { useMutation } from "@tanstack/react-query";
import { resendVerificationRequest } from "../api/auth";
import { ApiError } from "../api/client";

export function AccountPage() {
  const { user, logout } = useAuth();
  const { data: sellerData } = useMySeller();
  const navigate = useNavigate();
  const seller = sellerData?.seller;
  const verification = useMutation({ mutationFn: resendVerificationRequest });

  if (!user) return null;
  const name = accountName(user.email);

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <UserAvatar user={user} className="account-avatar" />
        <strong>{name}</strong>
        <p>{user.email}</p>
        <nav aria-label="Account navigation">
          <Link to="/account" className="active" aria-current="page">
            <Icon name="user" />
            My profile
          </Link>
          <Link to="/orders">
            <Icon name="box" />
            My orders
          </Link>
          <Link to={seller ? "/seller" : "/seller/apply"}>
            <Icon name="store" />
            {seller ? "My store" : "Become a seller"}
          </Link>
          {user.role === "admin" && (
            <Link to="/admin">
              <Icon name="shield" />
              Admin dashboard
            </Link>
          )}
        </nav>
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => navigate("/") })
          }
        >
          <Icon name="logout" />
          {logout.isPending ? "Signing out…" : "Sign out"}
        </button>
      </aside>
      <section className="account-content">
        <span className="eyebrow">YOUR LITTLE CORNER OF STOREFRONT</span>
        <h1>Hi, {name}.</h1>
        <p>Your profile, your orders, and your next favorite find.</p>
        <div className="profile-card">
          <h2>Your profile</h2>
          <p>The details that make this space yours.</p>
          <ProfilePhotoUpload user={user} />
          <dl>
            <div>
              <dt>Email address</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Email status</dt>
              <dd><span className={`verification-badge ${user.emailVerifiedAt ? "is-verified" : ""}`}><Icon name={user.emailVerifiedAt ? "check" : "shield"} width="14" height="14" />{user.emailVerifiedAt ? "Verified" : "Awaiting verification"}</span></dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd className="capitalize">{user.role}</dd>
            </div>
            {seller && (
              <div>
                <dt>Your store</dt>
                <dd>
                  {seller.businessName}{" "}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${SELLER_STATUS_STYLE[seller.status]}`}
                  >
                    {SELLER_STATUS_LABEL[seller.status]}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          {!user.emailVerifiedAt && <div className="verification-notice">
            <p>Confirm your email address to finish setting up your profile.</p>
            <button type="button" className="text-link" disabled={verification.isPending} onClick={() => verification.mutate()}>{verification.isPending ? "Sending…" : "Resend verification email"}</button>
            {verification.isSuccess && <p role="status" className="photo-success">{verification.data.message}</p>}
            {verification.isError && <p role="alert" className="auth-error">{verification.error instanceof ApiError ? verification.error.message : "We could not send the email. Please try again."}</p>}
          </div>}
        </div>
        <div className="profile-card account-security-card"><div><h2>Account security</h2><p>Keep your account protected with a strong password.</p></div><Link to="/forgot-password" className="button button-light">Reset password</Link></div>
        <div className="account-shortcuts">
          <Link to="/orders">
            <Icon name="box" width="26" height="26" />
            <Icon
              name="arrowUp"
              className="shortcut-arrow"
              width="17"
              height="17"
            />
            <strong>Your orders</strong>
            <p>Follow your finds from the store to your door.</p>
          </Link>
          <Link to={seller ? "/seller" : "/seller/apply"}>
            <Icon name="store" width="26" height="26" />
            <Icon
              name="arrowUp"
              className="shortcut-arrow"
              width="17"
              height="17"
            />
            <strong>
              {seller ? "Your storefront" : "Share your good finds"}
            </strong>
            <p>
              {seller
                ? "Manage your products and your store."
                : "Open a store and join our seller community."}
            </p>
          </Link>
        </div>
        <Link to="/#products" className="text-link mt-6">
          Discover something new <Icon name="arrow" width="17" height="17" />
        </Link>
      </section>
    </div>
  );
}
