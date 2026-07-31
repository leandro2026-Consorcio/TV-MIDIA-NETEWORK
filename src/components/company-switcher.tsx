'use client';

import { Company } from '@/types';
import { Building2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface CompanySwitcherProps {
  companies: Company[];
  activeCompany: Company | null;
  onSelectCompany: (company: Company) => void;
}

export function CompanySwitcher({
  companies,
  activeCompany,
  onSelectCompany,
}: CompanySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!companies || companies.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
        <Building2 className="w-4 h-4 text-slate-500" />
        <span>Nenhuma empresa vinculada</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-xl text-left transition min-w-[200px]"
      >
        <div className="bg-sky-500/10 text-sky-400 p-1.5 rounded-lg border border-sky-500/20">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 truncate">
          <p className="text-xs font-semibold text-slate-200 truncate">
            {activeCompany ? activeCompany.trade_name : 'Selecione uma empresa'}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {activeCompany ? `${activeCompany.city}/${activeCompany.state}` : 'Tenant'}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
            Empresas Acessíveis
          </div>
          <div className="max-h-60 overflow-y-auto">
            {companies.map((comp) => (
              <button
                key={comp.id}
                onClick={() => {
                  onSelectCompany(comp);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-800 transition flex items-center justify-between text-xs ${
                  activeCompany?.id === comp.id ? 'bg-sky-500/10 text-sky-400 font-semibold' : 'text-slate-300'
                }`}
              >
                <div className="truncate">
                  <p className="truncate font-medium">{comp.trade_name}</p>
                  <p className="text-[10px] text-slate-500">{comp.city} - {comp.state}</p>
                </div>
                {activeCompany?.id === comp.id && (
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
