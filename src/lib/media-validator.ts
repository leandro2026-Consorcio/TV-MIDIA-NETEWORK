export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
};

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'];

export const ALLOWED_PLAYBACK_DURATIONS = [5, 10, 15, 30] as const;

export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  mediaType?: 'image' | 'video';
  orientation?: 'horizontal' | 'vertical' | 'square' | 'unknown';
  width?: number;
  height?: number;
  durationSeconds?: number;
  suggestedPlaybackDuration?: 5 | 10 | 15 | 30;
}

/**
 * Valida MIME Type e Extensão do Arquivo
 */
export function validateFileType(file: File): { isValid: boolean; error?: string; mediaType?: 'image' | 'video' } {
  const mimeType = file.type.toLowerCase();
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();

  const isImageMime = ALLOWED_MIME_TYPES.image.includes(mimeType);
  const isVideoMime = ALLOWED_MIME_TYPES.video.includes(mimeType);
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(extension);

  if (!isAllowedExt || (!isImageMime && !isVideoMime)) {
    return {
      isValid: false,
      error: `Formato de arquivo não suportado (${file.name}). Envie apenas imagens (.jpg, .jpeg, .png, .webp) ou vídeos (.mp4, .webm).`,
    };
  }

  return {
    isValid: true,
    mediaType: isImageMime ? 'image' : 'video',
  };
}

/**
 * Extrai metadados técnicos (largura, altura, orientação, duração) e aplica regras de tolerância (±0.5s)
 */
export async function extractMediaMetadata(file: File): Promise<MediaValidationResult> {
  const typeCheck = validateFileType(file);
  if (!typeCheck.isValid || !typeCheck.mediaType) {
    return { isValid: false, error: typeCheck.error };
  }

  const mediaType = typeCheck.mediaType;

  if (mediaType === 'image') {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);

        let orientation: 'horizontal' | 'vertical' | 'square' = 'horizontal';
        if (height > width) {
          orientation = 'vertical';
        } else if (width === height) {
          orientation = 'square';
        }

        resolve({
          isValid: true,
          mediaType: 'image',
          width,
          height,
          orientation,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          isValid: false,
          error: 'Falha ao carregar e analisar os metadados da imagem.',
        });
      };

      img.src = objectUrl;
    });
  }

  // Validação de Vídeo
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const width = video.videoWidth;
      const height = video.videoHeight;
      const durationSeconds = Math.round(video.duration * 10) / 10; // Arredonda para 1 casa decimal

      let orientation: 'horizontal' | 'vertical' | 'square' = 'horizontal';
      if (height > width) {
        orientation = 'vertical';
      } else if (width === height) {
        orientation = 'square';
      }

      // Regra 1: Bloquear vídeos com mais de 30.5 segundos
      if (durationSeconds > 30.5) {
        resolve({
          isValid: false,
          error: `O vídeo ultrapassa a duração máxima permitida de 30 segundos (Duração do arquivo: ${durationSeconds}s).`,
        });
        return;
      }

      // Regra 2: Encontrar duração padrão mais próxima (5, 10, 15, 30) com tolerância de ±0.5s
      let matchedPlaybackDuration: 5 | 10 | 15 | 30 | null = null;

      for (const target of ALLOWED_PLAYBACK_DURATIONS) {
        if (Math.abs(durationSeconds - target) <= 0.5) {
          matchedPlaybackDuration = target;
          break;
        }
      }

      if (!matchedPlaybackDuration) {
        resolve({
          isValid: false,
          error: `Duração do vídeo (${durationSeconds}s) fora do padrão aceito. O vídeo deve ter exatamente 5s, 10s, 15s ou 30s (tolerância de ±0.5s).`,
        });
        return;
      }

      resolve({
        isValid: true,
        mediaType: 'video',
        width,
        height,
        durationSeconds,
        suggestedPlaybackDuration: matchedPlaybackDuration,
        orientation,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        isValid: false,
        error: 'Falha ao processar metadados do arquivo de vídeo.',
      });
    };

    video.src = objectUrl;
  });
}
