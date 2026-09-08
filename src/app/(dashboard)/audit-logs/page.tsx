'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuditLog } from '@/types';
import { ShieldAlert, FileText, Loader2 } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchAuditLogs() {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Erro ao carregar logs de auditoria:', error);
        } else {
          setLogs((data || []) as AuditLog[]);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAuditLogs();
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Logs de Auditoria Administrativa</h1>
        <p className="text-slate-400 text-sm mt-1">
          Registro de eventos sensíveis do sistema (Criação/edição de empresas, atribuições de papéis e movimentações financeiras).
        </p>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold">
          <ShieldAlert className="w-5 h-5" />
          <span>Eventos do Sistema (Audit-Trail)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Ação Executada</th>
                  <th className="p-3">ID Usuário</th>
                  <th className="p-3">ID Empresa</th>
                  <th className="p-3">Detalhes (JSON)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 whitespace-nowrap text-slate-400 font-mono">
                      {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="p-3 font-bold text-sky-400 whitespace-nowrap">
                      <span className="bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                      {log.user_id || 'SISTEMA'}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                      {log.company_id || '-'}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-400 max-w-md truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
