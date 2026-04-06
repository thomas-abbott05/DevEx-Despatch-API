import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {ProtectedRoute, PublicOnlyRoute} from './features/auth/ProtectedRoute'
import HomePage from './features/home/pages/HomePage'
import LoginPage from './features/auth/pages/LoginPage'
import RegisterPage from './features/auth/pages/RegisterPage'
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage'
import VerifyCodePage from './features/auth/pages/VerifyCodePage'
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage'
import TermsPage from './features/auth/pages/TermsPage'
import PrivacyPage from './features/auth/pages/PrivacyPage'
import NotFoundPage from './features/auth/pages/NotFoundPage'
import OrdersPage from './features/orders/pages/OrdersPage'
import DespatchPage from './features/despatch/pages/DespatchPage'
import InvoicePage from './features/invoice/pages/InvoicePage'
import UploadOrderPage from './features/orders/pages/UploadOrderPage'
import UploadDespatchPage from './features/despatch/pages/UploadDespatchPage'
import UploadInvoicePage from './features/invoice/pages/UploadInvoicePage'

const ROUTE_TITLES = {
  '/': 'DevEx - Home',
  '/home': 'DevEx - Home',
  '/login': 'DevEx - Login',
  '/register': 'DevEx - Register',
  '/forgot-password': 'DevEx - Forgot Password',
  '/verify': 'DevEx - Verify Code',
  '/reset-password': 'DevEx - Reset Password',
  '/order': 'DevEx - Orders',
  '/order/upload': 'DevEx - Upload Orders',
  '/despatch': 'DevEx - Despatch Advice',
  '/despatch/upload': 'DevEx - Upload Despatch Advice',
  '/invoice': 'DevEx - Invoices',
  '/invoice/upload': 'DevEx - Upload Invoices',
  '/terms': 'DevEx - Terms',
  '/privacy': 'DevEx - Privacy',
}

function resolvePageTitle(pathname) {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname]
  }
  
  if (pathname.startsWith('/order/')) {
    return 'DevEx - Order Details'
  }
  if (pathname.startsWith('/despatch/')) {
    return 'DevEx - Despatch Details'
  }
  if (pathname.startsWith('/invoice/')) {
    return 'DevEx - Invoice Details'
  }
  return 'DevEx - Not Found'
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    document.title = resolvePageTitle(location.pathname)
  }, [location.pathname])

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/verify"
        element={
          <PublicOnlyRoute>
            <VerifyCodePage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/order"
        element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order/upload"
        element={
          <ProtectedRoute>
            <UploadOrderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/despatch"
        element={
          <ProtectedRoute>
            <DespatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/despatch/upload"
        element={
          <ProtectedRoute>
            <UploadDespatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoice"
        element={
          <ProtectedRoute>
            <InvoicePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoice/upload"
        element={
          <ProtectedRoute>
            <UploadInvoicePage />
          </ProtectedRoute>
        }
      />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
