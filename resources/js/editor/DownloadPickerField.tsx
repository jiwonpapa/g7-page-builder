import React, { useEffect, useRef, useState } from 'react';
import type { Field } from '@puckeditor/core';

import { PageBuilderApiClient, PageBuilderApiError } from '../api/pageBuilderApi';
import type { MediaAssetResource } from '../documents/types';

const api = new PageBuilderApiClient();
const DOWNLOAD_ACCEPT = '.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileLabel(asset: MediaAssetResource): string {
  const extension = asset.original_name.split('.').pop()?.toLocaleUpperCase() || 'FILE';
  return `${extension} · ${formatBytes(asset.bytes)}`;
}

function DownloadPicker({
  value,
  onChange,
  readOnly,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  label: string;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAssetResource[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || attempted) return;
    setAttempted(true);
    setLoading(true);
    void api.listMedia('download')
      .then((result) => setAssets(result.items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '다운로드 파일을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [attempted, open]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const asset = await api.uploadMedia(file, 'download');
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      onChange(asset.url);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof PageBuilderApiError ? reason.message : '파일을 업로드하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="g7pb-download-field">
    <label>{label}</label>
    <div className="g7pb-download-field__actions">
      <button type="button" data-testid="page-builder-download-open" disabled={readOnly}
        onClick={() => setOpen((current) => !current)}>{open ? '파일 목록 닫기' : '업로드 · 파일 선택'}</button>
      {value ? <button type="button" disabled={readOnly} onClick={() => onChange('')}>비우기</button> : null}
    </div>
    <input type="url" value={value ?? ''} disabled={readOnly} aria-label={`${label} URL`}
      placeholder="또는 /storage/... 파일 URL" onChange={(event) => onChange(event.currentTarget.value)} />
    <input ref={inputRef} className="g7pb-visually-hidden" data-testid="page-builder-download-file"
      type="file" accept={DOWNLOAD_ACCEPT} disabled={readOnly} onChange={(event) => void upload(event)} />
    {open ? <div className="g7pb-download-field__library" data-testid="page-builder-download-library">
      <div className="g7pb-download-field__library-head">
        <div><strong>다운로드 파일</strong><span>PDF·ZIP·문서·스프레드시트·프레젠테이션</span></div>
        <button type="button" disabled={readOnly || loading} onClick={() => inputRef.current?.click()}>
          {loading ? '처리 중…' : '파일 업로드'}
        </button>
      </div>
      {error ? <p role="alert" className="g7pb-media-field__error">{error}</p> : null}
      {loading && assets.length === 0 ? <p>불러오는 중…</p> : null}
      {!loading && assets.length === 0 ? <p>업로드된 다운로드 파일이 없습니다.</p> : null}
      <div className="g7pb-download-field__list">
        {assets.map((asset) => <button type="button" key={asset.id} disabled={readOnly}
          className={asset.url === value ? 'is-selected' : ''} data-testid="page-builder-download-item"
          onClick={() => { onChange(asset.url); setOpen(false); }}>
          <span aria-hidden="true">↓</span><strong>{asset.original_name}</strong><small>{fileLabel(asset)}</small>
        </button>)}
      </div>
    </div> : null}
  </div>;
}

export function createDownloadField(label: string): Field<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => <DownloadPicker
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      readOnly={readOnly}
      label={label}
    />,
  };
}
