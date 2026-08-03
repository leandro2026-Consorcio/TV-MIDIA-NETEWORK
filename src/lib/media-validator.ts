export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
};

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'];

export const STANDARD_PLAYBACK_DURATIONS = [5, 10, 15, 30];

export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  mediaType?: 'image' | 'video';
  orientation?: 'horizontal' | 'vertical' | 'square' | 'unknown';
  width?: number;
  height?: number;
  durationSeconds?: number;
  suggestedPlaybackDuration?: number;
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
 * Extrai metadados técnicos (largura, altura, orientação, duração) e calcula o slot de exibição (arredondado para múltiplos de 5s)
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
          suggestedPlaybackDuration: 10,
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

  // Validação de Vídeo com Duração Livre e Arredondamento Automático para múltiplos de 5s
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

      // Cálculo do slot de cobrança / exibição: Arredonda para cima em múltiplos de 5 segundos
      // Exemplo: 4.2s -> 5s | 31.4s -> 35s | 42s -> 45s
      const calculatedSlotDuration = Math.max(5, Math.ceil(durationSeconds / 5) * 5);

      resolve({
        isValid: true,
        mediaType: 'video',
        width,
        height,
        durationSeconds,
        suggestedPlaybackDuration: calculatedSlotDuration,
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

