import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useProductSuggestions } from "../hooks/useProducts";
import { formatPrice } from "../lib/format";

export function ProductSearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const term = search.trim();
  const debouncedTerm = useDebouncedValue(term, 250);
  const isDebouncing = term !== debouncedTerm;
  const { data, isPending, isFetching, isError, isPlaceholderData } =
    useProductSuggestions(isOpen ? debouncedTerm : "");
  const suggestions =
    !isDebouncing && !isPlaceholderData && !isError
      ? (data?.products ?? [])
      : [];
  const showDropdown = isOpen && term.length > 0;
  const isSearching = isDebouncing || isPending || isPlaceholderData;
  const activeSuggestion = showDropdown
    ? suggestions[highlightedIndex]
    : undefined;

  useEffect(() => {
    setSearch(urlSearch);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [location.key, urlSearch]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [data]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function goToSearchResults() {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    setSearch(term);
    setIsOpen(false);
    navigate(params.size ? `/?${params.toString()}` : "/");
  }

  function selectSuggestion(slug: string) {
    setIsOpen(false);
    navigate(`/products/${slug}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goToSearchResults();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    if (!showDropdown || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion.slug);
    }
  }

  return (
    <div
      ref={containerRef}
      className="search-shell"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setIsOpen(false);
      }}
    >
      <form
        role="search"
        aria-label="Product search"
        onSubmit={handleSubmit}
        className="search-form"
      >
        <button type="submit" aria-label="Search" className="search-submit">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <circle cx="10.75" cy="10.75" r="7.25" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search products"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={
            activeSuggestion ? `${listboxId}-${activeSuggestion.id}` : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search for your next favorite thing..."
          className="search-input"
        />
        {search.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearch("");
              setIsOpen(false);
              setHighlightedIndex(-1);
              inputRef.current?.focus();
            }}
            className="search-clear"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white text-ink shadow-xl">
          <p className="px-4 pt-3 pb-2 text-xs font-semibold tracking-wide text-gray-500">
            Products
          </p>
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Product suggestions"
            aria-busy={isSearching || isFetching}
            className="max-h-80 overflow-y-auto"
          >
            {suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`${listboxId}-${product.id}`}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(product.slug)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/15 ${index === highlightedIndex ? "bg-accent/15" : ""}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {product.images[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-gray-400"
                      >
                        <path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {product.name}
                  </span>
                  <span className="shrink-0 font-semibold text-gray-600">
                    {formatPrice(product.priceCents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {suggestions.length === 0 && (
            <p role="status" className="px-4 pt-1 pb-4 text-sm text-gray-500">
              {isSearching ? (
                "Searching..."
              ) : isError ? (
                "Suggestions are unavailable. Press Enter to search."
              ) : (
                <>No products found for &quot;{term}&quot;.</>
              )}
            </p>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={goToSearchResults}
            className="flex w-full cursor-pointer items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-link hover:bg-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-link"
          >
            <span className="truncate">
              See all results for &quot;{term}&quot;
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
