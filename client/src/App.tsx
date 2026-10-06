import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { SellerRoute } from "./components/SellerRoute";
import { useAuthBootstrap } from "./hooks/useAuth";
import { HomePage } from "./pages/HomePage";
import { AssistantPage } from "./pages/AssistantPage";
import { ProductPage } from "./pages/ProductPage";
import { SellerPage } from "./pages/SellerPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AccountPage } from "./pages/AccountPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage";
import { SellerApplyPage } from "./pages/Seller/SellerApplyPage";
import { SellerLayout } from "./pages/Seller/SellerLayout";
import { SellerProductsPage } from "./pages/Seller/SellerProductsPage";
import { SellerOrdersPage } from "./pages/Seller/SellerOrdersPage";
import { SellerPaymentsPage } from "./pages/Seller/SellerPaymentsPage";
import { AdminLayout } from "./pages/Admin/AdminLayout";
import { AdminOrdersPage } from "./pages/Admin/AdminOrdersPage";
import { AdminProductsPage } from "./pages/Admin/AdminProductsPage";
import { AdminCategoriesPage } from "./pages/Admin/AdminCategoriesPage";
import { AdminSellersPage } from "./pages/Admin/AdminSellersPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products/:slug" element={<ProductPage />} />
        <Route path="sellers/:slug" element={<SellerPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderConfirmationPage />} />

          {/* Applying is open to any signed-in user; the dashboard behind it
              needs an actual Seller row, which SellerRoute checks. */}
          <Route path="seller/apply" element={<SellerApplyPage />} />
          <Route element={<SellerRoute />}>
            <Route path="seller" element={<SellerLayout />}>
              <Route index element={<Navigate to="/seller/products" replace />} />
              <Route path="products" element={<SellerProductsPage />} />
              <Route path="orders" element={<SellerOrdersPage />} />
              <Route path="payments" element={<SellerPaymentsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RoleRoute roles={["admin"]} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/sellers" replace />} />
            <Route path="sellers" element={<AdminSellersPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
