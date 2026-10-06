import { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import { EmptyState, Pagination, CategoryIcon } from '../components/ui.jsx'
import { PRODUCTS, CATEGORIES, getProductsByCategory } from '../data/mockData.js'

const PER_PAGE = 20
const SORT_OPTIONS = [
  { value: 'featured',    label: 'Featured' },
  { value: 'price-asc',  label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating',     label: 'Avg. Customer Review' },
  { value: 'newest',     label: 'Newest Arrivals' },
  { value: 'popular',    label: 'Most Popular' },
]

import { api } from '../services/api.js'

export default function SearchPage({ categorySlug }) {
  const [searchParams] = useSearchParams()
  const query          = searchParams.get('q') || ''

  const [sort, setSort]               = useState('featured')
  const [minPrice, setMinPrice]       = useState('')
  const [maxPrice, setMaxPrice]       = useState('')
  const [minRating, setMinRating]     = useState(0)
  const [selectedCats, setSelectedCats] = useState(categorySlug ? [categorySlug] : [])
  const [page, setPage]               = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [products, setProducts]       = useState([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading]         = useState(true)

  const toggleCat = (slug) => {
    setSelectedCats(prev => prev.includes(slug) ? prev.filter(c => c !== slug) : [slug]) // Single category filter for backend compatibility
    setPage(1)
  }

  useEffect(() => {
    setLoading(true);
    const params = {
      page,
      limit: PER_PAGE,
      q: query || undefined,
      sort: sort === 'price-asc' ? 'price_asc' : sort === 'price-desc' ? 'price_desc' : sort === 'rating' ? 'popular' : sort
    };

    if (selectedCats.length > 0) {
      params.categoryId = selectedCats[0];
    }
    if (minPrice) params.minPrice = Number(minPrice);
    if (maxPrice) params.maxPrice = Number(maxPrice);
    if (minRating) params.minRating = Number(minRating);

    api.get('/products', { params })
      .then(res => {
        const list = res.data.products || [];
        const formatted = list.map(p => ({
          ...p,
          price: Number(p.price),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
          rating: p.avgRating || 4.5
        }));
        setProducts(formatted);
        setTotalProducts(res.data.pagination?.total || formatted.length);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [query, selectedCats, minPrice, maxPrice, minRating, sort, page]);

  const totalPages = Math.ceil(totalProducts / PER_PAGE)
  const paginated  = products

  const title = categorySlug
    ? CATEGORIES.find(c => c.slug === categorySlug)?.name || categorySlug
    : query ? `Results for "${query}"` : 'All Products'

  const activeFilters = [
    ...selectedCats.map(c => ({ label: CATEGORIES.find(x => x.slug === c)?.name || c, clear: () => toggleCat(c) })),
    ...(minRating > 0 ? [{ label: `${minRating}★ & up`, clear: () => setMinRating(0) }] : []),
    ...((minPrice || maxPrice) ? [{ label: `$${minPrice || '0'} – $${maxPrice || '∞'}`, clear: () => { setMinPrice(''); setMaxPrice('') } }] : []),
  ]

  return (
    <div className="container page-content">
      {/* Page Title */}
      <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
        {title}
      </h1>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          {activeFilters.map((f, i) => (
            <span key={i} className="chip chip-active" style={{ cursor: 'pointer' }} onClick={f.clear}>
              {f.label} <X size={12} className="chip-remove" />
            </span>
          ))}
        </div>
      )}

      {/* Mobile filter toggle */}
      <button
        className="btn btn-secondary hide-desktop"
        style={{ marginBottom: 'var(--sp-3)' }}
        onClick={() => setShowFilters(v => !v)}
        id="toggle-filters-btn"
      >
        <SlidersHorizontal size={16} /> Filters
      </button>

      <div className="search-layout">
        {/* ── Sidebar ── */}
        <aside className={`filter-sidebar ${showFilters ? '' : 'hide-mobile'}`} aria-label="Product filters">
          {/* Categories */}
          <div className="filter-section">
            <div className="filter-title">Category</div>
            {CATEGORIES.map(cat => (
              <label key={cat.id} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(cat.slug)}
                  onChange={() => toggleCat(cat.slug)}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CategoryIcon slug={cat.slug} size={15} style={{ opacity: 0.7 }} />
                  {cat.name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  ({PRODUCTS.filter(p => p.category === cat.id).length})
                </span>
              </label>
            ))}
          </div>

          {/* Price Range */}
          <div className="filter-section">
            <div className="filter-title">Price</div>
            {[{ label: 'Under $25', min: '', max: '25' }, { label: '$25 – $100', min: '25', max: '100' }, { label: '$100 – $500', min: '100', max: '500' }, { label: 'Over $500', min: '500', max: '' }].map(r => (
              <label key={r.label} className="filter-option">
                <input type="radio" name="price-range" onChange={() => { setMinPrice(r.min); setMaxPrice(r.max); setPage(1) }} checked={minPrice === r.min && maxPrice === r.max} />
                {r.label}
              </label>
            ))}
            <div className="price-range-inputs" style={{ marginTop: 'var(--sp-2)' }}>
              <input className="form-input" type="number" placeholder="Min" value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(1) }} min="0" style={{ maxWidth: 80 }} />
              <span className="price-range-sep">–</span>
              <input className="form-input" type="number" placeholder="Max" value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(1) }} min="0" style={{ maxWidth: 80 }} />
            </div>
          </div>

          {/* Rating */}
          <div className="filter-section">
            <div className="filter-title">Avg. Customer Review</div>
            {[4, 3, 2, 1].map(r => (
              <label key={r} className="filter-option" onClick={() => { setMinRating(minRating === r ? 0 : r); setPage(1) }}>
                <input type="checkbox" checked={minRating === r} readOnly />
                {'★'.repeat(r)}{'☆'.repeat(5 - r)} <span style={{ fontSize: 'var(--font-size-xs)', marginLeft: 4 }}>& Up</span>
              </label>
            ))}
          </div>

          {/* Deals */}
          <div className="filter-section">
            <div className="filter-title">Deals & Discounts</div>
            <label className="filter-option">
              <input type="checkbox" />
              On sale / Reduced price
            </label>
          </div>

          <button className="btn btn-secondary btn-full btn-sm" onClick={() => { setSelectedCats([]); setMinPrice(''); setMaxPrice(''); setMinRating(0); setSort('featured'); setPage(1) }}>
            Clear all filters
          </button>
        </aside>

        {/* ── Results ── */}
        <div>
          <div className="search-header">
            <p className="search-count">
              Showing <strong>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> results
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <label htmlFor="sort-select" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Sort:</label>
              <select id="sort-select" className="sort-select" value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {paginated.length === 0 ? (
            <EmptyState icon="🔍" title="No results found" text={`We couldn't find any products matching "${query}". Try a different search term or clear your filters.`} />
          ) : (
            <>
              <div className="product-grid">
                {paginated.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); window.scrollTo(0, 0) }} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
