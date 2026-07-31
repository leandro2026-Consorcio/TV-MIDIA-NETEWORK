'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { extractMediaMetadata } from '@/lib/media-validator';
import { createMediaAssetAction } from '@/app/actions/media';
import { Upload, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function NewMediaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [playbackDuration, setPlaybackDuration] = useState<5 | 10 | 15 | 30>(10);
  const [companyId, setCompanyId] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [metaPreview, setMetaPreview] = useState<{
    mediaType?: 'image' | 'video';
    orientation?: 'horizontal' | 'vertical' | 'square' | 'unknown';
    width?: number;
    height?: number;
    durationSeconds?: number;
  } | null>(null);

  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingCompanies, setFetchingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadCompanies() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await (supabase.from('profiles') as any)
          .select('is_master_admin')
          .eq('id', user.id)
          .single();

        const isMaster = !!profile?.is_master_admin;

        let query;
        if (isMaster) {
          query = (supabase.from('companies') as any).select('*').order('trade_name');
        } else {
          const { data: userLinks } = await (supabase.from('company_users') as any)
            .select('company_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

          const ids = ((userLinks || []) as any[]).map((r) => r.company_id);
          if (ids.length > 0) {
            query = (supabase.from('companies') as any).select('*').in('id', ids).order('trade_name');
          }
        }

        if (query) {
          const { data: compList } = await query;
          if (compList && compList.length > 0) {
            setCompanies(compList as Company[]);
            setCompanyId(compList[0].id);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      } finally {
        setFetchingCompanies(false);
      }
    }

    loadCompanies();
  }, [supabase]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setValidating(true);
    setError(null);
    setMetaPreview(null);
    setFile(selectedFile);

    if (!title) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    const val = await extractMediaMetadata(selectedFile);

    if (!val.isValid) {
      setError(val.error || 'Arquivo de mídia inválido.');
      setFile(null);
      setValidating(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && companyId) {
        await (supabase.from('audit_logs') as any).insert({
          user_id: user.id,
          company_id: companyId,
          action: 'MEDIA_UPLOAD_ATTEMPT_INVALID',
          details: { filename: selectedFile.name, error: val.error },
        });
      }
      return;
    }

    setMetaPreview({
      mediaType: val.mediaType,
      orientation: val.orientation,
      width: val.width,
      height: val.height,
      durationSeconds: val.durationSeconds,
    });

    if (val.suggestedPlaybackDuration) {
      setPlaybackDuration(val.suggestedPlaybackDuration);
    }

    setValidating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !companyId) {
      setError('Por favor, selecione um arquivo válido e uma empresa.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Gerar UUID da mídia e caminho no Storage: {company_id}/{media_id}/{filename}
      const mediaId = window.crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const storagePath = `${companyId}/${mediaId}/${Date.now()}.${fileExt}`;

      // 2. Upload para o Supabase Storage Bucket Privado 'media-assets'
      const { error: storageErr } = await supabase.storage
        .from('media-assets')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (storageErr) {
        setError(`Erro ao enviar arquivo para o Storage: ${storageErr.message}`);
        setUploading(false);
        return;
      }

      // 3. Obter URL do arquivo
      const { data: publicUrlData } = supabase.storage.from('media-assets').getPublicUrl(storagePath);
      const fileUrl = publicUrlData.publicUrl;

      // 4. Inserir Registro via Server Action com Validação Server-Side Estrita
      const res = await createMediaAssetAction({
        id: mediaId,
        company_id: companyId,
        title,
        description: description || null,
        file_path: storagePath,
        file_url: fileUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        media_type: metaPreview?.mediaType || 'image',
        orientation: metaPreview?.orientation || 'horizontal',
        width: metaPreview?.width || null,
        height: metaPreview?.height || null,
        duration_seconds: metaPreview?.durationSeconds ? Math.round(metaPreview.durationSeconds) : null,
        playback_duration_seconds: playbackDuration,
      });

      if (!res.success) {
        setError(res.error || 'Erro ao registrar mídia.');
        setUploading(false);
        return;
      }

      router.push(`/media/${mediaId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao realizar upload.');
      setUploading(false);
    }
  };

  if (fetchingCompanies) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/media"
          className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Enviar Nova Mídia</h1>
          <p className="text-slate-400 text-sm">Upload seguro com validação server-side de permissões e durações</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Empresa Proprietária *</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name} ({c.city} - {c.state})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-2">Arquivo de Mídia *</label>
            <div className="relative border-2 border-dashed border-slate-800 hover:border-sky-500/50 bg-slate-950 p-8 rounded-2xl text-center transition group">
              <input
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              <div className="flex flex-col items-center gap-3">
                <div className="bg-sky-500/10 text-sky-400 p-4 rounded-2xl group-hover:scale-110 transition">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">
                    {file ? file.name : 'Clique ou arraste um arquivo de imagem ou vídeo'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos aceitos: <strong>JPG, PNG, WEBP, MP4, WEBM</strong> (Vídeos com duração máxima de 30s)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {validating && (
            <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 text-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analisando resolução, orientação e duração do arquivo...</span>
            </div>
          )}

          {metaPreview && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Arquivo Validado com Sucesso!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-slate-500 block">Tipo:</span>
                  <strong className="uppercase">{metaPreview.mediaType}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Orientação:</span>
                  <strong className="capitalize">{metaPreview.orientation}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Resolução:</span>
                  <strong>{metaPreview.width} x {metaPreview.height}px</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Duração Real:</span>
                  <strong>{metaPreview.durationSeconds ? `${metaPreview.durationSeconds}s` : 'N/A (Imagem)'}</strong>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-300 mb-1">Título da Mídia *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Anúncio Promocional de Verão"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Duração de Exibição na TV (Segundos) *</label>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 15, 30].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setPlaybackDuration(dur as any)}
                  className={`py-3 rounded-xl font-bold border transition ${
                    playbackDuration === dur
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {dur} Segundos
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Descrição Adicional (Opcional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <Link
              href="/media"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando para Storage...
                </>
              ) : (
                'Realizar Upload'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
