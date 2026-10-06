# Storefront client

The shopping frontend uses React, TypeScript, Vite, TanStack Query, and Zustand.

The responsive landing page includes category browsing, product search with keyboard-accessible suggestions, product cards with quick cart actions, sign-in and registration pages, a signed-in profile menu, and a cart drawer with quantity controls and checkout navigation.

## Run locally

From the repository root:

```sh
npm ci
npm run dev --workspace client
```

The client uses `http://localhost:5201/api` by default. Set `VITE_API_URL` in `client/.env` to use another API. Start the backend using the setup instructions in the [project README](../README.md) to load real products and use authentication, profiles, and carts.

The landing page does not substitute demo products or simulated authentication when the API is unavailable. It provides loading, empty, and retry states. Guest cart actions lead to sign-in; signed-in carts use the existing server API.

## Verify

```sh
npm run build --workspace client
npm run test --workspace client
npm run lint --workspace client
```

`Storefront.spec.tsx` covers registration and login redirects, the signed-in account menu, category filtering, cart actions, logout, and cart keyboard navigation. Existing search, cart, checkout, and assistant tests remain in place.

Department and hero photography is bundled under `public/images`; image sources are listed in [images/README.md](public/images/README.md). Asset paths respect Vite's configured base URL.
