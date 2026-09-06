# Site Kit v1

3차는 새 초안 설치를 지원한다. 상품 결제나 기존 사이트 덮어쓰기를 포함하지 않는다.

- `schema_version=g7pb-site-kit/v1`, kit identity/version (SemVer), locale, PHP/G7/Page Builder compatibility, 1~20 pages, Header/Footer canonical documents and media SHA-256 manifest.
- Page sources remain `PageBuilderDocument`; parts remain `SitePartDocument`. HTML, G7 JSON UI, Puck state are never installation sources. Page design tokens live in each canonical document; this sample shares the same token values. There is no new global theme token format.
- Each page has a unique stable `key`, title, suggested path and canonical document. `g7pb-page://<key>` references become explicitly reviewed paths throughout pages and menu/link props. Missing references, duplicate paths, native/reserved paths and incompatible sources fail closed.
- `g7pb-media://<id>` references resolve to newly imported module-owned media. The bundled package declares relative resource paths and exact SHA-256; directory traversal, missing files and modified bytes are rejected.
- GET `admin/site-kits` lists bundled kits; POST `admin/site-kits/preview` accepts `kit_id` and complete `paths` map and compiles without saving. It reports per-page conflicts and the complete installation composition.
- POST `admin/site-kits/install` also takes exact `kit_version`, installation `title` and client-generated UUIDv4 `request_id`. Read/create/update permission is required. No publishing or activation is performed.
- The same actor, request ID and normalized payload return the first committed receipt. Changed payload/version or another actor cannot reuse it. A unique receipt row serializes concurrent retries. A failed attempt rolls back its receipt, documents, revisions, address reservations and Site Part set in one module DB transaction; imported files are compensated before rollback. This does not claim a distributed transaction between database and filesystem.
- A new inactive Header/Footer set is created even when no active set exists. Existing source rows and publication pointers remain unchanged. Page slugs and all document/block identities are fresh; canonical `/pages/:slug` routes remain available after publication.
- Public paths activate under the phase-2 rules only after each page is successfully published. The user edits and publishes each page, then publishes the Header/Footer pair and explicitly activates that set. Changing existing page addresses after installation does not automatically rewrite already-saved menu links.
- Preview is advisory: conflicts are checked again inside installation and address uniqueness is enforced by the database. Existing native G7 routes continue to win if new conflicts arise later.

The sample is three informational pages, not a live inquiry form. Contact instructions must be replaced with the site's actual contact details before publishing. Full theme/function-screen compatibility remains a subsequent phase.
