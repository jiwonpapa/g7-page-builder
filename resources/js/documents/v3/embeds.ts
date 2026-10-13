import type { EmbedSource } from './types';

export const EMBED_FRAME_STYLE = { display: 'block', width: '100%', height: '100%', border: '0', 'min-width': '0', 'min-height': '0' };
/** Trusted URLs are generated from validated typed values, never supplied HTML or endpoints. */
export function embedTarget(source: EmbedSource): { kind: string; src: string; video: boolean } | null {
  switch (source.provider) {
    case 'none': return null;
    case 'youtube': return { kind: 'video-youtube', src: `https://www.youtube-nocookie.com/embed/${source.video_id}?rel=0`, video: true };
    case 'vimeo': return { kind: 'video-vimeo', src: `https://player.vimeo.com/video/${source.video_id}`, video: true };
    case 'google': case 'openstreetmap': {
      const coordinate = (value: number) => String(Number(value.toFixed(6)));
      const center = encodeURIComponent(`${coordinate(source.latitude)},${coordinate(source.longitude)}`);
      if (source.provider === 'google') return { kind: 'map-google', src: `https://www.google.com/maps?q=${center}&z=${source.zoom}&output=embed`, video: false };
      const delta = { 12: 0.12, 14: 0.03, 16: 0.008, 18: 0.002 }[source.zoom];
      const box = [Math.max(-180, source.longitude - delta), Math.max(-90, source.latitude - delta),
        Math.min(180, source.longitude + delta), Math.min(90, source.latitude + delta)].map(coordinate).join(',');
      return { kind: 'map-openstreetmap', src: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&marker=${center}`, video: false };
    }
  }
}
