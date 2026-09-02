import React from 'react';
import type { useManagerBlockPacks } from './useManagerBlockPacks';

export function ManagerBlockPacksDialog({ controller }: { controller: ReturnType<typeof useManagerBlockPacks> }): React.ReactElement {
  const { blockPacksOpen, closeBlockPacks, blockPacks, blockPacksLoading, blockPackBusy, githubOwner,
    setGithubOwner, githubRepository, setGithubRepository, githubAssetName, setGithubAssetName, githubCheck,
    checkGitHubBlockPack, installGitHubBlockPack, installBlockPack, changeBlockPackState, removeBlockPack } = controller;
  return <>
      {blockPacksOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-block-packs-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-block-packs-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">블록 라이브러리 출처</p>
                <h2 id="g7pb-block-packs-heading">추가 블록·완성 섹션 관리</h2>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={closeBlockPacks}>닫기</button>
            </div>
            <p className="g7pb-block-pack-destination">활성화된 항목은 각 페이지 편집기 상단 <strong>블록 추가</strong>에 합쳐집니다. 출처 필터로 기본 제공과 설치 팩을 구분할 수 있습니다.</p>
            <div className="g7pb-block-pack-toolbar">
              <div>
                <strong>로컬 ZIP 설치</strong>
                <span>Data Preset Pack은 검증 후 활성화됩니다. Code Pack은 신뢰 서명 검증을 통과해야 설치됩니다.</span>
              </div>
              <label className="g7pb-button g7pb-button--primary">
                <input type="file" accept=".zip,application/zip" className="sr-only"
                  data-testid="page-builder-block-pack-upload" disabled={blockPackBusy !== null}
                  onChange={(event) => void installBlockPack(event)} />
                {blockPackBusy === 'install' ? '검증·설치 중' : 'ZIP 추가'}
              </label>
            </div>
            <section className="g7pb-block-pack-github" aria-labelledby="g7pb-block-pack-github-heading">
              <div className="g7pb-block-pack-github__heading">
                <div>
                  <strong id="g7pb-block-pack-github-heading">GitHub Release에서 확인</strong>
                  <span>생성일 기준 latest가 아니라 가장 높은 안정 SemVer를 찾고, asset SHA-256 확인 뒤에만 설치합니다.</span>
                </div>
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={blockPackBusy !== null} onClick={() => void checkGitHubBlockPack()}>
                  {blockPackBusy === 'github-check' ? '확인 중' : '최신 버전 확인'}
                </button>
              </div>
              <div className="g7pb-block-pack-github__fields">
                <label>소유자
                  <input value={githubOwner} placeholder="예: jiwonpapa"
                    onChange={(event) => setGithubOwner(event.target.value)} />
                </label>
                <label>저장소
                  <input value={githubRepository} placeholder="예: g7-block-packs"
                    onChange={(event) => setGithubRepository(event.target.value)} />
                </label>
                <label>Release ZIP asset
                  <input value={githubAssetName}
                    onChange={(event) => setGithubAssetName(event.target.value)} />
                </label>
              </div>
              {githubCheck && (
                <div className="g7pb-block-pack-github__result" data-testid="page-builder-github-pack-result">
                  <div>
                    <strong>{githubCheck.release.repository} · v{githubCheck.release.version}</strong>
                    <span>설치됨 {githubCheck.installed_version ?? '없음'} · SHA-256 {githubCheck.release.sha256.slice(0, 12)}…</span>
                  </div>
                  {githubCheck.update_available ? (
                    <button type="button" className="g7pb-button g7pb-button--primary"
                      disabled={blockPackBusy !== null} onClick={() => void installGitHubBlockPack()}>
                      {blockPackBusy === 'github-install' ? '검증·설치 중' : '이 버전 설치'}
                    </button>
                  ) : <strong className="g7pb-block-pack-github__current">최신 상태</strong>}
                </div>
              )}
            </section>
            {blockPacksLoading ? (
              <div className="g7pb-manager-loading" role="status">블록 팩을 불러오는 중입니다.</div>
            ) : (
              <div className="g7pb-block-pack-list">
                {blockPacks.map((pack) => {
                  const key = `${pack.pack_id}@${pack.pack_version}`;
                  const inUse = Boolean(pack.usage && (pack.usage.documents > 0 || pack.usage.revisions > 0));
                  return (
                    <article className="g7pb-block-pack-row" key={key} data-testid="page-builder-block-pack-row">
                      <div className="g7pb-block-pack-row__identity">
                        <span>{pack.kind === 'data' ? 'Data Preset' : 'Code'} Pack</span>
                        <strong>{pack.pack_id}</strong>
                        <small>v{pack.pack_version} · {pack.publisher.name} · 블록 {pack.blocks} / 완성 섹션 {pack.presets}</small>
                        <small>사용 위치: 편집기 → 블록 추가 → {pack.pack_id.split('/').at(-1)?.replace(/[-_]+/g, ' ')}</small>
                      </div>
                      <div className="g7pb-block-pack-row__state">
                        <strong data-state={pack.state}>{pack.state}</strong>
                        {pack.source === 'builtin' ? <span>제품 내장</span> : inUse
                          ? <span>문서 {pack.usage?.documents} · 리비전 {pack.usage?.revisions} 사용 중</span>
                          : <span>안전하게 제거 가능</span>}
                      </div>
                      <div className="g7pb-block-pack-row__actions">
                        {pack.source !== 'builtin' && !['quarantined', 'retired'].includes(pack.state) && (
                          <button type="button" className="g7pb-button g7pb-button--quiet"
                            disabled={blockPackBusy !== null}
                            onClick={() => void changeBlockPackState(pack)}>
                            {pack.state === 'enabled' ? '비활성화' : '활성화'}
                          </button>
                        )}
                        {pack.source !== 'builtin' && (
                          <button type="button" className="g7pb-button g7pb-button--danger"
                            disabled={blockPackBusy !== null || pack.state === 'enabled' || inUse}
                            title={pack.state === 'enabled' ? '먼저 비활성화해 주세요.' : inUse ? '문서와 리비전에서 사용 중입니다.' : undefined}
                            onClick={() => void removeBlockPack(pack)}>
                            {blockPackBusy === key ? '처리 중' : '제거'}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
  </>;
}
