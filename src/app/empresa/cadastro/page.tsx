import Link from 'next/link';
import { Tv } from 'lucide-react';
import { CompanySignupForm } from '@/components/company-signup-form';

export default function PublicCompanySignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 text-white font-bold text-xl">
          <span className="bg-sky-500 p-2 rounded-xl"><Tv className="w-6 h-6" /></span>
          Mídia por Mídia
        </Link>
        <CompanySignupForm />
        <p className="text-center text-xs text-slate-500 mt-6">Já possui uma empresa cadastrada? <Link href="/login" className="text-sky-400 hover:underline">Entrar no painel</Link></p>
      </div>
    </main>
  );
}
