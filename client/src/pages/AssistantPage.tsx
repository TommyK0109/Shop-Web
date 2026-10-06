import { type FormEvent, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ragRequestSchema, type RagFilters, type RagRequest, type RagResponse } from "@storefront/shared";
import { useCategories } from "../hooks/useCategories";
import { useRag, useRagCapabilities } from "../hooks/useRag";
import { AssistantAnswer } from "../components/AssistantAnswer";
import { centsToPriceInput, parsePriceToCents } from "../lib/format";

export function AssistantPage() {
  const [params] = useSearchParams();
  const initialId = params.get("productId");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RagRequest["mode"]>(initialId ? "product" : "recommend");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialId ? [initialId] : []);
  const [names, setNames] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [resolvedFilters, setResolvedFilters] = useState<RagFilters>({ currency: "USD" });
  const [history, setHistory] = useState<RagRequest["history"]>([]);
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [responseMode, setResponseMode] = useState<RagRequest["mode"]>("recommend");
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [lastRequest, setLastRequest] = useState<RagRequest | null>(null);
  const sequence = useRef(0);
  const capabilities = useRagCapabilities();
  const categories = useCategories();
  const rag = useRag();

  function cancel() {
    sequence.current += 1;
    rag.cancel();
    setCancelled(true);
  }

  async function send(request: RagRequest) {
    const currentSequence = ++sequence.current;
    setError(null);
    setCancelled(false);
    setLastRequest(request);
    try {
      const result = await rag.mutateAsync({ request, generate: capabilities.data?.generationEnabled ?? false });
      if (sequence.current !== currentSequence) return;
      setResponse(result);
      setResponseMode(request.mode);
      setNames((previous) => ({ ...previous, ...Object.fromEntries(result.products.map((product) => [product.id, product.name])) }));
      setCategory(result.filters.categorySlug ?? "");
      setResolvedFilters(result.filters);
      setBudget(result.filters.maxPriceCents === undefined ? "" : centsToPriceInput(result.filters.maxPriceCents));
      const context = result.answer?.followUpQuestion || result.answer?.intro || `Found ${result.products.length} listings.`;
      const nextHistory = [...request.history, { role: "user" as const, content: request.query }, { role: "assistant" as const, content: context.slice(0, 2000) }].slice(-6);
      while (nextHistory.reduce((total, message) => total + message.content.length, 0) > 8000) nextHistory.shift();
      setHistory(nextHistory);
    } catch (cause) {
      if (sequence.current !== currentSequence || (cause instanceof Error && cause.name === "AbortError")) return;
      setError(cause instanceof Error ? cause.message : "The assistant could not complete this request.");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const maxPriceCents = budget.trim() ? parsePriceToCents(budget) : undefined;
    if (maxPriceCents === null) { setError("Enter a budget in USD, such as 50.00."); return; }
    const filters: RagFilters = { ...resolvedFilters, currency: "USD", purchasableOnly: mode === "recommend" };
    if (category) filters.categorySlug = category;
    else delete filters.categorySlug;
    if (maxPriceCents !== undefined) filters.maxPriceCents = maxPriceCents;
    else delete filters.maxPriceCents;
    const parsed = ragRequestSchema.safeParse({ query, mode, productIds: mode === "recommend" ? [] : selectedIds, filters, history });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your question and selections."); return; }
    void send(parsed.data);
  }

  function toggle(id: string) {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : previous.length < 3 ? [...previous, id] : previous);
  }

  const enabled = capabilities.data?.enabled === true;
  const inputClass = "mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm";
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-semibold text-gray-900">Shopping assistant</h1><p className="mt-1 text-sm text-gray-600">Find products, ask about a listing, or compare documented details. Budgets are in USD.</p></header>
    {capabilities.isPending && <p role="status">Checking assistant availability…</p>}
    {capabilities.isError && <p role="alert" className="text-sm text-red-700">The assistant is unavailable. You can still browse and search the catalog.</p>}
    {capabilities.data && !enabled && <p className="rounded bg-gray-100 p-4 text-sm">The shopping assistant is currently disabled. You can still browse and search the catalog.</p>}
    {enabled && <>
      {!capabilities.data?.generationEnabled && <p className="rounded bg-blue-50 p-3 text-sm text-gray-700">Search-only mode: discover listings and compare their specifications. Generated answers are currently off.</p>}
      <form onSubmit={submit} className="space-y-4 rounded bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium">Your question<textarea rows={3} maxLength={2000} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "product" ? "Does this listing document a built-in microphone?" : "Find wireless headphones under $50 for online meetings"} className={inputClass} required disabled={rag.isPending} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Mode<select value={mode} onChange={(event) => setMode(event.target.value as RagRequest["mode"])} className={inputClass} disabled={rag.isPending}><option value="recommend">Find products</option><option value="product">Ask about one product</option><option value="compare">Compare 2–3 products</option></select></label>
          <label className="text-sm">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} disabled={rag.isPending}><option value="">All categories</option>{categories.data?.categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label className="text-sm">Maximum budget (USD)<input inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="No maximum" className={inputClass} disabled={rag.isPending} /></label>
        </div>
        {(resolvedFilters.minPriceCents !== undefined || resolvedFilters.sellerId) && <div className="flex flex-wrap gap-2 text-xs" aria-label="Additional filters">{resolvedFilters.minPriceCents !== undefined && <button type="button" className="rounded-full bg-gray-100 px-3 py-1" onClick={() => setResolvedFilters(({ minPriceCents: _removed, ...rest }) => rest)}>Minimum ${centsToPriceInput(resolvedFilters.minPriceCents)} ×</button>}{resolvedFilters.sellerId && <button type="button" className="rounded-full bg-gray-100 px-3 py-1" onClick={() => setResolvedFilters(({ sellerId: _removed, ...rest }) => rest)}>Selected store ×</button>}</div>}
        {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Selected products"><span>Selected:</span>{selectedIds.map((id) => <button key={id} type="button" disabled={rag.isPending} onClick={() => toggle(id)} className="rounded-full bg-gray-100 px-3 py-1" aria-label={`Remove ${names[id] ?? "selected product"}`}>{names[id] ?? "Selected listing"} ×</button>)}</div>}
        {mode !== "recommend" && <p className="text-xs text-gray-500">{mode === "product" ? "Select exactly one listing, or use “Ask about this product” on a product page." : "Select two or three listings using the Compare checkboxes in your results."}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={rag.isPending} className="rounded bg-accent px-5 py-2 text-sm font-medium text-ink disabled:opacity-60">{rag.isPending ? "Working…" : capabilities.data?.generationEnabled ? "Ask assistant" : "Search listings"}</button>
          {rag.isPending && <button type="button" onClick={cancel} className="text-sm text-link underline">Cancel request</button>}
          <button type="button" disabled={rag.isPending} onClick={() => { setHistory([]); setResponse(null); setSelectedIds([]); setMode("recommend"); setQuery(""); setCategory(""); setBudget(""); setResolvedFilters({ currency: "USD" }); setError(null); setCancelled(false); setLastRequest(null); }} className="text-sm text-gray-600 underline">Start over</button>
        </div>
        {rag.isPending && !cancelled && <p role="status" className="text-sm text-gray-500">Checking current listings…</p>}
        {cancelled && <p role="status" className="text-sm text-gray-500">Request cancelled.</p>}
        {error && <div role="alert" className="text-sm text-red-700">{error}{lastRequest && !rag.isPending && <button type="button" className="ml-3 underline" onClick={() => void send(lastRequest)}>Retry request</button>}</div>}
      </form>
      {response && <><div className="flex flex-wrap gap-2 text-xs text-gray-600" aria-label="Applied filters"><span className="rounded-full bg-gray-100 px-3 py-1">USD</span>{response.filters.categorySlug && <span className="rounded-full bg-gray-100 px-3 py-1">{response.filters.categorySlug}</span>}{response.filters.maxPriceCents !== undefined && <span className="rounded-full bg-gray-100 px-3 py-1">Up to ${centsToPriceInput(response.filters.maxPriceCents)}</span>}{response.filters.purchasableOnly && <span className="rounded-full bg-gray-100 px-3 py-1">Available to buy</span>}</div><AssistantAnswer response={response} selectedIds={selectedIds} onToggle={toggle} comparison={responseMode === "compare"} /></>}
    </>}
  </div>;
}
