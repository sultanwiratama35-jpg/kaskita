import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loading } from './Loading';
import { isSupabaseConfigured } from '../lib/supabase';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!isSupabaseConfigured) return <Navigate to="/login?setup=1" replace />;
  if (loading) return <Loading label="Memeriksa sesi..." />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
