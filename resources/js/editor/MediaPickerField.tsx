import React, { useEffect, useRef, useState } from 'react';
import type { Field } from '@puckeditor/core';

import { PageBuilderApiClient, PageBuilderApiError } from '../api/pageBuilderApi';
import type { MediaAssetResource } from '../documents/types';

const api = new PageBuilderApiClient();
export const OPEN_MEDIA_PICKER_EVENT = 'g7pb:open-selected-media-picker';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function MediaPicker({
  value,
  onChange,
  readOnly,
  label,
  pickerKey,
  initiallyOpen = false,
  onDismiss,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  label: string;
  pickerKey?: string;
  initiallyOpen?: boolean;
  onDismiss?: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  const [assets, setAssets] = useState<MediaAssetResource[]>([]);
  const [assetsAttempted, setAssetsAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || assets.length > 0 || assetsAttempted) return;
    setAssetsAttempted(true);
    setLoading(true);
    void api.listMedia('image')
      .then((result) => setAssets(result.items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '미디어를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [assets.length, assetsAttempted, open]);

  useEffect(() => {
    if (readOnly) return undefined;
    const openFromCanvas = (event: Event): void => {
      if (pickerKey && (!(event instanceof CustomEvent) || event.detail?.pickerKey !== pickerKey)) return;
      setOpen(true);
    };
    window.addEventListener(OPEN_MEDIA_PICKER_EVENT, openFromCanvas);
    return () => window.removeEventListener(OPEN_MEDIA_PICKER_EVENT, openFromCanvas);
  }, [pickerKey, readOnly]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const asset = await api.uploadMedia(file, 'image');
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      onChange(asset.url);
      setOpen(false);
      onDismiss?.();
    } catch (reason) {
      setError(reason instanceof PageBuilderApiError ? reason.message : '이미지를 업로드하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="g7pb-media-field">
      <label>{label}</label>
      {value ? <img className="g7pb-media-field__current" src={value} alt="현재 선택 이미지" /> : null}
      <div className="g7pb-media-field__actions">
        <button type="button" data-testid="page-builder-media-open" onClick={() => setOpen((current) => {
          if (current) onDismiss?.();
          return !current;
        })} disabled={readOnly}>
          {open ? '미디어 닫기' : '업로드 · 미디어 선택'}
        </button>
        {value ? <button type="button" onClick={() => onChange('')} disabled={readOnly}>비우기</button> : null}
      </div>
      <input
        type="url"
        value={value ?? ''}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="또는 https:// 이미지 URL"
        disabled={readOnly}
        aria-label={`${label} URL`}
      />
      <input
        ref={inputRef}
        data-testid="page-builder-media-file"
        className="g7pb-visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={(event) => void upload(event)}
        disabled={readOnly}
      />
      {open ? (
        <div className="g7pb-media-field__library" data-testid="page-builder-media-library">
          <div className="g7pb-media-field__library-head">
            <strong>미디어 라이브러리</strong>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={readOnly || loading}>
              {loading ? '처리 중…' : '파일 업로드'}
            </button>
          </div>
          {error ? <p role="alert" className="g7pb-media-field__error">{error}</p> : null}
          {loading && assets.length === 0 ? <p>불러오는 중…</p> : null}
          {!loading && assets.length === 0 ? <p>업로드된 이미지가 없습니다.</p> : null}
          <div className="g7pb-media-field__grid">
            {assets.map((asset) => (
              <button
                type="button"
                key={asset.id}
                className={asset.url === value ? 'is-selected' : ''}
                data-testid="page-builder-media-item"
                onClick={() => { onChange(asset.url); setOpen(false); onDismiss?.(); }}
                disabled={readOnly}
                title={`${asset.original_name} · ${asset.width}×${asset.height} · ${formatBytes(asset.bytes)}`}
              >
                <img src={asset.url} alt="" loading="lazy" />
                <span>{asset.original_name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CanvasMediaPicker({
  value,
  onChange,
  onDismiss,
}: {
  value: string;
  onChange: (next: string) => void;
  onDismiss: () => void;
}): React.ReactElement {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    void import('@puckeditor/core').then(({ registerOverlayPortal }) => {
      if (active) cleanup = registerOverlayPortal(overlayRef.current, { disableDrag: true, disableDragOnFocus: true });
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);
  return <div ref={overlayRef} className="g7pb-canvas-dialog" role="dialog" aria-modal="true" aria-label="선택 이미지 편집"
    data-testid="page-builder-canvas-media-dialog">
    <MediaPicker value={value} onChange={onChange} label="선택 이미지" initiallyOpen onDismiss={onDismiss} />
  </div>;
}

export function createMediaField(label: string, pickerKey?: string): Field<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => (
      <MediaPicker value={typeof value === 'string' ? value : ''} onChange={onChange} readOnly={readOnly} label={label} pickerKey={pickerKey} />
    ),
  };
}
