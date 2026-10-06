import { type FormEvent, useState } from "react";
import { createCategorySchema } from "@storefront/shared";
import { useCategories } from "../../hooks/useCategories";
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from "../../hooks/useAdmin";
import type { Category } from "../../api/types";

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsed = createCategorySchema.safeParse({ name: name.trim() });
    if (!parsed.success) return;
    updateCategory.mutate({ id: category.id, name: parsed.data.name }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {editing ? (
        <form onSubmit={handleSave} className="flex flex-1 items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Rename ${category.name}`}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark"
          />
          <button
            type="submit"
            disabled={updateCategory.isPending}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(category.name);
              setEditing(false);
            }}
            className="text-xs text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm text-gray-900">{category.name}</p>
            <p className="text-xs text-gray-400">/{category.slug}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-link hover:underline">
            Rename
          </button>
          <button
            type="button"
            disabled={deleteCategory.isPending}
            onClick={() => deleteCategory.mutate(category.id)}
            className="text-xs text-red-600 hover:underline disabled:opacity-60"
          >
            Delete
          </button>
        </>
      )}

      {(updateCategory.isError || deleteCategory.isError) && (
        <span role="alert" className="text-xs text-red-600">
          {((updateCategory.error ?? deleteCategory.error) as Error).message}
        </span>
      )}
    </li>
  );
}

export function AdminCategoriesPage() {
  const { data, isLoading } = useCategories();
  const [newName, setNewName] = useState("");
  const createCategory = useCreateCategory();

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const parsed = createCategorySchema.safeParse({ name: newName.trim() });
    if (!parsed.success) return;
    createCategory.mutate(parsed.data.name, { onSuccess: () => setNewName("") });
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleCreate} className="mb-4 flex gap-2 rounded bg-white p-4 shadow-sm">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-dark"
        />
        <button
          type="submit"
          disabled={createCategory.isPending || !newName.trim()}
          className="rounded bg-accent px-5 py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
        >
          {createCategory.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {createCategory.isError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {(createCategory.error as Error).message}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading categories…</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded bg-white shadow-sm">
          {data?.categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-gray-500">
        A category that still has products can't be deleted — the server rejects it with a 409 rather than
        orphaning the rows.
      </p>
    </div>
  );
}
