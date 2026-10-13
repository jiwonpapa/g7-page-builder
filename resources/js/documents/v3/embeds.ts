import type { EmbedSource } from './types';

/** Trusted URLs are generated from validated typed values, never supplied HTML or endpoints. */
export function embedTarget(source: EmbedSource): { kind: string; src: string; video: boolean } | null {
  if (source.provider === 'none') return null;
  const video = 'video_id' in source;
  let src: string;
  if (video) src = source.provider === 'youtube' ? `https://www.youtube-nocookie.com/embed/${source.video_id}?rel=0`
    : `https://player.vimeo.com/video/${source.video_id}`;
  else {
    const coordinate = (value: number) => String(Number(value.toFixed(6)));
    const center = encodeURIComponent(`${coordinate(source.latitude)},${coordinate(source.longitude)}`);
    if (source.provider === 'google') src = `https://www.google.com/maps?q=${center}&z=${source.zoom}&output=embed`;
    else {
      const delta = { 12: 0.12, 14: 0.03, 16: 0.008, 18: 0.002 }[source.zoom];
      const box = [Math.max(-180, source.longitude - delta), Math.max(-90, source.latitude - delta),
        Math.min(180, source.longitude + delta), Math.min(90, source.latitude + delta)].map(coordinate).join(',');
      src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&marker=${center}`;
    }
  }
  return { kind: (video ? 'video-' : 'map-') + source.provider, src, video };
}
