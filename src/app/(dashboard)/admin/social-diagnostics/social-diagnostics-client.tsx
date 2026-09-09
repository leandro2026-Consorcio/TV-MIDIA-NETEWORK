'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Instagram,
  Facebook,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  ShieldAlert,
  Search,
} from 'lucide-react';
import {
  verifySocialConnectionAction,
  refreshSocialTokenAction,
  disconnectSocialConnectionAction,
} from '@/app/actions/social';

interface Props {
  initialDiagnostics: any[];
}

export function SocialDiagnosticsClient({ initialDiagnostics }: Props) {
  const router = useRouter();
  const [diagnostics, setDiagnostics] = useState<any[]>(initialDiagnostics);
  const [filter, setFilter] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleVerify = async (connId: string) => {
    setLoadingId(connId);
    setFeedback(null);
    const res = await verifySocialConnectionAction(connId);
    if (res.success) {
      setFeedback(`Conexão verificada: ${res.message}`);
      router.refresh();
    } else {
      setFeedback(`Erro na verificação: ${res.error}`);
    }
    setLoadingId(null);
  };

  const handleRefresh = async (connId: string) => {
    setLoadingId(connId);
    setFeedback(null);
    const res = await refreshSocialTokenAction(connId);
    if (res.success) {
      setFeedback(`Token renovado com sucesso! Nova expiração: ${new Date(res.expiresAt!).toLocaleDateString('pt-BR')}`);
      router.refresh();
    } else {
      setFeedback(`Erro ao renovar: ${res.error}`);
    }
    setLoadingId(null);
  };

  const handleRevoke = async (connId: string) => {
    if (!confirm('Deseja realmente revogar esta conexão social imediatamente?')) return;
    setLoadingId(connId);
    setFeedback(null);
    const res = await disconnectSocialConnectionAction(connId);
    if (res.success) {
      setFeedback('Conexão revogada com sucesso.');
      router.refresh();
    } else {
      setFeedback(`Erro ao revogar: ${res.error}`);
    }
    setLoadingId(null);
  };

  const filtered = diagnostics.filter((d) => {
    const q = filter.toLowerCase();
    return (
      (d.owner_name || '').toLowerCase().includes(q) ||
      (d.display_name || '').toLowerCase().includes(q) ||
      (d.provider || '').toLowerCase().includes(q) ||
      (d.channel_type || '').toLowerCase().includes(q) ||
      (d.connected_by_email || '').toLowerCase().includes(q)
    );
  });

  const totalConnections = diagnostics.length;
  const activeConnections = diagnostics.filter((d) => d.status === 'active').length;
  const instagramCount = diagnostics.filter((d) => d.provider === 'instagram').length;
  const facebookCount = diagnostics.filter((d) => d.provider === 'facebook').length;

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-16">
      <header className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-400">
              Master Admin
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
              Social Diagnostics
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Diagnóstico de Integrações Sociais</h1>
          <p className="mt-1 text-xs text-slate-400">
            Painel operacional para auditoria técnica de conexões OAuth (Instagram & Facebook) sem expor segredos nem tokens.
          </p>
        </div>

        <button
          onClick={() => router.refresh()}
          className="rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 transition flex items-center gap-2 shrink-0 self-start sm:self-center"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar Diagnósticos
        </button>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Total Conexões</span>
          <div className="text-3xl font-black text-white mt-2">{totalConnections}</div>
          <span className="text-xs text-slate-400 mt-1 block">{activeConnections} ativas no momento</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Instagram Login</span>
          <div className="text-3xl font-black text-fuchsia-400 mt-2">{instagramCount}</div>
          <span className="text-xs text-slate-400 mt-1 block">Fluxo direto (sem Facebook Page)</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Facebook Pages</span>
          <div className="text-3xl font-black text-blue-400 mt-2">{facebookCount}</div>
          <span className="text-xs text-slate-400 mt-1 block">Login for Business</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Segurança de Tokens</span>
          <div className="text-3xl font-black text-emerald-400 mt-2">AES-GCM</div>
          <span className="text-xs text-slate-400 mt-1 block">Tokens protegidos em repouso</span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por titular, canal, e-mail ou provedor..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
        />
      </div>

      {/* Diagnostics Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-500">
              <tr>
                <th className="p-4">Titular / Operador</th>
                <th className="p-4">Provedor / Canal</th>
                <th className="p-4">Conta Mascarada</th>
                <th className="p-4">Status & Diagnóstico</th>
                <th className="p-4">Capacidades</th>
                <th className="p-4">Validade Token</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhuma conexão localizada com os filtros informados.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isInstagram = item.provider === 'instagram';
                  const isLoading = loadingId === item.connection_id;

                  return (
                    <tr key={item.connection_id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <div className="font-bold text-white">{item.owner_name || 'Sem nome'}</div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {item.owner_type} · {item.connected_by_email || 'Email n/d'}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isInstagram ? (
                            <Instagram className="w-4 h-4 text-fuchsia-400 shrink-0" />
                          ) : (
                            <Facebook className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span className="font-bold text-white">{item.display_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {item.auth_flow || 'padrão'}
                        </span>
                      </td>

                      <td className="p-4 font-mono text-[11px] text-slate-400">
                        {item.provider_account_id_masked || '****'}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            item.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">
                          {item.diagnostic_message || 'Sem anomalias detectadas'}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${item.feed_publish_capable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            Feed
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] ${item.reel_publish_capable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            Reels
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] ${item.story_publish_capable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            Stories
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-[11px]">
                        {item.expires_at ? (
                          <span className="text-slate-300">
                            {new Date(item.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-slate-500">Permanente (Página)</span>
                        )}
                        {item.last_refreshed_at && (
                          <div className="text-[10px] text-slate-500">
                            Renovado: {new Date(item.last_refreshed_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerify(item.connection_id)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition disabled:opacity-50"
                          >
                            Verificar
                          </button>

                          {isInstagram && (
                            <button
                              onClick={() => handleRefresh(item.connection_id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 text-[11px] font-bold transition disabled:opacity-50"
                            >
                              Renovar
                            </button>
                          )}

                          <button
                            onClick={() => handleRevoke(item.connection_id)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold transition disabled:opacity-50"
                          >
                            Revogar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
