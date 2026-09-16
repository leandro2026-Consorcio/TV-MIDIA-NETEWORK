'use client';

import { createContext, useContext } from 'react';
import { Company } from '@/types';

type DashboardCompanyContextValue = {
  activeCompany: Company | null;
  companies: Company[];
  activeRole: string | null;
  isMasterAdmin: boolean;
};

const DashboardCompanyContext = createContext<DashboardCompanyContextValue>({ activeCompany: null, companies: [], activeRole: null, isMasterAdmin: false });

export function DashboardCompanyProvider({
  activeCompany,
  companies,
  activeRole,
  isMasterAdmin,
  children,
}: DashboardCompanyContextValue & { children: React.ReactNode }) {
  return (
    <DashboardCompanyContext.Provider value={{ activeCompany, companies, activeRole, isMasterAdmin }}>
      {children}
    </DashboardCompanyContext.Provider>
  );
}

export function useDashboardCompany() {
  return useContext(DashboardCompanyContext);
}
