import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { createProductSchema, supportsProductSpecifications, type ProductSpecifications } from "@storefront/shared";
import { SpecificationsFields } from "../../components/ProductSpecifications";
import {
  useCreateMyProduct,
  useDeleteMyProduct,
  useMyProducts,
  useMySeller,
  useSetMyProductAvailability,
  useUpdateMyProduct,
} from "../../hooks/useSeller";
import { useCategories } from "../../hooks/useCategories";
import { centsToPriceInput, formatPrice, parsePriceToCents } from "../../lib/format";
import type { Category, SellerProductSummary } from "../../api/types";

const inputClass =
  "mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark";

interface ProductForm {
  name: string;
  description: string;
  categoryId: string;
  /** Dollars as typed — converted to integer cents before it leaves here. */
  price: string;
  stockQty: string;
  specifications: ProductSpecifications | null;
}

/**
 * Turns the dollars-and-strings form state into the cents-and-numbers shape
 * the API takes, running it through the same Zod schema the server uses.
 */
function parseForm(form: ProductForm) {
  const priceCents = parsePriceToCents(form.price);
  if (priceCents === null) {
    return { ok: false as const, error: "Enter a price like 19.99" };
  }

  const result = createProductSchema.safeParse({
    name: form.name.trim(),
    description: form.description.trim(),
    categoryId: form.categoryId,
    priceCents,
    stockQty: form.stockQty.trim() === "" ? Number.NaN : Number(form.stockQty),
    specifications: form.specifications,
  });
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Check the values" };
  }
  return { ok: true as const, data: result.data };
}

function ProductFields({
  form,
  categories,
  onChange,
}: {
  form: ProductForm;
  categories: Category[];
  onChange: (patch: Partial<ProductForm>) => void;
}) {
  return (
    <>
      <label className="block text-xs text-gray-600 sm:col-span-2">
        Name
        <input value={form.name} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </label>

      <label className="block text-xs text-gray-600">
        Category
        <select
          value={form.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value, specifications: supportsProductSpecifications(categories.find((category) => category.id === e.target.value)?.slug ?? "") ? form.specifications : null })}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-gray-600">
        Price (USD)
        <input
          inputMode="decimal"
          placeholder="19.99"
          value={form.price}
          onChange={(e) => onChange({ price: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className="block text-xs text-gray-600">
        Stock
        <input
          type="number"
          min={0}
          value={form.stockQty}
          onChange={(e) => onChange({ stockQty: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className="block text-xs text-gray-600 sm:col-span-5">
        Description
        <textarea
          rows={2}
          maxLength={12_000}
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={inputClass}
        />
      </label>
      <SpecificationsFields value={form.specifications} categorySlug={categories.find((category) => category.id === form.categoryId)?.slug ?? ""} onChange={(specifications) => onChange({ specifications })} />
    </>
  );
}

function ProductRow({ product, categories }: { product: SellerProductSummary; categories: Category[] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProductForm>({
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    price: centsToPriceInput(product.priceCents),
    stockQty: String(product.stockQty),
    specifications: product.specifications ?? null,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const update = useUpdateMyProduct();
  const remove = useDeleteMyProduct();
  const setAvailability = useSetMyProductAvailability();
  const outOfStock = product.status === "out_of_stock";

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setValidationError(parsed.error);
      return;
    }
    setValidationError(null);
    update.mutate({ id: product.id, input: parsed.data }, { onSuccess: () => setEditing(false) });
  }

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end">
          <ProductFields form={form} categories={categories} onChange={(patch) => setForm({ ...form, ...patch })} />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
            <button
              type="submit"
              disabled={update.isPending}
              className="rounded bg-accent px-4 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValidationError(null);
                setEditing(false);
              }}
              className="text-xs text-gray-500 hover:underline"
            >
              Cancel
            </button>
            {(validationError || update.isError) && (
              <span role="alert" className="text-xs text-red-600">
                {validationError ?? (update.error as Error).message}
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
      <span className="text-gray-900">{formatPrice(product.priceCents)}</span>
      <span className="text-xs text-gray-500">{product.stockQty} in stock</span>
      {outOfStock && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          Out of stock
        </span>
      )}
      {/* Editing and deleting stay open in every state, so a pending
          applicant can still fix the catalog they submitted. Only *creating*
          is gated on approval — mirroring requireApprovedSeller. */}
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-link hover:underline">
        Edit
      </button>
      {/* Confirming a listing out of stock is the one action that clears it
          from customers' carts, so it is deliberately separate from editing
          the stock number — dropping stock to 0 leaves every cart intact. */}
      <button
        type="button"
        disabled={setAvailability.isPending}
        onClick={() =>
          setAvailability.mutate({ id: product.id, input: { status: outOfStock ? "active" : "out_of_stock" } })
        }
        className="text-xs text-link hover:underline disabled:opacity-60"
      >
        {outOfStock ? "Back on sale" : "Mark out of stock"}
      </button>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => remove.mutate(product.id)}
        className="text-xs text-red-600 hover:underline disabled:opacity-60"
      >
        Withdraw
      </button>
      {setAvailability.isSuccess && setAvailability.data.removedFromCarts > 0 && (
        <span className="w-full text-xs text-amber-700">
          Removed from {setAvailability.data.removedFromCarts}{" "}
          {setAvailability.data.removedFromCarts === 1 ? "cart" : "carts"}. Those buyers have been told why.
        </span>
      )}
      {remove.isSuccess && remove.data.removedFromCarts > 0 && (
        <span className="w-full text-xs text-amber-700">
          Withdrawn, and removed from {remove.data.removedFromCarts}{" "}
          {remove.data.removedFromCarts === 1 ? "cart" : "carts"}.
        </span>
      )}
      {(remove.isError || setAvailability.isError) && (
        <span role="alert" className="w-full text-xs text-red-600">
          {((remove.error ?? setAvailability.error) as Error).message}
        </span>
      )}
    </li>
  );
}

function NewProductForm({ categories }: { categories: Category[] }) {
  const blank: ProductForm = { name: "", description: "", categoryId: "", price: "", stockQty: "1", specifications: null };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blank);
  const [validationError, setValidationError] = useState<string | null>(null);
  const create = useCreateMyProduct();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setValidationError(parsed.error);
      return;
    }
    setValidationError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setForm(blank);
        setOpen(false);
      },
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 rounded bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-dark"
      >
        Add a product
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-1 gap-2 rounded bg-white p-4 shadow-sm sm:grid-cols-5 sm:items-end">
      <ProductFields form={form} categories={categories} onChange={(patch) => setForm({ ...form, ...patch })} />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-accent px-4 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
        >
          {create.isPending ? "Adding…" : "Add product"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValidationError(null);
            setOpen(false);
          }}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
        {(validationError || create.isError) && (
          <span role="alert" className="text-xs text-red-600">
            {validationError ?? (create.error as Error).message}
          </span>
        )}
      </div>
    </form>
  );
}

export function SellerProductsPage() {
  const { data: sellerData } = useMySeller();
  const { data, isLoading, isError } = useMyProducts();
  const { data: categoriesData } = useCategories();

  const seller = sellerData?.seller;
  // Mirrors requireApprovedSeller: only an approved store can add listings.
  // Editing what's already there stays open, so a pending applicant can fix
  // the catalog they submitted while it's under review.
  const canCreate = seller?.status === "approved";

  return (
    <div>
      {canCreate ? (
        <NewProductForm categories={categoriesData?.categories ?? []} />
      ) : (
        <p className="mb-4 text-sm text-gray-500">
          New listings unlock once your store is approved. You can still edit the catalog you submitted.
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading your products…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load your products.</p>}

      {data && (
        <>
          <p className="mb-2 text-xs text-gray-500">
            {data.products.length} {data.products.length === 1 ? "listing" : "listings"} in your store
          </p>

          {data.products.length === 0 ? (
            <p className="rounded bg-white p-8 text-center text-sm text-gray-600 shadow-sm">
              You don't have any listings yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded bg-white shadow-sm">
              {data.products.map((product) => (
                <ProductRow key={product.id} product={product} categories={categoriesData?.categories ?? []} />
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-gray-500">
        This is your own catalog only. Every write here goes through an ownership check server-side, so it can
        never touch another seller's listings. Withdrawing a listing archives it rather than deleting it —
        past orders and reviews keep working.
      </p>
    </div>
  );
}
