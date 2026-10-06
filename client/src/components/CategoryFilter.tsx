import { useCategories } from "../hooks/useCategories";

interface CategoryFilterProps {
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function CategoryFilter({ activeSlug, onSelect }: CategoryFilterProps) {
  const { data, isLoading } = useCategories();

  return (
    <aside className="w-full shrink-0 md:w-48">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">Category</h2>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <ul className="space-y-1 text-sm">
          <li>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`hover:underline ${activeSlug === null ? "font-semibold text-ink" : "text-link"}`}
            >
              All categories
            </button>
          </li>
          {data?.categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelect(category.slug)}
                className={`hover:underline ${activeSlug === category.slug ? "font-semibold text-ink" : "text-link"}`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
