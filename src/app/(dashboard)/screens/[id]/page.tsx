'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Screen, Playlist } from '@/types';
import { pairScreenAction, deactivateScreenAction } from '@/app/actions/pairing';
import { assignPlaylistToScreenAction, unassignPlaylistFromScreenAction } from '@/app/actions/playlist-admin';
import { 
  Tv, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Link2, 
  Power, 
  Save, 
  Clock, 
  ListVideo, 
  XCircle,
  Download,
  Monitor,
  Sparkles,
  HelpCircle,
  X,
  ChevronRight
} from 'lucide-react';

export default function ScreenDetailPage() {
  const params = useParams();
  const screenId = params.id as string;

  const [screen, setScreen] = useState<(Screen & { company_name?: string }) | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'operator' | 'external' | 'master'>('operator');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [resolution, setResolution] = useState('1920x1080');
  const [locationDescription, setLocationDescription] = useState('');

  // Estados de Pareamento
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState(false);

  // Estados de Playlist Atribuída
  const [companyPlaylists, setCompanyPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');
  const [assignedPlaylist, setAssignedPlaylist] = useState<Playlist | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const router = useRouter();
  const supabase = createClient();

  const loadScreenData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Buscar Tela
      const { data: screenData, error: screenErr } = await (supabase.from('screens') as any)
        .select('*, companies(trade_name)')
        .eq('id', screenId)
        .single();

      if (screenErr || !screenData) {
        setError('Tela não encontrada ou acesso negado.');
        setLoading(false);
        return;
      }

      const scr = {
        ...screenData,
        company_name: screenData.companies?.trade_name,
      };
      setScreen(scr);
      setName(scr.name);
      setDescription(scr.description || '');
      setOrientation(scr.orientation);
      setResolution(scr.resolution || '1920x1080');
      setLocationDescription(scr.location_description || '');

      // 2. Verificar Perfil
      const { data: profile } = await (supabase.from('profiles') as any)
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_master_admin) {
        setUserRole('master');
      } else {
        const { data: link } = await (supabase.from('company_users') as any)
          .select('role')
          .eq('company_id', scr.company_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (link) setUserRole(link.role);
      }

      // 3. Buscar Playlists da Empresa
      const { data: plList } = await (supabase.from('playlists') as any)
        .select('*')
        .eq('company_id', scr.company_id)
        .in('status', ['active', 'draft'])
        .order('name');

      setCompanyPlaylists((plList || []) as Playlist[]);

      // 4. Buscar Playlist Atribuída Atualmente a esta Tela
      const { data: assignedLink } = await (supabase.from('screen_playlists') as any)
        .select('playlist_id, playlists(*)')
        .eq('screen_id', screenId)
        .eq('is_active', true)
        .single();

      if (assignedLink && assignedLink.playlists) {
        setAssignedPlaylist(assignedLink.playlists as Playlist);
        setActivePlaylistId(assignedLink.playlist_id);
      } else {
        setAssignedPlaylist(null);
        setActivePlaylistId('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenData();
  }, [screenId, supabase]);

  // Executar Pareamento de Código de 6 Dígitos
  const handlePairScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingLoading(true);
    setPairingError(null);
    setPairingSuccess(false);

    if (!pairingCodeInput || pairingCodeInput.trim().length !== 6) {
      setPairingError('Por favor, informe o código de 6 dígitos exibido na TV.');
      setPairingLoading(false);
      return;
    }

    const res = await pairScreenAction(screenId, pairingCodeInput);

    if (!res.success) {
      setPairingError(res.error || 'Erro ao realizar pareamento.');
      setPairingLoading(false);
      return;
    }

    setPairingSuccess(true);
    setPairingCodeInput('');
    setPairingLoading(false);
    await loadScreenData();
  };

  // Atribuir Playlist à Tela
  const handleAssignPlaylist = async () => {
    if (!activePlaylistId) {
      setError('Selecione uma playlist para vincular à TV.');
      return;
    }

    setPlaylistLoading(true);
    setError(null);

    const res = await assignPlaylistToScreenAction(screenId, activePlaylistId);

    if (!res.success) {
      setError(res.error || 'Erro ao vincular playlist à TV.');
      setPlaylistLoading(false);
      return;
    }

    setPlaylistLoading(false);
    await loadScreenData();
  };

  // Desvincular Playlist da Tela
  const handleUnassignPlaylist = async () => {
    if (!confirm('Deseja remover a playlist atualmente exibida nesta TV?')) return;

    setPlaylistLoading(true);
    setError(null);

    const res = await unassignPlaylistFromScreenAction(screenId);

    if (!res.success) {
      setError(res.error || 'Erro ao desvincular playlist.');
      setPlaylistLoading(false);
      return;
    }

    setPlaylistLoading(false);
    await loadScreenData();
  };

  // Salvar Edição da Tela
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateErr } = await (supabase.from('screens') as any)
        .update({
          name,
          description: description || null,
          orientation,
          resolution,
          location_description: locationDescription || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', screenId);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      if (user && screen) {
        await (supabase.from('audit_logs') as any).insert({
          user_id: user.id,
          company_id: screen.company_id,
          action: 'SCREEN_UPDATED',
          details: { screen_id: screenId, name },
        });
      }

      setSuccess(true);
      setSaving(false);
      await loadScreenData();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!showTour) return;
    const targetMap: Record<number, string> = {
      0: 'tour-target-playlist',
      1: 'tour-target-network',
      2: 'tour-target-content',
      3: 'tour-target-deactivate',
    };
    const targetId = targetMap[tourStep];
    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    }
  }, [showTour, tourStep]);

  // Desativar Tela
  const handleDeactivate = async () => {
    if (!confirm('Deseja realmente desativar esta tela? O pareamento do dispositivo será revogado.')) {
      return;
    }

    setDeactivating(true);
    const res = await deactivateScreenAction(screenId);

    if (!res.success) {
      setError(res.error || 'Erro ao desativar tela.');
      setDeactivating(false);
      return;
    }

    setDeactivating(false);
    await loadScreenData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!screen) {
    return <div className="text-center py-20 text-rose-400 text-sm">{error || 'Tela não encontrada.'}</div>;
  }

  const isAdminOrMaster = userRole === 'admin' || userRole === 'master';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/screens"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{screen.name}</h1>
              <p className="text-sm text-sky-400 font-semibold">
                {screen.device_type === 'windows_monitor' ? 'Monitor Windows' : 'TV'}
              </p>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  screen.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : screen.status === 'pending_pairing'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {screen.status.toUpperCase()}
              </span>
            </div>
            <p className="text-slate-400 text-sm">{screen.company_name}</p>
          </div>
        </div>

          {isAdminOrMaster && screen.status !== 'inactive' && (
            <div className="flex items-center gap-2">
              <Link href={`/screens/${screenId}/inventory`} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs transition">
                Participação na Rede
              </Link>
              <Link href={`/screens/${screenId}/content-settings`} className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs transition">
                Conteúdo entre propagandas
              </Link>
            </div>
          )}
      </div>

      {/* Banner Orientador: Configure como esta TV vai funcionar */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-purple-500/10 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-300 border border-sky-500/30">
              <Sparkles className="h-3.5 w-3.5" /> Configuração Guiada da TV
            </span>
            <h2 className="text-xl font-extrabold text-white mt-2">Configure como esta TV vai funcionar</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Aqui você define o que a TV exibe, como participa da Rede MPM e quais conteúdos aparecem entre as propagandas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowTour(true); setTourStep(0); }}
            className="self-start sm:self-center px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" /> Entender como funciona
          </button>
        </div>

        {/* Sub-passos da TV */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-800/80">
          <div
            id="tour-target-playlist-step"
            className={`rounded-xl border p-3 transition-all duration-300 ${
              showTour && tourStep === 0
                ? 'border-purple-500 bg-purple-500/20 ring-4 ring-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.4)] scale-105 z-30'
                : 'border-purple-500/30 bg-purple-500/10'
            }`}
          >
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">Passo 1 de 4</span>
            <strong className="text-white text-xs block mt-0.5">Programação (Playlist)</strong>
            <span className="text-[11px] text-slate-400 mt-1 block">{assignedPlaylist ? '✅ Definida' : 'Pendente'}</span>
          </div>
          <Link
            id="tour-target-network"
            href={`/screens/${screenId}/inventory`}
            className={`rounded-xl border p-3 transition-all duration-300 block ${
              showTour && tourStep === 1
                ? 'border-sky-500 bg-sky-500/20 ring-4 ring-sky-500/60 shadow-[0_0_25px_rgba(14,165,233,0.4)] scale-105 z-30'
                : 'border-slate-800 bg-slate-950 hover:border-purple-500/30'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passo 2 de 4</span>
            <strong className="text-white text-xs block mt-0.5">Participação na Rede</strong>
            <span className="text-[11px] text-sky-400 mt-1 block">Configurar espaço →</span>
          </Link>
          <Link
            id="tour-target-content"
            href={`/screens/${screenId}/content-settings`}
            className={`rounded-xl border p-3 transition-all duration-300 block ${
              showTour && tourStep === 2
                ? 'border-emerald-500 bg-emerald-500/20 ring-4 ring-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-105 z-30'
                : 'border-slate-800 bg-slate-950 hover:border-sky-500/30'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passo 3 de 4</span>
            <strong className="text-white text-xs block mt-0.5">Entre Propagandas</strong>
            <span className="text-[11px] text-sky-400 mt-1 block">Notícias e respiro →</span>
          </Link>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passo 4 de 4</span>
            <strong className="text-white text-xs block mt-0.5">Revisar e Ligar</strong>
            <span className="text-[11px] text-emerald-400 mt-1 block">Pronto no player</span>
          </div>
        </div>
      </div>

      {/* Caixa de Atribuição de Playlist */}
      <div
        id="tour-target-playlist"
        className={`bg-slate-900 border p-6 rounded-2xl shadow-xl space-y-4 transition-all duration-300 ${
          showTour && tourStep === 0
            ? 'border-purple-500 ring-4 ring-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.4)] relative z-40'
            : 'border-purple-500/30'
        }`}
      >
        {showTour && tourStep === 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Spotlight 1: Playlist & Programação da TV
          </div>
        )}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-400 border border-purple-500/20">
              <ListVideo className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Playlist Atribuída a esta TV</h2>
              <p className="text-xs text-slate-400">Escolha a grade de anúncios que será reproduzida nesta tela</p>
            </div>
          </div>

          {assignedPlaylist && (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              REPRODUZINDO
            </span>
          )}
        </div>

        {isAdminOrMaster ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={activePlaylistId}
                onChange={(e) => setActivePlaylistId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 flex-1"
              >
                <option value="">Nenhuma playlist atribuída (Sem exibição)</option>
                {companyPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.orientation} - Status: {pl.status.toUpperCase()})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={playlistLoading || !activePlaylistId || activePlaylistId === assignedPlaylist?.id}
                onClick={handleAssignPlaylist}
                className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 shrink-0"
              >
                {playlistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular Playlist'}
              </button>

              {assignedPlaylist && (
                <button
                  type="button"
                  disabled={playlistLoading}
                  onClick={handleUnassignPlaylist}
                  className="bg-slate-800 hover:bg-slate-700 text-rose-400 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <XCircle className="w-4 h-4" /> Desvincular
                </button>
              )}
            </div>

            {assignedPlaylist && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center text-slate-300">
                <span>Playlist Ativa: <strong className="text-purple-400">{assignedPlaylist.name}</strong></span>
                <Link href={`/playlists/${assignedPlaylist.id}`} className="text-sky-400 hover:underline">
                  Editar Playlist ➔
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Usuários com perfil Operador não possuem permissão para alterar a playlist atribuída à TV.
          </p>
        )}
      </div>

      {/* Caixa de Pareamento (Destaque Principal) */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border border-sky-500/30 p-6 rounded-2xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-2.5 rounded-xl text-white shadow-lg shadow-sky-500/20">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Pareamento de Dispositivo (TV)</h2>
            <p className="text-xs text-slate-400">
              Digite o código de 6 dígitos exibido no aplicativo do player em <strong className="text-slate-200">/player</strong>
            </p>
          </div>
        </div>

        {pairingError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pairingError}</span>
          </div>
        )}

        {pairingSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Dispositivo pareado com sucesso! A TV responderá imediatamente.</span>
          </div>
        )}

        {isAdminOrMaster ? (
          <form onSubmit={handlePairScreen} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              maxLength={6}
              value={pairingCodeInput}
              onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex: X7K9P2"
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 font-mono font-bold tracking-widest text-lg focus:outline-none focus:border-sky-500 uppercase sm:w-64"
            />
            <button
              type="submit"
              disabled={pairingLoading}
              className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-bold px-6 py-3 rounded-xl text-sm transition flex justify-center items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {pairingLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Vinculando...
                </>
              ) : (
                'Vincular Código'
              )}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Usuários com perfil Operador não possuem permissão para executar pareamento.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Última Sincronização (Ping): <strong className="text-slate-200">{screen.last_ping_at ? new Date(screen.last_ping_at).toLocaleString('pt-BR') : 'NENHUMA'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
            <span>Data do Pareamento: <strong className="text-slate-200">{screen.paired_at ? new Date(screen.paired_at).toLocaleDateString('pt-BR') : 'NÃO PAREADA'}</strong></span>
          </div>
        </div>

        {screen.device_type === 'windows_monitor' && (
          <div className="mt-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-sky-400" /> Instalador Nativo Windows 10 e 11
              </p>
              <p className="text-slate-400 text-[11px]">
                Execute o instalador no computador conectado a este monitor para iniciar em modo quiosque automaticamente.
              </p>
            </div>
            <a
              href="/downloads/mpm-player/windows"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3.5 py-2 font-bold text-white hover:bg-sky-600 transition shadow-md shadow-sky-500/20 shrink-0"
            >
              <Download className="h-4 w-4" /> Baixar Setup (.exe)
            </a>
          </div>
        )}
      </div>

      {/* Formulário de Edição da Tela */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">
          Configurações da Tela
        </h2>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Dados da tela salvos com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 text-sm">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Nome da Tela *</label>
            <input
              type="text"
              required
              disabled={!isAdminOrMaster}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 disabled:opacity-50 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Orientação da TV *</label>
              <select
                disabled={!isAdminOrMaster}
                value={orientation}
                onChange={(e: any) => {
                  setOrientation(e.target.value);
                  setResolution(e.target.value === 'horizontal' ? '1920x1080' : '1080x1920');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 disabled:opacity-50 text-sm focus:outline-none focus:border-sky-500 capitalize"
              >
                <option value="horizontal">Horizontal (16:9)</option>
                <option value="vertical">Vertical (9:16)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Resolução Nativa</label>
              <input
                type="text"
                disabled={!isAdminOrMaster}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 disabled:opacity-50 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Localização Física / Descrição do Ponto</label>
            <input
              type="text"
              disabled={!isAdminOrMaster}
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 disabled:opacity-50 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição Adicional</label>
            <textarea
              rows={2}
              disabled={!isAdminOrMaster}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 disabled:opacity-50 focus:outline-none focus:border-sky-500"
            />
          </div>

          {isAdminOrMaster && (
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Zona de Ações Secundárias / Perigo: Desativação */}
      {isAdminOrMaster && screen.status !== 'inactive' && (
        <section
          id="tour-target-deactivate"
          className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 ${
            showTour && tourStep === 3
              ? 'border-rose-500 bg-rose-500/10 ring-4 ring-rose-500/50 shadow-[0_0_40px_rgba(244,63,94,0.4)] relative z-40'
              : 'border-rose-500/20 bg-rose-500/5'
          }`}
        >
          {showTour && tourStep === 3 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg animate-pulse mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Spotlight 4: Desativação Segura da Tela
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-300">Desativação da Tela</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Use esta opção somente se esta TV deixar de fazer parte da sua operação. O pareamento do dispositivo será revogado.
              </p>
            </div>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="self-start sm:self-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2 disabled:opacity-50"
            >
              {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Desativar Tela
            </button>
          </div>
        </section>
      )}

      {/* Modal / Dock do Tour Guiado: Apresentação das Áreas da TV */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:justify-end p-4 sm:p-6 bg-slate-950/40 backdrop-blur-[2px] pointer-events-none">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900/95 p-6 sm:p-7 shadow-2xl space-y-5 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">Como esta TV funciona</h3>
                  <p className="text-xs text-slate-400">Passo {tourStep + 1} de 4</p>
                </div>
              </div>
              <button
                onClick={() => setShowTour(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tourStep === 0 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">1. Programação da TV</span>
                  <h4 className="text-lg font-bold text-white mt-1">Playlist Atribuída</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    A playlist é a programação principal da sua TV. Nela ficam seus vídeos, imagens e conteúdos próprios. É aqui que você escolhe qual grade de anúncios vai rodar continuamente na sua tela.
                  </p>
                </div>
                <button
                  onClick={() => setTourStep(1)}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
                >
                  Entendi, continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {tourStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
                  <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider block">2. Espaço e Capacidade</span>
                  <h4 className="text-lg font-bold text-white mt-1">Participação na Rede MPM</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Aqui você define quanto espaço desta TV pode ser utilizado por sua empresa, parceiros e pela Rede MPM. Você decide se quer receber anúncios parceiros e escolhe empresas preferenciais para anunciar no seu local.
                  </p>
                  <p className="text-[11px] text-sky-200/70 mt-2">
                    💡 Disponibilizar capacidade não gera Crédito MPM automaticamente.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTourStep(0)}
                    className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setTourStep(2)}
                    className="w-2/3 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {tourStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">3. Dinamismo</span>
                  <h4 className="text-lg font-bold text-white mt-1">Conteúdo entre propagandas</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Conteúdos informativos são notícias, curiosidades, frases e previsões exibidas entre as propagandas para deixar a programação mais interessante para o seu público.
                  </p>
                  <p className="text-[11px] text-emerald-300/80 mt-2 font-medium">
                    ✨ Eles não consomem seus Créditos MPM e enriquecem o ambiente da sua loja.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTourStep(1)}
                    className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setTourStep(3)}
                    className="w-2/3 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {tourStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">4. Manutenção</span>
                  <h4 className="text-lg font-bold text-white mt-1">Desativar Tela</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Use esta opção somente se esta TV deixar de fazer parte da sua operação. Ela fica protegida no rodapé da página para evitar desativações acidentais.
                  </p>
                </div>
                <button
                  onClick={() => setShowTour(false)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  Tudo pronto! Começar configuração
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
