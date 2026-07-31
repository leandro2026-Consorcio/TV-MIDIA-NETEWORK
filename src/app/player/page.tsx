'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  requestPairingCodeAction, 
  checkPairingStatusAction, 
  heartbeatAction 
} from '@/app/actions/pairing';
import { getPlayerPlaylistAction, PlayerPlaylistItem } from '@/app/actions/playlist-player';
import { recordPlaybackLogAction, PlaybackLogIngestPayload } from '@/app/actions/playback-logs';
import { Tv, CheckCircle2, Clock, RefreshCw, AlertCircle, ListVideo } from 'lucide-react';

interface ScreenInfo {
  id: string;
  name: string;
  orientation: string;
  resolution: string | null;
}

interface PlaylistInfo {
  id: string;
  name: string;
  orientation: string;
}

// Helper: Gerar Hash SHA-256 no cliente para a chave de idempotência
async function generateIdempotencyKey(seedText: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(seedText);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'idem_' + Math.random().toString(36).substring(2) + Date.now();
}

export default function PlayerPage() {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [items, setItems] = useState<PlayerPlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [status, setStatus] = useState<'loading' | 'unpaired' | 'no_playlist' | 'no_items' | 'playing' | 'expired' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  const pairingSecretRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>('');

  // Refs de Estado da Mídia em Exibição
  const slideStartedAtRef = useRef<string | null>(null);
  const slideIdempotencyKeyRef = useRef<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flushQueueRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Inicialização do Player e Session ID
  useEffect(() => {
    sessionIdRef.current = typeof window !== 'undefined' ? window.crypto.randomUUID() : 'sess_' + Date.now();
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('rede_indoor_device_token') : null;

    if (savedToken) {
      setDeviceToken(savedToken);
      loadPlaylistAndStartPlayer(savedToken);
    } else {
      initNewPairing();
    }

    return () => {
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    if (flushQueueRef.current) clearInterval(flushQueueRef.current);
  };

  // 2. Fila de Contingência de Logs no localStorage
  const enqueueLogToLocalQueue = (log: PlaybackLogIngestPayload) => {
    try {
      const queueRaw = localStorage.getItem('rede_indoor_pending_playback_logs');
      const queue: PlaybackLogIngestPayload[] = queueRaw ? JSON.parse(queueRaw) : [];
      queue.push(log);
      localStorage.setItem('rede_indoor_pending_playback_logs', JSON.stringify(queue));
    } catch (e) {
      console.error('Erro ao armazenar log na fila local:', e);
    }
  };

  const flushPendingLogsQueue = async (token: string) => {
    try {
      const queueRaw = localStorage.getItem('rede_indoor_pending_playback_logs');
      if (!queueRaw) return;
      const queue: PlaybackLogIngestPayload[] = JSON.parse(queueRaw);
      if (queue.length === 0) return;

      const remainingQueue: PlaybackLogIngestPayload[] = [];

      for (const log of queue) {
        const res = await recordPlaybackLogAction(token, log);
        if (!res.success) {
          // Se o token for inválido, interromper reenvio
          if (res.error?.includes('inválido') || res.error?.includes('revogado')) {
            break;
          }
          // Falha temporária de rede -> manter no localStorage com a mesma idempotency_key
          remainingQueue.push(log);
        }
      }

      localStorage.setItem('rede_indoor_pending_playback_logs', JSON.stringify(remainingQueue));
    } catch (e) {
      console.error('Erro ao processar fila de logs:', e);
    }
  };

  // 3. Carregar Playlist e Iniciar Player
  const loadPlaylistAndStartPlayer = async (token: string) => {
    const res = await getPlayerPlaylistAction(token);

    if (!res.success) {
      localStorage.removeItem('rede_indoor_device_token');
      setDeviceToken(null);
      initNewPairing();
      return;
    }

    if (res.screen) {
      setScreenInfo(res.screen as ScreenInfo);
    }

    // Loop de Heartbeat a cada 30s
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      const hb = await heartbeatAction(token);
      if (!hb.success) {
        localStorage.removeItem('rede_indoor_device_token');
        setDeviceToken(null);
        initNewPairing();
      }
    }, 30000);

    // Loop de Flush de Logs Pendentes a cada 15s
    if (flushQueueRef.current) clearInterval(flushQueueRef.current);
    flushQueueRef.current = setInterval(() => {
      flushPendingLogsQueue(token);
    }, 15000);

    if (!res.hasPlaylist) {
      setStatus('no_playlist');
      setMessage(res.message || 'TV vinculada com sucesso. Aguardando playlist.');
      setPlaylistInfo(null);
      setItems([]);
      return;
    }

    if (res.playlist) {
      setPlaylistInfo(res.playlist as PlaylistInfo);
    }

    if (!res.hasItems || !res.items || res.items.length === 0) {
      setStatus('no_items');
      setMessage(res.message || 'Playlist ativa sem mídias aprovadas.');
      setItems([]);
      return;
    }

    setItems(res.items);
    setCurrentIndex(0);
    setStatus('playing');
  };

  // 4. Registrar Término da Mídia e Avançar Slide
  const finishCurrentSlideAndLog = async (overrideStatus?: 'completed' | 'skipped' | 'failed', failureReason?: string) => {
    if (!activeItem || !deviceToken || !slideStartedAtRef.current || !slideIdempotencyKeyRef.current) {
      advanceIndexNext();
      return;
    }

    const endedAtISO = new Date().toISOString();
    const startedTime = new Date(slideStartedAtRef.current).getTime();
    const endedTime = new Date(endedAtISO).getTime();
    const actualDurationSeconds = Math.max(0, Math.round(((endedTime - startedTime) / 1000) * 100) / 100);

    const logPayload: PlaybackLogIngestPayload = {
      media_asset_id: activeItem.media_id,
      playlist_id: playlistInfo?.id || null,
      playlist_item_id: activeItem.id,
      media_type: activeItem.media_type,
      planned_duration_seconds: activeItem.playback_duration_seconds,
      actual_duration_seconds: actualDurationSeconds,
      started_at: slideStartedAtRef.current,
      ended_at: endedAtISO,
      status: overrideStatus || 'completed',
      failure_reason: failureReason || null,
      idempotency_key: slideIdempotencyKeyRef.current,
      player_session_id: sessionIdRef.current,
    };

    // 1. Salva de forma resiliente na fila local do localStorage
    enqueueLogToLocalQueue(logPayload);

    // 2. Tenta enviar imediatamente em segundo plano
    flushPendingLogsQueue(deviceToken);

    // 3. Avançar para o próximo slide sem travar a tela
    advanceIndexNext();
  };

  const advanceIndexNext = () => {
    setCurrentIndex((prev) => {
      const nextIdx = (prev + 1) % items.length;
      if (nextIdx === 0 && deviceToken) {
        // Recarregar playlist e assinar novas URLs ao terminar a volta no loop
        loadPlaylistAndStartPlayer(deviceToken);
      }
      return nextIdx;
    });
  };

  // 5. Início do Slide Atual (Geração de Idempotency Key)
  const activeItem = items[currentIndex];

  useEffect(() => {
    if (status !== 'playing' || !activeItem) return;

    const startedISO = new Date().toISOString();
    slideStartedAtRef.current = startedISO;

    const seed = `${screenInfo?.id || 'scr'}_${activeItem.media_id}_${activeItem.id}_${startedISO}_${sessionIdRef.current}_${Math.random()}`;
    generateIdempotencyKey(seed).then((key) => {
      slideIdempotencyKeyRef.current = key;
    });

    const durationMs = (activeItem.playback_duration_seconds || 10) * 1000;

    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);

    // Timer de segurança para transição da imagem ou de vídeo que exceda o tempo
    slideTimerRef.current = setTimeout(() => {
      finishCurrentSlideAndLog('completed');
    }, durationMs);

    return () => {
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, [currentIndex, status, activeItem]);

  // 6. Fluxo de Pareamento Inicial
  const initNewPairing = async () => {
    clearAllTimers();
    setStatus('loading');
    setMessage('');

    const secret = `${window.crypto.randomUUID()}_${Math.random().toString(36).substring(2)}`;
    pairingSecretRef.current = secret;

    const res = await requestPairingCodeAction(secret);

    if (!res.success || !res.code) {
      setStatus('error');
      setMessage(res.error || 'Erro ao comunicar com o servidor.');
      return;
    }

    const code = res.code;
    setPairingCode(code);
    setStatus('unpaired');
    setTimeLeft(600);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearAllTimers();
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollingRef.current = setInterval(async () => {
      if (!pairingSecretRef.current) return;
      const pollRes = await checkPairingStatusAction(code, pairingSecretRef.current);

      if (pollRes.status === 'paired' && pollRes.deviceToken) {
        clearAllTimers();
        const newToken = pollRes.deviceToken;
        localStorage.setItem('rede_indoor_device_token', newToken);
        setDeviceToken(newToken);
        await loadPlaylistAndStartPlayer(newToken);
      } else if (pollRes.status === 'expired' || pollRes.status === 'cancelled') {
        clearAllTimers();
        setStatus('expired');
      }
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between font-sans select-none overflow-hidden">
      {/* MODO REPRODUÇÃO EM TELA CHEIA (PLAYING) */}
      {status === 'playing' && activeItem && (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {activeItem.media_type === 'image' ? (
            <img
              key={activeItem.id}
              src={activeItem.signed_url}
              alt={activeItem.title}
              className="w-full h-full object-contain animate-in fade-in duration-500"
              onError={() => finishCurrentSlideAndLog('failed', 'Erro ao carregar URL da imagem')}
            />
          ) : (
            <video
              key={activeItem.id}
              src={activeItem.signed_url}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain animate-in fade-in duration-500"
              onEnded={() => finishCurrentSlideAndLog('completed')}
              onError={() => finishCurrentSlideAndLog('failed', 'Erro no codec ou player de vídeo')}
            />
          )}

          {/* Micro Overlay Discreto */}
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-[10px] text-slate-400 font-mono flex items-center gap-2 pointer-events-none opacity-40 hover:opacity-100 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{screenInfo?.name}</span>
            <span>•</span>
            <span>{currentIndex + 1}/{items.length}</span>
          </div>
        </div>
      )}

      {/* MODO SEM PLAYLIST ATIVA */}
      {status === 'no_playlist' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto space-y-6">
          <div className="bg-sky-500/10 p-5 rounded-3xl text-sky-400 border border-sky-500/20 shadow-2xl">
            <Tv className="w-16 h-16 animate-bounce" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white">{screenInfo?.name || 'TV Pareada'}</h2>
            <p className="text-sky-400 font-semibold text-lg mt-2">{message}</p>
          </div>
          <p className="text-slate-400 text-xs max-w-md">
            Acesse o painel em <strong className="text-slate-200">/screens</strong>, selecione esta TV e atribua uma playlist com mídias aprovadas.
          </p>
        </div>
      )}

      {/* MODO PLAYLIST VAZIA OU SEM MÍDIAS APROVADAS */}
      {status === 'no_items' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto space-y-6">
          <div className="bg-amber-500/10 p-5 rounded-3xl text-amber-400 border border-amber-500/20 shadow-2xl">
            <ListVideo className="w-16 h-16" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white">{playlistInfo?.name || 'Playlist Ativa'}</h2>
            <p className="text-amber-400 font-semibold text-lg mt-2">{message}</p>
          </div>
          <p className="text-slate-400 text-xs max-w-md">
            Acesse o montador da playlist em <strong className="text-slate-200">/playlists</strong> e inclua mídias com status Aprovada.
          </p>
        </div>
      )}

      {/* MODO NÃO PAREADO */}
      {status === 'unpaired' && pairingCode && (
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto p-8 space-y-8">
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-widest font-semibold mb-2">
              Código de Pareamento de Tela
            </p>
            <h2 className="text-6xl sm:text-8xl font-mono font-black text-sky-400 tracking-wider bg-slate-900 border-2 border-sky-500/30 px-8 py-6 rounded-3xl shadow-2xl shadow-sky-500/10">
              {pairingCode}
            </h2>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl max-w-xl space-y-3">
            <p className="text-base text-slate-200 font-semibold">
              Como vincular esta TV ao seu painel:
            </p>
            <ol className="text-sm text-slate-400 text-left space-y-1.5 list-decimal list-inside">
              <li>Acesse o painel no computador ou celular em <strong className="text-slate-200">/screens</strong>.</li>
              <li>Cadastre ou selecione a tela desejada nesta empresa.</li>
              <li>Digite o código de 6 dígitos acima no campo de pareamento.</li>
            </ol>
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm font-mono">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Validade do código: <strong className="text-slate-300">{formatTime(timeLeft)}</strong></span>
          </div>
        </div>
      )}

      {/* MODO CARREGANDO */}
      {status === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <RefreshCw className="w-12 h-12 animate-spin text-sky-400" />
          <p className="text-slate-400 text-lg font-medium">Inicializando player e obtendo playlist...</p>
        </div>
      )}

      {/* MODO EXPIRADO */}
      {status === 'expired' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
          <Clock className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Código de Pareamento Expirado</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            O código de 6 dígitos expira após 10 minutos por razões de segurança.
          </p>
          <button
            onClick={initNewPairing}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-xl text-sm transition inline-flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <RefreshCw className="w-4 h-4" /> Gerar Novo Código
          </button>
        </div>
      )}

      {/* MODO ERRO */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Falha ao Conectar</h2>
          <p className="text-rose-400 text-sm max-w-md mx-auto">{message}</p>
          <button
            onClick={initNewPairing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3 rounded-xl text-sm transition"
          >
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  );
}
