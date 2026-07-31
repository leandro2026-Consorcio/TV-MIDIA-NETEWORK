'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MediaAsset } from '@/types';
import { 
  approveMediaAction, 
  rejectMediaAction, 
  archiveMediaAction 
} from '@/app/actions/media';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Archive, 
  Save, 
  Image as ImageIcon, 
  Video 
} from 'lucide-react';

export default function MediaDetailPage() {
  const params = useParams();
  const mediaId = params.id as string;

  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'operator' | 'external' | 'master'>('operator');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [playbackDuration, setPlaybackDuration] = useState<5 | 10 | 15 | 30>(10);
  const [rejectionReason, setRejectionReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const loadMediaData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mediaData, error: mediaErr } = await (supabase.from('media_assets') as any)
        .select('*')
        .eq('id', mediaId)
        .single();

      if (mediaErr || !mediaData) {
        setError('Mídia não encontrada ou acesso negado.');
        setLoading(false);
        return;
      }

      const m = mediaData as MediaAsset;
      setMedia(m);
      setTitle(m.title);
      setDescription(m.description || '');
      setPlaybackDuration(m.playback_duration_seconds as any);
      setRejectionReason(m.rejection_reason || '');

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_master_admin) {
        setUserRole('master');
      } else {
        const { data: link } = await (supabase.from('company_users') as any)
          .select('role')
          .eq('company_id', m.company_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (link) setUserRole(link.role);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMediaData();
  }, [mediaId, supabase]);

  // Moderação via RPCs seguras
  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected' | 'archived') => {
    if (!media) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    let res: { success: boolean; error?: string };

    if (newStatus === 'approved') {
      res = await approveMediaAction(mediaId);
    } else if (newStatus === 'rejected') {
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        setError('Por favor, informe a justificativa da reprovação.');
        setSaving(false);
        return;
      }
      res = await rejectMediaAction(mediaId, rejectionReason);
    } else {
      res = await archiveMediaAction(mediaId);
    }

    if (!res.success) {
      setError(res.error || 'Erro ao atualizar status da mídia.');
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    await loadMediaData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateErr } = await (supabase.from('media_assets') as any)
        .update({
          title,
          description: description || null,
          playback_duration_seconds: playbackDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mediaId);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      if (user && media) {
        await (supabase.from('audit_logs') as any).insert({
          user_id: user.id,
          company_id: media.company_id,
          action: 'MEDIA_UPDATED',
          details: { media_id: mediaId, title },
        });
      }

      setSuccess(true);
      setSaving(false);
      await loadMediaData();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!media) {
    return <div className="text-center py-20 text-rose-400 text-sm">{error || 'Mídia não encontrada.'}</div>;
  }

  const isAdminOrMaster = userRole === 'admin' || userRole === 'master';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/media"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{media.title}</h1>
            <p className="text-slate-400 text-sm">Metadados e Moderação Protegida via RPC</p>
          </div>
        </div>

        {isAdminOrMaster && media.status !== 'archived' && (
          <button
            onClick={() => handleUpdateStatus('archived')}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2"
          >
            <Archive className="w-4 h-4 text-slate-400" /> Arquivar Mídia
          </button>
        )}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Player/Preview da Mídia */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-center items-center p-4">
            {media.file_url ? (
              media.media_type === 'image' ? (
                <img
                  src={media.file_url}
                  alt={media.title}
                  className="max-h-[350px] w-auto object-contain rounded-xl"
                />
              ) : (
                <video
                  src={media.file_url}
                  controls
                  className="max-h-[350px] w-full rounded-xl bg-black"
                />
              )
            ) : (
              <div className="py-20 text-slate-500 text-xs">Arquivo indisponível</div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">
              Metadados Técnicos
            </h3>

            <div className="grid grid-cols-2 gap-3 text-slate-300 font-mono">
              <div>
                <span className="text-slate-500 block">Tipo de Mídia:</span>
                <strong className="uppercase text-sky-400">{media.media_type}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">Orientação:</span>
                <strong className="capitalize text-slate-200">{media.orientation}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">Resolução Nativa:</span>
                <span>{media.width && media.height ? `${media.width}x${media.height}px` : 'Desconhecida'}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Tempo de Exibição:</span>
                <strong className="text-amber-400">{media.playback_duration_seconds} Segundos</strong>
              </div>

              <div className="col-span-2 border-t border-slate-800/80 pt-2 text-slate-400">
                <span className="text-slate-500 block">MIME Type / Nome:</span>
                <span className="truncate block font-sans">{media.mime_type} — {media.file_name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Moderação RPC & Edição */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Status Atual da Mídia</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  media.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : media.status === 'rejected'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : media.status === 'pending_review'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {media.status.toUpperCase()}
              </span>
            </div>

            {media.rejection_reason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                <strong>Motivo da Reprovação:</strong> {media.rejection_reason}
              </div>
            )}

            {/* Moderação Restrita via RPCs */}
            {isAdminOrMaster ? (
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-slate-300">Moderação Segura por RPC (Admin):</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={saving || media.status === 'approved'}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprovar Mídia
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('rejected')}
                    disabled={saving || media.status === 'rejected'}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reprovar Mídia
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Motivo da Reprovação (Obrigatório para Reprovar)</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Resolução abaixo do padrão ou conteúdo inadequado"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Usuários com perfil Operador não possuem permissão para aprovar ou reprovar mídias.
              </p>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">
              Editar Informações
            </h3>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Mídia atualizada com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Título da Mídia</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Duração de Exibição na TV</label>
                <select
                  value={playbackDuration}
                  onChange={(e: any) => setPlaybackDuration(Number(e.target.value) as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value={5}>5 Segundos</option>
                  <option value={10}>10 Segundos</option>
                  <option value={15}>15 Segundos</option>
                  <option value={30}>30 Segundos</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
