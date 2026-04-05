import { Navigate, Route, Routes } from 'react-router-dom'
import {ProtectedRoute, PublicOnlyRoute} from '../features/auth/ProtectedRoute'
import HomePage from '../features/auth/pages/HomePage'
import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
import VerifyCodePage from '../features/auth/pages/VerifyCodePage'
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage'
import TermsPage from '../features/auth/pages/TermsPage'
import PrivacyPage from '../features/auth/pages/PrivacyPage'
import NotFoundPage from '../features/auth/pages/NotFoundPage'

export default function App() {
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
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
