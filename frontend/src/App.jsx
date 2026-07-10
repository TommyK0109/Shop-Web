import { Routes, Route, useParams } from 'react-router-dom'
import Header from './components/Header.jsx'
import { ToastContainer } from './components/ui.jsx'

import HomePage         from './pages/HomePage.jsx'
import SearchPage       from './pages/SearchPage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import CartPage         from './pages/CartPage.jsx'
import CheckoutPage     from './pages/CheckoutPage.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import {
  AccountPage, OrdersPage, OrderDetailPage, WishlistPage,
} from './pages/AccountPages.jsx'
import {
  ProviderDashboard, ProviderProducts, ProviderOrders,
} from './pages/ProviderPages.jsx'
import {
  AdminDashboard, AdminApplications, AdminUsers,
  AdminMLDashboard, AdminProducts,
} from './pages/AdminPages.jsx'

// Category page wrapper — passes slug to SearchPage
function CategoryPage() {
  const { slug } = useParams()
  return <SearchPage categorySlug={slug} />
}

// Pages that use the main Header layout
function WithHeader({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  )
}

import { useEffect } from 'react'
import { useAuthStore } from './stores/index.js'

export default function App() {
  const initializeAuth = useAuthStore(state => state.initialize)
  const authLoading = useAuthStore(state => state.loading)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAEDED', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#FF9900', marginBottom: 10 }}>ShopSmart</div>
          <div style={{ color: '#565959', fontSize: 14 }}>Connecting to secure session...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* ── Public / Customer Routes ── */}
        <Route path="/" element={<WithHeader><HomePage /></WithHeader>} />
        <Route path="/search" element={<WithHeader><SearchPage /></WithHeader>} />
        <Route path="/category/:slug" element={<WithHeader><CategoryPage /></WithHeader>} />
        <Route path="/product/:id" element={<WithHeader><ProductDetailPage /></WithHeader>} />
        <Route path="/cart" element={<WithHeader><CartPage /></WithHeader>} />
        <Route path="/checkout" element={<WithHeader><CheckoutPage /></WithHeader>} />
        <Route path="/deals" element={<WithHeader><SearchPage /></WithHeader>} />
        <Route path="/recommendations" element={<WithHeader><SearchPage /></WithHeader>} />

        {/* ── Auth ── */}
        <Route path="/login"             element={<LoginPage />} />
        <Route path="/register"          element={<RegisterPage />} />
        <Route path="/register/provider" element={<RegisterPage isProvider />} />

        {/* ── Customer Account ── */}
        <Route path="/account"              element={<WithHeader><AccountPage /></WithHeader>} />
        <Route path="/account/orders"       element={<WithHeader><OrdersPage /></WithHeader>} />
        <Route path="/account/orders/:id"   element={<WithHeader><OrderDetailPage /></WithHeader>} />
        <Route path="/account/wishlist"     element={<WithHeader><WishlistPage /></WithHeader>} />
        <Route path="/account/addresses"    element={<WithHeader><AccountPage /></WithHeader>} />
        <Route path="/account/settings"     element={<WithHeader><AccountPage /></WithHeader>} />

        {/* ── Provider Portal ── */}
        <Route path="/provider"            element={<ProviderDashboard />} />
        <Route path="/provider/products"   element={<ProviderProducts />} />
        <Route path="/provider/orders"     element={<ProviderOrders />} />
        <Route path="/provider/analytics"  element={<ProviderDashboard />} />

        {/* ── Admin Dashboard ── */}
        <Route path="/admin"               element={<AdminDashboard />} />
        <Route path="/admin/applications"  element={<AdminApplications />} />
        <Route path="/admin/users"         element={<AdminUsers />} />
        <Route path="/admin/products"      element={<AdminProducts />} />
        <Route path="/admin/orders"        element={<AdminDashboard />} />
        <Route path="/admin/ml"            element={<AdminMLDashboard />} />
        <Route path="/admin/analytics"     element={<AdminDashboard />} />
        <Route path="/admin/settings"      element={<AdminDashboard />} />

        {/* ── 404 ── */}
        <Route path="*" element={
          <WithHeader>
            <div className="container page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{ fontSize: 80 }}>🔍</div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '16px 0 8px' }}>Page Not Found</h1>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>Sorry, we couldn't find that page.</p>
              <a href="/" className="btn btn-primary btn-lg">Go to Homepage</a>
            </div>
          </WithHeader>
        } />
      </Routes>

      {/* Global Toast Notifications */}
      <ToastContainer />
    </>
  )
}
