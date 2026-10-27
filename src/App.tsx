import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionFormPage } from './pages/TransactionFormPage';
import { ContributionsPage } from './pages/ContributionsPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { MembersPage } from './pages/MembersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { AdminPage } from './pages/AdminPage';
import { Button } from './components/ui/button';

function NotFoundPage() {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 text-center"><div className="text-7xl font-extrabold tracking-tight text-indigo-600">404</div><h1 className="mt-4 text-2xl font-bold text-slate-950">Halaman tidak ditemukan</h1><p className="mt-2 text-sm text-slate-500">Alamat yang Anda buka tidak tersedia.</p><Link to="/"><Button className="mt-6">Kembali ke beranda</Button></Link></div>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><OrganizationProvider><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/new" element={<TransactionFormPage />} />
        <Route path="/transactions/:id/edit" element={<TransactionFormPage />} />
        <Route path="/contributions" element={<ContributionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></OrganizationProvider></AuthProvider></BrowserRouter>;
}
