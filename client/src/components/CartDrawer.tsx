import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  useCart,
  useDismissRemovalNotices,
  useRemoveCartItem,
  useUpdateCartItem,
} from "../hooks/useCart";
import { useUiStore } from "../store/uiStore";
import { formatPrice } from "../lib/format";
import type { CartItem } from "../api/types";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../api/client";
import { Icon } from "./Icon";

/**
 * How many units the quantity picker offers.
 *
 * An unavailable line still gets a picker covering at least its current
 * quantity, so the value it is showing is always one of its own options — a
 * select whose value isn't in its option list renders blank, which is how an
 * out-of-stock line used to look like a broken row rather than a paused one.
 */
function quantityOptions(item: CartItem): number[] {
  const ceiling = Math.max(
    Math.min(item.product.stockQty, 10),
    item.quantity,
    1,
  );
  return Array.from({ length: ceiling }, (_, i) => i + 1);
}

export function CartDrawer() {
  const isOpen = useUiStore((s) => s.isCartOpen);
  const closeCart = useUiStore((s) => s.closeCart);
  const { data, isLoading, isError, isFetching, refetch } = useCart();
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const dismissNotices = useDismissRemovalNotices();

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".site-header, #main-content, .site-footer, .skip-link",
      ),
    ).map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
      }
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      previouslyFocused?.focus();
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  const cart = isAuthenticated ? data?.cart : undefined;
  const notices = cart?.removalNotices ?? [];
  const mutationError =
    updateItem.error ?? removeItem.error ?? dismissNotices.error;

  return (
    <div className="cart-overlay">
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={-1}
        onClick={closeCart}
        className="cart-backdrop"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
        className="cart-panel"
      >
        <div className="cart-header">
          <h2 id="cart-title">
            Your cart
            <span className="ml-2 text-sm font-normal text-gray-500">
              {cart
                ? `(${cart.items.reduce((sum, item) => sum + item.quantity, 0)})`
                : ""}
            </span>
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="cart-close"
          >
            <Icon name="close" width="17" height="17" />
          </button>
        </div>

        <div className="cart-body">
          {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {isError && isAuthenticated && (
            <div className="catalog-state" role="alert">
              <Icon name="bag" />
              <h3>We couldn’t load your cart.</h3>
              <p>Please try again in a moment.</p>
              <button
                type="button"
                className="button button-dark"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? "Trying again…" : "Try again"}
              </button>
            </div>
          )}
          {!isLoading &&
            (!isError || !isAuthenticated) &&
            (!cart || cart.items.length === 0) &&
            notices.length === 0 && (
              <div className="cart-empty">
                <Icon name="bag" width="48" height="48" />
                <strong>Your cart is empty.</strong>
                <p>
                  {isAuthenticated
                    ? "A little discovery could change that. Let’s find your next favorite thing."
                    : "Sign in to keep your favorite finds in your cart and make them yours."}
                </p>
                {isAuthenticated ? (
                  <Link
                    to="/#products"
                    onClick={closeCart}
                    className="button button-dark"
                  >
                    Find something you love{" "}
                    <Icon name="arrow" width="17" height="17" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      state={{ from: location }}
                      onClick={closeCart}
                      className="button button-dark"
                    >
                      Sign in to shop{" "}
                      <Icon name="arrow" width="17" height="17" />
                    </Link>
                    <Link
                      to="/register"
                      state={{ from: location }}
                      onClick={closeCart}
                      className="text-link mt-4"
                    >
                      New here? Create an account
                    </Link>
                  </>
                )}
              </div>
            )}
          {notices.length > 0 && (
            <div
              role="status"
              className="mb-4 rounded border border-amber-200 bg-amber-50 p-3"
            >
              <p className="text-xs font-medium text-amber-900">
                Removed by the seller
              </p>
              <ul className="mt-1 space-y-1">
                {notices.map((notice) => (
                  <li key={notice.id} className="text-xs text-amber-900">
                    <span className="font-medium">
                      {notice.productName} × {notice.quantity}
                    </span>{" "}
                    — {notice.reason}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => dismissNotices.mutate()}
                disabled={dismissNotices.isPending}
                className="mt-2 text-xs text-amber-900 underline hover:no-underline disabled:opacity-60"
              >
                Got it
              </button>
            </div>
          )}

          {cart && cart.items.length > 0 && (
            <ul className="space-y-4">
              {cart.items.map((item) => {
                const unavailable = item.unavailableReason !== null;
                return (
                  <li
                    key={item.id}
                    className={`flex gap-3 ${unavailable ? "opacity-70" : ""}`}
                  >
                    <div className="cart-item-image">
                      {item.product.images[0] ? (
                        <img
                          src={item.product.images[0].url}
                          alt=""
                          className={`h-full w-full object-contain ${unavailable ? "grayscale" : ""}`}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">No image</span>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="line-clamp-2 text-sm text-gray-900">
                        {item.product.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatPrice(item.product.priceCents)} each
                      </p>

                      {/* Kept item in the cart */}
                      {unavailable && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          {item.unavailableMessage}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <select
                          aria-label={`Quantity for ${item.product.name}`}
                          value={item.quantity}
                          disabled={
                            updateItem.isPending || removeItem.isPending
                          }
                          onChange={(e) =>
                            updateItem.mutate({
                              itemId: item.id,
                              quantity: Number(e.target.value),
                            })
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          {quantityOptions(item).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            removeItem.isPending || updateItem.isPending
                          }
                          onClick={() => removeItem.mutate(item.id)}
                          className="text-xs text-link hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p
                      className={`text-sm font-medium ${unavailable ? "text-gray-400 line-through" : "text-gray-900"}`}
                    >
                      {formatPrice(item.product.priceCents * item.quantity)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {mutationError && (
            <p role="alert" className="auth-error cart-error">
              {mutationError instanceof ApiError
                ? mutationError.message
                : "We couldn’t update your cart. Please try again."}
            </p>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="cart-summary">
            <div className="flex items-center justify-between text-sm font-medium text-gray-900">
              <span>Subtotal</span>
              <span>{formatPrice(cart.totalCents)}</span>
            </div>

            {cart.unavailableCount > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {cart.unavailableCount}{" "}
                {cart.unavailableCount === 1 ? "item is" : "items are"}{" "}
                unavailable and
                {cart.unavailableCount === 1 ? " isn't" : " aren't"} included.
                They stay in your cart.
              </p>
            )}

            {cart.purchasableCount > 0 ? (
              <Link
                to="/checkout"
                onClick={closeCart}
                className="button button-dark"
              >
                Checkout <Icon name="arrow" width="18" height="18" />
              </Link>
            ) : (
              <p className="mt-4 rounded bg-gray-100 py-2 text-center text-sm text-gray-500">
                Your cart is empty!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
