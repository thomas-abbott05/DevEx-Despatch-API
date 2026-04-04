import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../features/auth/ProtectedRoute'
import PublicOnlyRoute from '../features/auth/PublicOnlyRoute'
import HomePage from '../features/auth/pages/HomePage'
import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
