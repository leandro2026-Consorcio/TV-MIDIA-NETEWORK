'use client';

import { createContext, useContext } from 'react';
import { Company } from '@/types';

type DashboardCompanyContextValue = {
  activeCompany: Company | null;
  activeRole: string | null;
  isMasterAdmin: boolean;
};

const DashboardCompanyContext = createContext<DashboardCompanyContextValue>({ activeCompany: null, activeRole: null, isMasterAdmin: false });

export function DashboardCompanyProvider({
  activeCompany,
  activeRole,
  isMasterAdmin,
  children,
}: DashboardCompanyContextValue & { children: React.ReactNode }) {
  return (
    <DashboardCompanyContext.Provider value={{ activeCompany, activeRole, isMasterAdmin }}>
      {children}
    </DashboardCompanyContext.Provider>
  );
}

export function useDashboardCompany() {
  return useContext(DashboardCompanyContext);
}
