import { useMemo, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { z } from "zod";
import { sellerApplicationSchema, supportsProductSpecifications, type ProductSpecifications as Specifications, type SellerApplicationInput } from "@storefront/shared";
import { ProductSpecifications, SpecificationsFields } from "../../components/ProductSpecifications";
import { useApplyToSell, useMySeller } from "../../hooks/useSeller";
import { useCategories } from "../../hooks/useCategories";
import { ApiError } from "../../api/client";
import { formatPrice, parsePriceToCents } from "../../lib/format";

// Each step validates against a slice of the same Zod schema the server
// validates the final POST with — the one-schema-two-places point from
// PLAN.md §2. A step can't be left until its own fields parse, so the last
// step never has to explain an error that belongs three screens back.
const identitySchema = sellerApplicationSchema.pick({ applicantName: true, nationalId: true });
const businessSchema = sellerApplicationSchema.pick({
  businessName: true,
  description: true,
  addressLine1: true,
  city: true,
  postalCode: true,
  country: true,
});
const productsSchema = sellerApplicationSchema.pick({ products: true });

const STEPS = ["Identity", "Business", "Products", "Review"] as const;

interface ProductDraft {
  key: string;
  categoryId: string;
  name: string;
  description: string;
  /** Dollars as typed; converted to integer cents on validation. */
  price: string;
  stockQty: string;
  specifications: Specifications | null;
}

function emptyProduct(): ProductDraft {
  return { key: crypto.randomUUID(), categoryId: "", name: "", description: "", price: "", stockQty: "1", specifications: null };
}

/** Flattens Zod issues to one message per field path, e.g. "products.0.name". */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const inputClass =
  "mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-dark";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function SellerApplyPage() {
  const navigate = useNavigate();
  const { data: sellerData, isLoading: isSellerLoading } = useMySeller();
  const { data: categoriesData } = useCategories();
  const apply = useApplyToSell();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [applicantName, setApplicantName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [products, setProducts] = useState<ProductDraft[]>([emptyProduct()]);

  const categories = categoriesData?.categories ?? [];

  // Drafts only become the API shape once they parse: an unfilled price or
  // stock field would otherwise reach Zod as NaN and report a confusing
  // "expected number" instead of "required".
  const parsedProducts = useMemo(
    () =>
      products.map((draft) => ({
        categoryId: draft.categoryId,
        name: draft.name.trim(),
        description: draft.description.trim(),
        priceCents: parsePriceToCents(draft.price) ?? Number.NaN,
        stockQty: draft.stockQty.trim() === "" ? Number.NaN : Number(draft.stockQty),
        specifications: draft.specifications,
      })),
    [products],
  );

  function validateStep(current: number): boolean {
    if (current === 0) {
      const result = identitySchema.safeParse({
        applicantName: applicantName.trim(),
        nationalId: nationalId.trim(),
      });
      setErrors(result.success ? {} : toFieldErrors(result.error));
      return result.success;
    }
    if (current === 1) {
      const result = businessSchema.safeParse({
        businessName: businessName.trim(),
        description: description.trim() || undefined,
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
      });
      setErrors(result.success ? {} : toFieldErrors(result.error));
      return result.success;
    }
    if (current === 2) {
      const priceErrors: Record<string, string> = {};
      products.forEach((draft, i) => {
        if (parsePriceToCents(draft.price) === null) {
          priceErrors[`products.${i}.priceCents`] = "Enter a price like 19.99";
        }
      });

      const result = productsSchema.safeParse({ products: parsedProducts });
      const zodErrors = result.success ? {} : toFieldErrors(result.error);
      // Our own "19.99" message is more useful than Zod's NaN complaint, so
      // it wins where both fire on the same field.
      const merged = { ...zodErrors, ...priceErrors };
      setErrors(merged);
      return Object.keys(merged).length === 0;
    }
    return true;
  }

  function handleNext() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  async function handleSubmit() {
    // Re-validate every step's fields, not just the current one: the Review
    // step is the first place the whole payload exists at once.
    for (const earlier of [0, 1, 2]) {
      if (!validateStep(earlier)) {
        setStep(earlier);
        return;
      }
    }

    const payload: SellerApplicationInput = {
      applicantName: applicantName.trim(),
      nationalId: nationalId.trim(),
      businessName: businessName.trim(),
      description: description.trim() || undefined,
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
      products: parsedProducts,
    };

    try {
      await apply.mutateAsync(payload);
      navigate("/seller/products", { replace: true });
    } catch {
      // Surfaced below from apply.error.
    }
  }

  function updateProduct(index: number, patch: Partial<ProductDraft>) {
    setProducts((prev) => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  if (isSellerLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  // One application per user — the server answers a second POST with a 409,
  // so send anyone who already has a store to it instead.
  if (sellerData?.seller) return <Navigate to="/seller" replace />;

  const serverError = apply.error instanceof ApiError ? apply.error.message : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Apply to sell</h1>
      <p className="mt-1 text-sm text-gray-500">
        Tell us who you are, where your business is, and what you would like to list. An admin reviews all
        three together before your store goes live.
      </p>

      <ol className="mt-6 flex gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <span aria-hidden className={`block h-1 rounded-full ${i <= step ? "bg-accent-dark" : "bg-gray-200"}`} />
            <span className={`mt-1 block text-xs ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Your full name" htmlFor="applicantName" error={errors.applicantName}>
              <input
                id="applicantName"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                className={inputClass}
              />
            </Field>

            {/* PLAN.md §4: this is a simulated identity check. The server
                stores only the last 4 digits and never logs the value. */}
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Demo project — do not enter a real ID number.</strong> Identity verification here is
              simulated. Any digits will do; only the last 4 are ever stored, and the full value is never
              logged or returned by the API.
            </div>

            <Field label="National ID number" htmlFor="nationalId" error={errors.nationalId} hint="Digits only.">
              <input
                id="nationalId"
                inputMode="numeric"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Store name" htmlFor="businessName" error={errors.businessName}>
              <input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Store description"
              htmlFor="description"
              error={errors.description}
              hint="Optional — shown on your public store page."
            >
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Business address" htmlFor="addressLine1" error={errors.addressLine1}>
              <input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="City" htmlFor="city" error={errors.city}>
                <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Postal code" htmlFor="postalCode" error={errors.postalCode}>
                <input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Country" htmlFor="country" error={errors.country}>
                <input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-gray-600">
              List at least one product. These are created with your application and stay hidden from the
              catalog until an admin approves your store.
            </p>
            {errors.products && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {errors.products}
              </p>
            )}

            <ul className="mt-4 space-y-4">
              {products.map((draft, i) => (
                <li key={draft.key} className="rounded border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-900">Product {i + 1}</h2>
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProducts((prev) => prev.filter((_, index) => index !== i))}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Field label="Name" htmlFor={`product-name-${i}`} error={errors[`products.${i}.name`]}>
                      <input
                        id={`product-name-${i}`}
                        value={draft.name}
                        onChange={(e) => updateProduct(i, { name: e.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Description"
                      htmlFor={`product-description-${i}`}
                      error={errors[`products.${i}.description`]}
                    >
                      <textarea
                        id={`product-description-${i}`}
                        maxLength={12_000}
                        rows={2}
                        value={draft.description}
                        onChange={(e) => updateProduct(i, { description: e.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field
                        label="Category"
                        htmlFor={`product-category-${i}`}
                        error={errors[`products.${i}.categoryId`]}
                      >
                        <select
                          id={`product-category-${i}`}
                          value={draft.categoryId}
                          onChange={(e) => updateProduct(i, { categoryId: e.target.value, specifications: supportsProductSpecifications(categories.find((category) => category.id === e.target.value)?.slug ?? "") ? draft.specifications : null })}
                          className={inputClass}
                        >
                          <option value="">Choose a category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label="Price (USD)"
                        htmlFor={`product-price-${i}`}
                        error={errors[`products.${i}.priceCents`]}
                      >
                        <input
                          id={`product-price-${i}`}
                          inputMode="decimal"
                          placeholder="19.99"
                          value={draft.price}
                          onChange={(e) => updateProduct(i, { price: e.target.value })}
                          className={inputClass}
                        />
                      </Field>

                      <Field
                        label="Stock quantity"
                        htmlFor={`product-stock-${i}`}
                        error={errors[`products.${i}.stockQty`]}
                      >
                        <input
                          id={`product-stock-${i}`}
                          type="number"
                          min={0}
                          value={draft.stockQty}
                          onChange={(e) => updateProduct(i, { stockQty: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <SpecificationsFields value={draft.specifications} categorySlug={categories.find((category) => category.id === draft.categoryId)?.slug ?? ""} onChange={(specifications) => updateProduct(i, { specifications })} />
                    {Object.entries(errors).filter(([key]) => key.startsWith(`products.${i}.specifications`)).map(([key, message]) => <p key={key} role="alert" className="text-xs text-red-600">{message}</p>)}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setProducts((prev) => [...prev, emptyProduct()])}
              className="mt-4 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Add another product
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-sm">
            <section>
              <h2 className="mb-2 font-medium text-gray-900">Applicant</h2>
              <dl className="space-y-1 text-gray-600">
                <div className="flex justify-between">
                  <dt>Name</dt>
                  <dd className="text-gray-900">{applicantName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>National ID</dt>
                  {/* Masked here too — the review screen has no reason to
                      show what the server will not store. */}
                  <dd className="text-gray-900">•••• {nationalId.slice(-4)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="mb-2 font-medium text-gray-900">Business</h2>
              <dl className="space-y-1 text-gray-600">
                <div className="flex justify-between">
                  <dt>Store name</dt>
                  <dd className="text-gray-900">{businessName}</dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt>Address</dt>
                  <dd className="text-right text-gray-900">
                    {addressLine1}, {city} {postalCode}, {country}
                  </dd>
                </div>
              </dl>
              {description && <p className="mt-2 text-gray-600">{description}</p>}
            </section>

            <section>
              <h2 className="mb-2 font-medium text-gray-900">Proposed catalog ({products.length})</h2>
              <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                {parsedProducts.map((product, i) => (
                  <li key={products[i].key} className="flex flex-wrap items-center justify-between gap-4 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-gray-900">{product.name}</span>
                    <span className="text-xs text-gray-500">
                      {categories.find((c) => c.id === product.categoryId)?.name ?? "—"}
                    </span>
                    <span className="text-xs text-gray-500">{product.stockQty} in stock</span>
                    <span className="text-gray-900">{formatPrice(product.priceCents)}</span>
                    {product.specifications && <div className="w-full"><ProductSpecifications value={product.specifications} /></div>}
                  </li>
                ))}
              </ul>
            </section>

            {serverError && (
              <p role="alert" className="text-sm text-red-600">
                {serverError}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="ml-auto rounded bg-accent px-6 py-2 text-sm font-medium text-ink hover:bg-accent-dark"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={apply.isPending}
              className="ml-auto rounded bg-accent px-6 py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
            >
              {apply.isPending ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
