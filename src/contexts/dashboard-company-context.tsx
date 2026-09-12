'use client';

import { createContext, useContext } from 'react';
import { Company } from '@/types';

type DashboardCompanyContextValue = {
  activeCompany: Company | null;
};

const DashboardCompanyContext = createContext<DashboardCompanyContextValue>({ activeCompany: null });

export function DashboardCompanyProvider({
  activeCompany,
  children,
}: DashboardCompanyContextValue & { children: React.ReactNode }) {
  return (
    <DashboardCompanyContext.Provider value={{ activeCompany }}>
      {children}
    </DashboardCompanyContext.Provider>
  );
}

export function useDashboardCompany() {
  return useContext(DashboardCompanyContext);
}
