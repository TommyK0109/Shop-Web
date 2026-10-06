import { Link, useSearchParams } from "react-router-dom";
import { useRagCapabilities } from "../hooks/useRag";
import { useProducts } from "../hooks/useProducts";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "../hooks/useAuth";
import { ProductCard } from "../components/ProductCard";
import { Pagination } from "../components/Pagination";
import { Icon } from "../components/Icon";
import { departments, shopImage } from "../lib/storefront";

const PAGE_SIZE = 12;

export function HomePage() {
  const { data: ragCapabilities } = useRagCapabilities();
  const { isAuthenticated } = useAuth();
  const { data: categoryData } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search")?.trim() || undefined;
  const categorySlug = searchParams.get("category") || undefined;
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const { data, isLoading, isError, isFetching, refetch } = useProducts({
    search,
    categorySlug,
    page,
    limit: PAGE_SIZE,
  });
  const filtered = Boolean(search || categorySlug);
  const categories = categoryData?.categories ?? departments;
  const activeCategory =
    categories.find((category) => category.slug === categorySlug)?.name ??
    categorySlug?.replaceAll("-", " ");

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    setSearchParams(params);
  }

  return (
    <>
      {!filtered && (
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> THE EVERYDAY EDIT
            </span>
            <h1 id="hero-title">
              Little things.
              <br />
              <span>Big happiness.</span>
            </h1>
            <p>
              Discover your next favorite thing. Thoughtful finds for your home,
              your style, and everything in between.
            </p>
            <div className="hero-actions">
              <a href="#products" className="button button-dark">
                Explore the collection{" "}
                <Icon name="arrow" width="18" height="18" />
              </a>
              <a href="#categories" className="hero-secondary">
                Find your thing <Icon name="arrowUp" width="16" height="16" />
              </a>
            </div>
            <div className="hero-note">
              <span className="hero-note-icons">
                <Icon name="heart" width="14" height="14" />
                <Icon name="sparkle" width="14" height="14" />
                <Icon name="bag" width="14" height="14" />
              </span>
              <span>Small discoveries. Everyday joy.</span>
            </div>
          </div>
          <div className="hero-art">
            <span className="hero-orbit orbit-one" />
            <span className="hero-orbit orbit-two" />
            <Link
              to="/?category=home-kitchen#products"
              className="hero-photo hero-photo-home"
            >
              <img
                src={shopImage("home")}
                alt="A thoughtfully styled living room with comfortable furnishings"
                fetchPriority="high"
              />
              <span>
                Make room for good things{" "}
                <Icon name="arrowUp" width="15" height="15" />
              </span>
            </Link>
            <Link
              to="/?category=electronics#products"
              className="hero-photo hero-photo-headphones"
            >
              <img
                src={shopImage("headphones")}
                alt="Black wireless headphones on a clean white desk"
              />
              <span>
                Find your everyday rhythm{" "}
                <Icon name="arrowUp" width="14" height="14" />
              </span>
            </Link>
            <span className="hero-sticker">
              <Icon name="sparkle" width="23" height="23" />
              <span>
                YOUR NEXT
                <br />
                GOOD FIND
              </span>
            </span>
            <div className="hero-floating-note">
              <span className="floating-check">
                <Icon name="check" width="16" height="16" />
              </span>
              <div>
                <strong>A little something for you.</strong>
                <span>Go on, take a look around.</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section
        className="benefits"
        id="why-storefront"
        aria-label="Why shop with Storefront"
      >
        <div>
          <span className="benefit-icon">
            <Icon name="store" width="23" height="23" />
          </span>
          <div>
            <strong>One place. So many finds.</strong>
            <p>Explore independent stores together.</p>
          </div>
        </div>
        <div>
          <span className="benefit-icon">
            <Icon name="shield" width="23" height="23" />
          </span>
          <div>
            <strong>Your account, your space.</strong>
            <p>Keep your cart and orders in one place.</p>
          </div>
        </div>
        <div>
          <span className="benefit-icon">
            <Icon name="heart" width="23" height="23" />
          </span>
          <div>
            <strong>Something for every day.</strong>
            <p>From little essentials to new favorites.</p>
          </div>
        </div>
      </section>

      {!filtered && (
        <section
          className="category-section"
          id="categories"
          aria-labelledby="category-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">A WORLD OF POSSIBILITIES</span>
              <h2 id="category-title">What’s your thing?</h2>
            </div>
            <a href="#products" className="text-link">
              Explore everything <Icon name="arrow" width="16" height="16" />
            </a>
          </div>
          <div className="department-grid">
            {departments.map((category) => (
              <Link
                to={`/?category=${category.slug}#products`}
                key={category.slug}
                className={`department-card department-${category.color}`}
              >
                <div className="department-image">
                  <img src={shopImage(category.image)} alt="" loading="lazy" />
                  <span className="department-arrow">
                    <Icon name="arrowUp" width="17" height="17" />
                  </span>
                </div>
                <h3>
                  {category.name
                    .replace(" & Personal Care", "")
                    .replace(" & Outdoors", "")}
                </h3>
                <p>{category.caption}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section
        className="products-section"
        id="products"
        aria-labelledby="products-title"
        aria-busy={isFetching}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {filtered
                ? "FIND YOUR NEXT FAVORITE"
                : "THE GOOD STUFF, ALL IN ONE PLACE"}
            </span>
            <h2 id="products-title">
              {search ? (
                <>Results for “{search}”</>
              ) : (
                activeCategory || "A few things you’ll love"
              )}
            </h2>
            <p>
              {filtered
                ? `${data?.pagination.total ?? "Finding"} matching products`
                : "Fresh discoveries from the stores on our marketplace."}
            </p>
          </div>
          {filtered ? (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                updateParams({ search: null, category: null, page: null })
              }
            >
              Clear filters <Icon name="close" width="16" height="16" />
            </button>
          ) : (
            <span className="collection-label">
              <Icon name="sparkle" width="15" height="15" /> Your everyday,
              upgraded
            </span>
          )}
        </div>
        <div className="product-tabs" aria-label="Filter products by category">
          <button
            type="button"
            className={!categorySlug ? "selected" : ""}
            aria-pressed={!categorySlug}
            onClick={() => updateParams({ category: null, page: null })}
          >
            All finds
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.slug}
              className={categorySlug === category.slug ? "selected" : ""}
              aria-pressed={categorySlug === category.slug}
              onClick={() =>
                updateParams({ category: category.slug, page: null })
              }
            >
              {category.name}
            </button>
          ))}
        </div>
        {ragCapabilities?.enabled && (
          <div className="assistant-callout">
            <Icon name="sparkle" />
            <span>
              Shopping for a specific need?{" "}
              <Link to="/assistant">
                Ask your shopping assistant{" "}
                <Icon name="arrow" width="15" height="15" />
              </Link>
            </span>
          </div>
        )}
        {isLoading && (
          <div
            className="product-grid"
            role="status"
            aria-label="Loading products"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div className="product-skeleton" key={i}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {isError && (
          <div className="catalog-state" role="alert">
            <span className="state-icon">
              <Icon name="box" width="28" height="28" />
            </span>
            <h3>Our finds are taking a little longer.</h3>
            <p>
              We couldn’t load the collection. Please try again in a moment.
            </p>
            <button
              type="button"
              className="button button-dark"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Trying again…" : "Try again"}
              <Icon name="arrow" width="16" height="16" />
            </button>
          </div>
        )}
        {!isError && data?.products.length === 0 && (
          <div className="catalog-state" role="status">
            <span className="state-icon">
              <Icon name="search" width="28" height="28" />
            </span>
            <h3>
              {filtered
                ? "No finds just yet."
                : "Good things are on their way."}
            </h3>
            <p>
              {filtered
                ? "Try another search or explore a different category."
                : "Our stores haven’t added products yet. Come back soon for new discoveries."}
            </p>
            {filtered && (
              <button
                type="button"
                className="button button-dark"
                onClick={() =>
                  updateParams({ search: null, category: null, page: null })
                }
              >
                Explore all products{" "}
                <Icon name="arrow" width="16" height="16" />
              </button>
            )}
          </div>
        )}
        {!isError && data && data.products.length > 0 && (
          <>
            <div className="product-grid">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={(nextPage) => {
                updateParams({ page: String(nextPage) });
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </>
        )}
      </section>

      {!filtered && (
        <section className="join-banner">
          <div>
            <span className="eyebrow">
              {isAuthenticated
                ? "THERE’S MORE TO DISCOVER"
                : "MAKE YOURSELF AT HOME"}
            </span>
            <h2>
              {isAuthenticated
                ? "Your next favorite is out there."
                : "Good finds are better together."}
            </h2>
            <p>
              {isAuthenticated
                ? "Discover a new store, find a new favorite, or share something of your own."
                : "Create an account to keep your finds in one place and make shopping a little more you."}
            </p>
          </div>
          <Link
            to={isAuthenticated ? "/seller/apply" : "/register"}
            className="button button-dark"
          >
            {isAuthenticated ? "Start your own store" : "Join the neighborhood"}
            <Icon name="arrow" width="18" height="18" />
          </Link>
          <Icon name="sparkle" className="join-sparkle" />
        </section>
      )}
    </>
  );
}
