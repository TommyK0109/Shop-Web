import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { updateProductSchema, supportsProductSpecifications } from "@storefront/shared";
import { SpecificationsFields } from "../../components/ProductSpecifications";
import { useProducts } from "../../hooks/useProducts";
import { useCategories } from "../../hooks/useCategories";
import { useModerateProduct, useRemoveProduct } from "../../hooks/useAdmin";
import { Pagination } from "../../components/Pagination";
import { formatPrice } from "../../lib/format";
import type { Category, Product } from "../../api/types";

const PAGE_SIZE = 20;

function ProductRow({ product, categories }: { product: Product; categories: Category[] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    priceCents: String(product.priceCents),
    stockQty: String(product.stockQty),
    categoryId: product.categoryId,
    specifications: product.specifications ?? null,
    description: product.description,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const moderate = useModerateProduct();
  const remove = useRemoveProduct();

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const parsed = updateProductSchema.safeParse({
      name: form.name.trim(),
      priceCents: Number(form.priceCents),
      stockQty: Number(form.stockQty),
      categoryId: form.categoryId,
      specifications: form.specifications,
      description: form.description,
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Check the values");
      return;
    }

    moderate.mutate({ id: product.id, body: parsed.data }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end">
          <label className="sm:col-span-2 text-xs text-gray-600">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark"
            />
          </label>
          <label className="text-xs text-gray-600">
            Price (cents)
            <input
              type="number"
              min={1}
              value={form.priceCents}
              onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark"
            />
          </label>
          <label className="text-xs text-gray-600">
            Stock
            <input
              type="number"
              min={0}
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark"
            />
          </label>
          <label className="text-xs text-gray-600">
            Category
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value, specifications: supportsProductSpecifications(categories.find((category) => category.id === e.target.value)?.slug ?? "") ? form.specifications : null })}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-gray-600 sm:col-span-5">Description<textarea maxLength={12_000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
          <SpecificationsFields value={form.specifications} categorySlug={categories.find((category) => category.id === form.categoryId)?.slug ?? ""} onChange={(specifications) => setForm({ ...form, specifications })} />
          <div className="flex gap-2 sm:col-span-5">
            <button
              type="submit"
              disabled={moderate.isPending}
              className="rounded bg-accent px-4 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
            >
              {moderate.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">
              Cancel
            </button>
            {(validationError || moderate.isError) && (
              <span role="alert" className="text-xs text-red-600">
                {validationError ?? (moderate.error as Error).message}
              </span>
            )}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
      <Link to={`/products/${product.slug}`} className="min-w-0 flex-1 truncate text-link hover:underline">
        {product.name}
      </Link>
      <span className="text-xs text-gray-500">{product.category.name}</span>
      <Link to={`/sellers/${product.seller.slug}`} className="text-xs text-gray-500 hover:underline">
        {product.seller.businessName}
      </Link>
      <span className="text-gray-900">{formatPrice(product.priceCents)}</span>
      <span className="text-xs text-gray-500">{product.stockQty} in stock</span>
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-link hover:underline">
        Edit
      </button>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => remove.mutate(product.id)}
        className="text-xs text-red-600 hover:underline disabled:opacity-60"
      >
        Remove
      </button>
      {remove.isError && (
        <span role="alert" className="w-full text-xs text-red-600">
          {(remove.error as Error).message}
        </span>
      )}
    </li>
  );
}

export function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useProducts({
    search: submittedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { data: categoriesData } = useCategories();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedSearch(search.trim());
          setPage(1);
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a product to moderate"
          aria-label="Search products"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-dark"
        />
        <button type="submit" className="rounded bg-ink px-5 py-2 text-sm text-white hover:bg-ink-light">
          Search
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-500">Loading products…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load products.</p>}

      {data && (
        <>
          <p className="mb-2 text-xs text-gray-500">{data.pagination.total} products in the live catalog</p>
          <ul className="divide-y divide-gray-100 rounded bg-white shadow-sm">
            {data.products.map((product) => (
              <ProductRow key={product.id} product={product} categories={categoriesData?.categories ?? []} />
            ))}
          </ul>

          {data.pagination.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-gray-500">
        This lists the public catalog, so it only covers approved sellers' products — a pending seller's
        proposed catalog is reviewed on the seller application instead.
      </p>
    </div>
  );
}
