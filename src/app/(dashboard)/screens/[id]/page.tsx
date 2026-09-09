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
  Monitor
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
            <Link href={`/screens/${screenId}/inventory`} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-semibold px-4 py-2 rounded-xl text-xs transition">
              Inventário e Capacidade
            </Link>
            <Link href={`/screens/${screenId}/content-settings`} className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-semibold px-4 py-2 rounded-xl text-xs transition">
              Conteúdo de Respiro
            </Link>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2"
            >
              {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Desativar Tela
            </button>
          </div>
        )}
      </div>

      {/* Caixa de Atribuição de Playlist */}
      <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl shadow-xl space-y-4">
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
    </div>
  );
}
