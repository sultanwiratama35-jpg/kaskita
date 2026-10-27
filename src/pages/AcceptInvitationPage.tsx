import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/utils';
import { useOrganization } from '../contexts/OrganizationContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user } = useAuth();
  const { reloadOrganizations, switchOrganization } = useOrganization();
  const navigate = useNavigate();
  const started = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Memeriksa undangan...');
  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    let mounted = true;
    const accept = async () => {
      if (!token) { setStatus('error'); setMessage('Token undangan tidak ditemukan.'); return; }
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (!mounted) return;
      if (error) { setStatus('error'); setMessage(errorMessage(error, 'Undangan tidak dapat diterima.')); return; }
      await reloadOrganizations();
      if (data) switchOrganization(data as string);
      setStatus('success'); setMessage('Undangan berhasil diterima. Anda sekarang menjadi anggota organisasi.');
      toast.success('Undangan organisasi berhasil diterima.');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    };
    void accept();
    return () => { mounted = false; };
  }, [user?.id, token]);

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><Card className="w-full max-w-lg"><CardContent className="p-8 text-center">{status === 'loading' ? <LoaderCircle className="mx-auto animate-spin text-indigo-600" size={36} /> : status === 'success' ? <CheckCircle2 className="mx-auto text-emerald-600" size={40} /> : <MailCheck className="mx-auto text-amber-600" size={40} />}<h1 className="mt-5 text-xl font-extrabold text-slate-950">{status === 'success' ? 'Undangan diterima' : status === 'error' ? 'Undangan belum dapat diterima' : 'Memproses undangan'}</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{message}</p>{status === 'error' && <div className="mt-6 flex justify-center gap-2"><Link to="/organizations"><Button variant="outline">Ke organisasi</Button></Link><Link to="/login"><Button>Masuk</Button></Link></div>}</CardContent></Card></div>;
}
