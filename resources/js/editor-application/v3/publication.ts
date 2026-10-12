import type { EditContext, SaveOutcome } from './session';

export interface PublicPreview { url: string; expiresAt: string }
export interface PublicationCandidate { token: string; hash: string; warnings: string[] }
export interface PublishedPage { url: string; hash: string; publishedAt: string }
export interface PublicationPort {
  preview(documentId: string, revision: number): Promise<PublicPreview>;
  prepare(documentId: string, revision: number): Promise<PublicationCandidate>;
  commit(token: string): Promise<PublishedPage>;
}
export interface PreparedPublication { revision: number; hash: string; warnings: string[] }

/** Uses the editor's save and edit epoch. No document copy or second history. */
export function createPublicationSession(editor: { context(): EditContext; save(): Promise<SaveOutcome> }, port: PublicationPort) {
  let pending = false;
  let generation = 0;
  let prepared: { context: EditContext; candidate: PublicationCandidate } | null = null;
  const current = (context: EditContext, exact = true) => {
    const latest = editor.context();
    return !latest.readonly && latest.documentId === context.documentId && latest.sessionId === context.sessionId
      && (!exact || latest.revision === context.revision);
  };
  function assertCurrent(context: EditContext, ticket: number, exact = true) {
    if (ticket !== generation || !current(context, exact)) throw new Error('편집 문맥이 변경되었습니다. 현재 내용을 다시 저장한 뒤 준비해 주세요.');
  }
  async function exclusive<T>(action: (context: EditContext, ticket: number) => Promise<T>): Promise<T> {
    if (pending) throw new Error('저장 또는 발행 요청을 처리 중입니다.');
    const context = { ...editor.context() }, ticket = generation;
    assertCurrent(context, ticket);
    pending = true;
    try { return await action(context, ticket); }
    finally { pending = false; }
  }
  async function saved(context: EditContext, ticket: number) {
    prepared = null;
    const result = await editor.save();
    assertCurrent(context, ticket);
    if (result.status !== 'saved') throw new Error('저장 중 추가 변경이 생겼습니다. 현재 내용을 다시 저장한 뒤 준비해 주세요.');
    return result.revision;
  }
  return {
    cancel() { generation++; prepared = null; },
    canCommit: () => prepared !== null && current(prepared.context),
    preview: () => exclusive(async (context, ticket) => {
      const revision = await saved(context, ticket);
      const preview = await port.preview(context.documentId, revision);
      assertCurrent(context, ticket);
      return { ...preview, revision, context };
    }),
    prepare: () => exclusive(async (context, ticket): Promise<PreparedPublication> => {
      const revision = await saved(context, ticket);
      const candidate = await port.prepare(context.documentId, revision);
      assertCurrent(context, ticket);
      prepared = { context, candidate: { ...candidate, warnings: [...candidate.warnings] } };
      return { revision, hash: candidate.hash, warnings: [...candidate.warnings] };
    }),
    commit: () => exclusive(async (_context, ticket) => {
      const selected = prepared;
      prepared = null; // A response failure is not permission to replay a commit.
      if (!selected) throw new Error('발행할 버전을 먼저 준비해 주세요.');
      assertCurrent(selected.context, ticket);
      const result = await port.commit(selected.candidate.token);
      assertCurrent(selected.context, ticket, false);
      if (result.hash !== selected.candidate.hash) throw new Error('발행 응답이 준비한 버전과 다릅니다. 공개 페이지 상태를 확인해 주세요.');
      return { ...result, edited: !current(selected.context) };
    }),
  };
}
