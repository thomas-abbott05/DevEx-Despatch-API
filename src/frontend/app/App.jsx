import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {ProtectedRoute, PublicOnlyRoute} from '../features/auth/ProtectedRoute'
import HomePage from '../features/home/pages/HomePage'
import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
import VerifyCodePage from '../features/auth/pages/VerifyCodePage'
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage'
import TermsPage from '../features/auth/pages/TermsPage'
import PrivacyPage from '../features/auth/pages/PrivacyPage'
import NotFoundPage from '../features/auth/pages/NotFoundPage'
import OrdersPage from '../features/orders/pages/OrdersPage'
import DespatchPage from '../features/despatch/pages/DespatchPage'
import InvoicePage from '../features/invoice/pages/InvoicePage'
import UploadOrderPage from '../features/orders/pages/UploadOrderPage'
import UploadDespatchPage from '../features/despatch/pages/UploadDespatchPage'
import UploadInvoicePage from '../features/invoice/pages/UploadInvoicePage'

function resolvePageTitle(pathname) {
  if (pathname === '/' || pathname === '/home') {
    return 'DevEx - Home'
  }

  if (pathname === '/login') {
    return 'DevEx - Login'
  }

  if (pathname === '/register') {
    return 'DevEx - Register'
  }

  if (pathname === '/forgot-password') {
    return 'DevEx - Forgot Password'
  }

  if (pathname === '/verify') {
    return 'DevEx - Verify Code'
  }

  if (pathname === '/reset-password') {
    return 'DevEx - Reset Password'
  }

  if (pathname === '/order') {
    return 'DevEx - Orders'
  }

  if (pathname === '/order/upload') {
    return 'DevEx - Upload Orders'
  }

  if (pathname.startsWith('/order/')) {
    return 'DevEx - Order Details'
  }

  if (pathname === '/despatch') {
    return 'DevEx - Despatch Advice'
  }

  if (pathname === '/despatch/upload') {
    return 'DevEx - Upload Despatch Advice'
  }

  if (pathname.startsWith('/despatch/')) {
    return 'DevEx - Despatch Details'
  }

  if (pathname === '/invoice') {
    return 'DevEx - Invoices'
  }

  if (pathname === '/invoice/upload') {
    return 'DevEx - Upload Invoices'
  }

  if (pathname.startsWith('/invoice/')) {
    return 'DevEx - Invoice Details'
  }

  if (pathname === '/terms') {
    return 'DevEx - Terms'
  }

  if (pathname === '/privacy') {
    return 'DevEx - Privacy'
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
