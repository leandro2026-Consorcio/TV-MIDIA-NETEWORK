'use client';

import { Profile, Company } from '@/types';
import { CompanySwitcher } from './company-switcher';
import { User, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  profile: Profile;
  companies: Company[];
  activeCompany: Company | null;
  onSelectCompany: (company: Company) => void;
}

export function Header({
  profile,
  companies,
  activeCompany,
  onSelectCompany,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Active Company Selector */}
      <div className="flex items-center gap-4">
        <CompanySwitcher
          companies={companies}
          activeCompany={activeCompany}
          onSelectCompany={onSelectCompany}
        />
      </div>

      {/* User Info & Profile */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 justify-end">
            {profile.full_name || profile.email}
            {profile.is_master_admin && (
              <span title="Master Admin Global">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">{profile.email}</p>
        </div>

        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold text-sm">
          {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
        </div>
      </div>
    </header>
  );
}
