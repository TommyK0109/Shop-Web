import { useState } from "react";
import { Link } from "react-router-dom";
import { useSellerApplications, useUpdateSellerStatus } from "../../hooks/useAdmin";
import { formatPrice } from "../../lib/format";
import { SELLER_STATUS_LABEL, SELLER_STATUS_STYLE } from "../../lib/sellerStatus";
import type { SellerApplication, SellerStatus } from "../../api/types";

const FILTERS: Array<{ value: SellerStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
];

// Which decisions make sense from a given state. `pending` is only ever an
// initial state — nothing here can move a seller back into it.
const ACTIONS: Record<SellerStatus, Array<Exclude<SellerStatus, "pending">>> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["approved"],
  suspended: ["approved"],
};

const ACTION_LABEL: Record<Exclude<SellerStatus, "pending">, string> = {
  approved: "Approve",
  rejected: "Reject",
  suspended: "Suspend",
};

const ACTION_STYLE: Record<Exclude<SellerStatus, "pending">, string> = {
  approved: "bg-accent text-ink hover:bg-accent-dark",
  rejected: "border border-red-300 text-red-700 hover:bg-red-50",
  suspended: "border border-gray-300 text-gray-700 hover:bg-gray-50",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ApplicationCard({ seller }: { seller: SellerApplication }) {
  const [expanded, setExpanded] = useState(seller.status === "pending");
  const updateStatus = useUpdateSellerStatus();

  return (
    <article className="rounded bg-white shadow-sm">
      <header className="flex flex-wrap items-start gap-4 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-gray-900">{seller.businessName}</h2>
          <p className="text-xs text-gray-500">
            {seller.applicantName} · {seller.user.email} · applied {formatDate(seller.createdAt)}
          </p>
        </div>

        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SELLER_STATUS_STYLE[seller.status]}`}>
          {SELLER_STATUS_LABEL[seller.status]}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-xs text-link hover:underline"
        >
          {expanded ? "Hide application" : "Review application"}
        </button>
      </header>

      {expanded && (
        <div className="space-y-5 px-4 py-4 text-sm">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Identity</h3>
              <p className="text-gray-900">{seller.applicantName}</p>
              {/* Only the last 4 digits exist anywhere in this system — the
                  full value is never stored, logged, or returned. PLAN.md §4. */}
              <p className="text-xs text-gray-500">National ID •••• {seller.nationalIdMasked}</p>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Business address</h3>
              <address className="not-italic text-gray-900">
                {seller.addressLine1}
                <br />
                {seller.city} {seller.postalCode}, {seller.country}
              </address>
            </div>
          </section>

          {seller.description && (
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Store description</h3>
              <p className="text-gray-600">{seller.description}</p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Proposed catalog ({seller.products.length})
            </h3>
            {seller.products.length === 0 ? (
              <p className="text-xs text-gray-500">No products submitted.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                {seller.products.map((product) => (
                  <li key={product.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {seller.status === "approved" ? (
                        <Link
                          to={`/products/${product.slug}`}
                          className="min-w-0 flex-1 truncate text-link hover:underline"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-gray-900">{product.name}</span>
                      )}
                      <span className="text-xs text-gray-500">{product.category.name}</span>
                      <span className="text-xs text-gray-500">{product.stockQty} in stock</span>
                      <span className="text-gray-900">{formatPrice(product.priceCents)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description}</p>
                  </li>
                ))}
              </ul>
            )}
            {seller.status !== "approved" && (
              <p className="mt-2 text-xs text-gray-500">
                These listings stay out of the public catalog until this seller is approved.
              </p>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            {ACTIONS[seller.status].map((action) => (
              <button
                key={action}
                type="button"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: seller.id, status: action })}
                className={`rounded px-4 py-1.5 text-xs font-medium disabled:opacity-60 ${ACTION_STYLE[action]}`}
              >
                {ACTION_LABEL[action]}
              </button>
            ))}
            {updateStatus.isError && (
              <span role="alert" className="text-xs text-red-600">
                {(updateStatus.error as Error).message}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function AdminSellersPage() {
  const [filter, setFilter] = useState<SellerStatus | "all">("pending");
  const { data, isLoading, isError } = useSellerApplications(filter === "all" ? undefined : filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === option.value
                ? "bg-ink font-medium text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading applications…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load seller applications.</p>}

      {data &&
        (data.sellers.length === 0 ? (
          <p className="rounded bg-white p-8 text-center text-sm text-gray-600 shadow-sm">
            No {filter === "all" ? "" : `${filter} `}applications.
          </p>
        ) : (
          <div className="space-y-3">
            {data.sellers.map((seller) => (
              <ApplicationCard key={seller.id} seller={seller} />
            ))}
          </div>
        ))}
    </div>
  );
}
