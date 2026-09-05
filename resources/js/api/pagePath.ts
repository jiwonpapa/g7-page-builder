export interface PagePathResource {
  path: string | null;
  lock_version: number;
  active: boolean;
  reason: string | null;
}

export function parsePagePathResource(value: unknown): PagePathResource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('페이지 주소 응답을 확인할 수 없습니다.');
  const row: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  if ((row.path !== null && (typeof row.path !== 'string' || row.path.length > 240
    || !/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,7}$/.test(row.path)))
    || typeof row.lock_version !== 'number' || !Number.isSafeInteger(row.lock_version) || row.lock_version < 0
    || typeof row.active !== 'boolean' || (row.reason !== null && typeof row.reason !== 'string')
    || (row.active && row.path === null)) throw new Error('페이지 주소 응답 형식이 올바르지 않습니다.');
  return { path: row.path, lock_version: row.lock_version, active: row.active, reason: row.reason };
}
