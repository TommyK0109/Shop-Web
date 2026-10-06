import { create } from 'zustand'
import { api } from '../services/api.js'

// ── Cart Store ──────────────────────────────────────────────
export const useCartStore = create((set, get) => ({
  items: [],
  loading: false,

  fetchCart: async () => {
    const isLoggedIn = useAuthStore.getState().isLoggedIn();
    if (!isLoggedIn) {
      const local = localStorage.getItem('guestCart');
      set({ items: local ? JSON.parse(local) : [], loading: false });
      return;
    }
    set({ loading: true });
    try {
      const res = await api.get('/cart');
      const formatted = res.data.map(item => ({
        ...item.product,
        price: Number(item.product.price),
        qty: item.quantity,
        cartItemId: item.id
      }));
      set({ items: formatted, loading: false });
    } catch (err) {
      set({ items: [], loading: false });
    }
  },

  addItem: async (product, qty = 1) => {
    const isLoggedIn = useAuthStore.getState().isLoggedIn();
    if (!isLoggedIn) {
      set(state => {
        const existing = state.items.find(i => i.id === product.id)
        let newItems;
        if (existing) {
          newItems = state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i)
        } else {
          newItems = [...state.items, { ...product, qty }]
        }
        localStorage.setItem('guestCart', JSON.stringify(newItems));
        return { items: newItems };
      });
      return;
    }

    try {
      await api.post('/cart/items', { productId: product.id, quantity: qty });
      await get().fetchCart();
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  },

  removeItem: async (id) => {
    const isLoggedIn = useAuthStore.getState().isLoggedIn();
    if (!isLoggedIn) {
      set(state => {
        const newItems = state.items.filter(i => i.id !== id);
        localStorage.setItem('guestCart', JSON.stringify(newItems));
        return { items: newItems };
      });
      return;
    }

    try {
      await api.delete(`/cart/items/${id}`);
      await get().fetchCart();
    } catch (err) {
      console.error('Failed to remove from cart:', err);
    }
  },

  updateQty: async (id, qty) => {
    if (qty <= 0) { get().removeItem(id); return }

    const isLoggedIn = useAuthStore.getState().isLoggedIn();
    if (!isLoggedIn) {
      set(state => {
        const newItems = state.items.map(i => i.id === id ? { ...i, qty } : i);
        localStorage.setItem('guestCart', JSON.stringify(newItems));
        return { items: newItems };
      });
      return;
    }

    try {
      await api.put(`/cart/items/${id}`, { quantity: qty });
      await get().fetchCart();
    } catch (err) {
      console.error('Failed to update cart qty:', err);
    }
  },

  clearCart: async () => {
    set({ items: [] });
    localStorage.removeItem('guestCart');
  },

  get total()    { return get().items.reduce((s, i) => s + i.price * i.qty, 0) },
  get itemCount(){ return get().items.reduce((s, i) => s + i.qty, 0) },
}))

// ── Auth Store ──────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  user: null,   // null = guest
  role: null,   // 'CUSTOMER' | 'PROVIDER' | 'ADMIN'
  loading: true,

  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ user: null, role: null, loading: false });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      const { user } = res.data;
      set({ user, role: user.role, loading: false });
      
      // Load user cart
      await useCartStore.getState().fetchCart();
    } catch (err) {
      localStorage.removeItem('accessToken');
      set({ user: null, role: null, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('accessToken', token);
      set({ user, role: user.role, loading: false });

      // Fetch user cart
      await useCartStore.getState().fetchCart();
      return user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  registerCustomer: async (email, password, firstName = '', lastName = '') => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/register/customer', { email, password, firstName, lastName });
      const { token, user } = res.data;
      localStorage.setItem('accessToken', token);
      set({ user, role: user.role, loading: false });
      
      await useCartStore.getState().fetchCart();
      return user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  registerProvider: async (email, password, storeName, description = '') => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/register/provider', { email, password, storeName, description });
      const { token, user } = res.data;
      localStorage.setItem('accessToken', token);
      set({ user, role: user.role, loading: false });
      
      await useCartStore.getState().fetchCart();
      return user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    localStorage.removeItem('accessToken');
    set({ user: null, role: null });
    useCartStore.getState().clearCart();
  },

  isLoggedIn: () => !!get().user,
}))

// Listen for global logout event from interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('auth-logout', () => {
    useAuthStore.getState().logout();
  });
}

// ── Wishlist Store ──────────────────────────────────────────
export const useWishlistStore = create((set, get) => ({
  items: [],
  toggle: (product) => {
    const exists = get().items.find(i => i.id === product.id)
    set(state => ({
      items: exists ? state.items.filter(i => i.id !== product.id) : [...state.items, product]
    }))
  },
  isWishlisted: (id) => !!get().items.find(i => i.id === id),
}))

// ── Toast Store ─────────────────────────────────────────────
export const useToastStore = create((set, get) => ({
  toasts: [],
  show: (message, type = 'default') => {
    const id = Date.now()
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => get().remove(id), 3000)
  },
  remove: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))

// ── Search Store ────────────────────────────────────────────
export const useSearchStore = create((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
}))
