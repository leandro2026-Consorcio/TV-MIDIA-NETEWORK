'use client';

import { Check, Clock3, Music2, X } from 'lucide-react';

interface Props {
  channels: any[];
  connectUrl: string;
  enabled: boolean;
  loading?: boolean;
  onDisconnect: (connectionId: string) => void;
}

export function TikTokConnectionCard({ channels, connectUrl, enabled, loading, onDisconnect }: Props) {
  const channel = channels[0];
  const connected = Boolean(channel);
  const connection = channel?.social_connections;

  return (
    <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/25 via-slate-900 to-slate-900 p-6 sm:p-7 flex flex-col justify-between space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {channel?.avatar_url ? (
              <img src={channel.avatar_url} alt="Perfil TikTok" className="w-12 h-12 rounded-2xl object-cover border border-cyan-500/30" />
            ) : (
              <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Music2 className="w-6 h-6" />
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">TikTok Login Kit</span>
              {connected && <h3 className="text-lg font-black text-white mt-2">{channel.display_name}</h3>}
            </div>
          </div>
          {connected && <span className="text-[10px] font-bold text-emerald-400">CONECTADO</span>}
        </div>

        {!connected && (
          <div>
            <h3 className="text-xl font-black text-white">TikTok</h3>
            <p className="text-xs text-slate-400 mt-1">
              Conecte sua conta TikTok para usar recursos de perfil, vídeos e futuras campanhas da Rede MPM.
            </p>
          </div>
        )}

        {connected && (
          <div className="space-y-3">
            {connection?.expires_at && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5" /> Acesso válido até {new Date(connection.expires_at).toLocaleString('pt-BR')}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {[
                ['Perfil', channel.profile_read_capable],
                ['Vídeos', channel.video_list_capable],
                ['Upload', channel.video_upload_capable],
                ['Direct Post', channel.direct_post_capable],
                ['Métricas', channel.metrics_capable],
              ].map(([label, capable]) => (
                <span key={String(label)} className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 ${capable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                  {capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
                </span>
              ))}
            </div>
            {!channel.video_upload_capable && (
              <p className="text-[11px] text-amber-300">Upload e publicação dependem de aprovação do TikTok. Direct Post público permanece bloqueado até auditoria.</p>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800">
        {connected ? (
          <button disabled={loading} onClick={() => onDisconnect(channel.connection_id)} className="text-xs font-bold text-rose-400 hover:text-rose-300 underline disabled:opacity-50">
            Desconectar TikTok
          </button>
        ) : enabled ? (
          <a href={connectUrl} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 px-5 py-3 text-xs font-black text-slate-950 transition-all">
            <Music2 className="w-4 h-4" /> CONECTAR TIKTOK
          </a>
        ) : (
          <div className="w-full text-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-400">
            Pendente de configuração/aprovação TikTok
          </div>
        )}
      </div>
    </div>
  );
}
