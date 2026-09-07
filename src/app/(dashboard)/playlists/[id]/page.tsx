'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Playlist, PlaylistItem, MediaAsset } from '@/types';
import { 
  updatePlaylistAction, 
  addPlaylistItemAction, 
  removePlaylistItemAction, 
  reorderPlaylistItemsAction 
} from '@/app/actions/playlist-admin';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  Image as ImageIcon, 
  Video, 
  Clock, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

export default function PlaylistMontadorPage() {
  const params = useParams();
  const playlistId = params.id as string;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<(PlaylistItem & { media?: MediaAsset })[]>([]);
  const [approvedMediaList, setApprovedMediaList] = useState<MediaAsset[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical' | 'mixed'>('horizontal');
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive' | 'archived'>('draft');

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [itemDuration, setItemDuration] = useState<number>(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const loadPlaylistData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Buscar Playlist
      const { data: playlistData, error: plErr } = await (supabase.from('playlists') as any)
        .select('*')
        .eq('id', playlistId)
        .single();

      if (plErr || !playlistData) {
        setError('Playlist não encontrada ou acesso negado.');
        setLoading(false);
        return;
      }

      const pl = playlistData as Playlist;
      setPlaylist(pl);
      setName(pl.name);
      setDescription(pl.description || '');
      setOrientation(pl.orientation);
      setStatus(pl.status);

      // 2. Buscar Itens da Playlist
      const { data: rawItems } = await (supabase.from('playlist_items') as any)
        .select('*, media_assets(*)')
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true });

      const formattedItems = (rawItems || []).map((it: any) => ({
        ...it,
        media: it.media_assets,
      }));
      setItems(formattedItems);

      // 3. Buscar Mídias APROVADAS da mesma Empresa
      const { data: mediaList } = await (supabase.from('media_assets') as any)
        .select('*')
        .eq('company_id', pl.company_id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      setApprovedMediaList((mediaList || []) as MediaAsset[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylistData();
  }, [playlistId, supabase]);

  // Salvar Informações da Playlist
  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await updatePlaylistAction(playlistId, {
      name,
      description: description || null,
      orientation,
      status,
    });

    if (!res.success) {
      setError(res.error || 'Erro ao atualizar playlist.');
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    await loadPlaylistData();
  };

  // Adicionar Mídia à Playlist
  const handleAddMediaItem = async () => {
    if (!selectedMediaId) {
      setError('Selecione uma mídia aprovada para adicionar.');
      return;
    }

    setAddingItem(true);
    setError(null);

    const res = await addPlaylistItemAction(playlistId, selectedMediaId, itemDuration);

    if (!res.success) {
      setError(res.error || 'Erro ao adicionar mídia à playlist.');
      setAddingItem(false);
      return;
    }

    setSelectedMediaId('');
    setShowMediaPicker(false);
    setAddingItem(false);
    await loadPlaylistData();
  };

  // Remover Item da Playlist
  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Deseja remover este anúncio da playlist?')) return;

    setError(null);
    const res = await removePlaylistItemAction(itemId);

    if (!res.success) {
      setError(res.error || 'Erro ao remover item.');
      return;
    }

    await loadPlaylistData();
  };

  // Mover Item (Para cima / Para baixo)
  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalcular sort_order
    const updatedOrders = newItems.map((item, idx) => ({
      id: item.id,
      sort_order: idx + 1,
    }));

    setItems(newItems);
    await reorderPlaylistItemsAction(playlistId, updatedOrders);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!playlist) {
    return <div className="text-center py-20 text-rose-400 text-sm">{error || 'Playlist não encontrada.'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/playlists"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{playlist.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  playlist.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {playlist.status.toUpperCase()}
              </span>
            </div>
            <p className="text-slate-400 text-sm">Montador da Grade de Programação</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Playlist salva com sucesso!</span>
        </div>
      )}

      {/* Grid: Configurações Gerais vs Montador de Itens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Coluna 1: Configurações da Playlist */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <h2 className="font-bold text-white text-base border-b border-slate-800 pb-3">
            Dados da Playlist
          </h2>

          <form onSubmit={handleSavePlaylist} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Nome da Playlist</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Orientação Target</label>
              <select
                value={orientation}
                onChange={(e: any) => setOrientation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 capitalize"
              >
                <option value="horizontal">Horizontal (16:9)</option>
                <option value="vertical">Vertical (9:16)</option>
                <option value="mixed">Mista / Qualquer Orientação</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativa (Pronta para TV)</option>
                <option value="inactive">Inativa</option>
                <option value="archived">Arquivada</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </button>
          </form>
        </div>

        {/* Coluna 2 e 3: Montador de Mídias (Itens da Playlist) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-bold text-white text-base">Mídias no Loop ({items.length})</h2>
                <p className="text-xs text-slate-400">Ordene a sequência de exibição dos anúncios na TV</p>
              </div>

              <button
                onClick={() => setShowMediaPicker(!showMediaPicker)}
                className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" /> Adicionar Mídia Aprovada
              </button>
            </div>

            {/* Painel de Seleção de Mídia Aprovada */}
            {showMediaPicker && (
              <div className="bg-slate-950 border border-purple-500/30 p-5 rounded-xl space-y-4 animate-in fade-in duration-200">
                <h3 className="font-bold text-purple-400 text-xs uppercase tracking-wider">
                  Selecionar Mídia da Biblioteca
                </h3>

                {approvedMediaList.length === 0 ? (
                  <p className="text-xs text-rose-400">
                    Nenhuma mídia com status Aprovada cadastrada nesta empresa. Acesse a Biblioteca para aprovar mídias.
                  </p>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Mídia Aprovada *</label>
                      <select
                        value={selectedMediaId}
                        onChange={(e) => {
                          setSelectedMediaId(e.target.value);
                          const m = approvedMediaList.find((x) => x.id === e.target.value);
                          if (m) setItemDuration(m.playback_duration_seconds as any);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Selecione um anúncio...</option>
                        {approvedMediaList.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.media_type.toUpperCase()}] {m.title} ({m.orientation} - {m.playback_duration_seconds}s)
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMediaId && (
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Tempo de Exibição (Segundos)</label>
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from(new Set([5, 10, 15, 30, itemDuration])).sort((a, b) => a - b).map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setItemDuration(dur as any)}
                              className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                                itemDuration === dur
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              {dur}s
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowMediaPicker(false)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={addingItem || !selectedMediaId}
                        onClick={handleAddMediaItem}
                        className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md shadow-purple-500/20"
                      >
                        {addingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar Inclusão'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista de Itens Adicionados à Playlist */}
            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Esta playlist ainda não possui nenhuma mídia no loop. Clique em <strong>Adicionar Mídia Aprovada</strong> acima.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const media = item.media;
                  const isMismatch = orientation !== 'mixed' && media && media.orientation !== orientation;

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold shrink-0">
                          {index + 1}
                        </span>

                        <div className="bg-slate-900 p-2 rounded-lg text-sky-400 shrink-0 border border-slate-800">
                          {media?.media_type === 'image' ? <ImageIcon className="w-4 h-4" /> : <Video className="w-4 h-4 text-purple-400" />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-xs truncate">
                            {media?.title || 'Mídia Removida'}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span className="capitalize">{media?.orientation || 'unknown'}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">{item.playback_duration_seconds}s</span>

                            {isMismatch && (
                              <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 ml-2">
                                <AlertTriangle className="w-3 h-3" /> Proporção diferente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação do Item */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 bg-slate-900 border border-slate-800 rounded-lg transition"
                          title="Mover para Cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveItem(index, 'down')}
                          disabled={index === items.length - 1}
                          className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 bg-slate-900 border border-slate-800 rounded-lg transition"
                          title="Mover para Baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 bg-slate-900 border border-slate-800 rounded-lg transition ml-1"
                          title="Remover da Playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
