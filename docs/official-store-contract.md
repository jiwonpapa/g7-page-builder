# Official Free Store Contract

Status: **Prototype consumer/distribution contract for `0.10.0`**

> 이 문서는 `g7-page-builder` 내부 정적 catalog fixture와 설치·적용
> 소비자 계약을 설명합니다. 별도 마켓 모듈, 마켓 DB, 상품 관리자,
> 업로드·검증·게시 UI가 구현됐다는 의미가 아닙니다. 향후 독립 마켓은
> [Market 모듈 스펙 주도 개발 명세](market-module-spec.md)를 따릅니다.

## Product boundary

The Page Builder Store is a **single-publisher distribution channel** owned by
`jiwonpapa` (지원소프트). It is not a multi-vendor marketplace.

Included in the first release:

- free Block Packs published by 지원소프트;
- free Page Kits published by 지원소프트;
- catalog browsing, search, filtering, detail preview, compatibility status;
- digest-verified Block Pack installation from the catalog;
- Page Kit application as a new unpublished Page Builder draft;
- operator-only Page Kit ZIP export and catalog/artifact build tooling;
- a catalog and artifact endpoint hosted by the Page Builder module on the
  official distribution server.

Explicitly excluded:

- third-party submission, seller accounts, reviews, payouts, commissions;
- payment, entitlement, license-key, subscription, DRM, telemetry;
- remote executable code not covered by the existing trusted Code Pack
  signature policy;
- overwriting an existing document, publication, home route, active G7
  template, Header, Footer, Site Shell, or G7 core data;
- importing revision history, author identity, publication state, or route
  ownership from a Page Kit.

Paid products may be added later by extending the catalog and entitlement
contract. No dormant payment or seller workflow is included in this release.

## Product types

### Block Pack

The existing `g7pb-block-pack/v1` archive remains authoritative. Store
installation adds the source value `store`; all archive, manifest,
compatibility, digest, and Code Pack signature checks remain mandatory.

### Page Kit

A Page Kit is a portable snapshot of one Page Builder page:

```text
manifest.json
document.json
media/<media-id>.<extension>   # optional
```

The manifest version is `g7pb-page-kit/v1`. The document is a canonical
`g7-page-builder/v1` document, but its `document_id`, slug, and block instance
identities are templates only. Import always creates fresh identities.

Media references use `g7pb-media://<media-id>`. Route references may use
`g7pb-route://<route-id>` for a parameterless route from the active G7 route
catalog. Missing blocks, media, or routes fail before persistence.

## Catalog

The official catalog version is `g7pb-store/v1`. Every item has:

- a stable `product_id` in the `jiwonpapa/*` namespace;
- `product_type` of `block_pack` or `page_kit`;
- SemVer `product_version`;
- fixed `license: free` in this release;
- localized title and description, category, tags, and preview metadata;
- Page Builder/G7/PHP compatibility constraints;
- an HTTPS artifact URL, byte size, and SHA-256 digest.

The client trusts only the configured catalog URL, the configured artifact
hosts, and publisher id `jiwonpapa`. It never installs a URL supplied by a
browser request.

## Installation and application flow

### Block Pack

1. Fetch and validate the official catalog.
2. Resolve the requested id/version from that catalog.
3. Download only the catalog-declared artifact from an allow-listed host.
4. Enforce size limit and SHA-256.
5. Run the existing Block Pack archive, compatibility, and signature gates.
6. Register and enable the pack; keep usage-aware disable/remove behavior.

### Page Kit

1. Fetch and validate the catalog, artifact URL, size, and digest.
2. Reject path traversal, links, duplicate entries, undeclared files,
   unsupported MIME types, excessive file count, or expanded size.
3. Validate manifest, document schema, required block availability, media
   digests, and route placeholders.
4. Replace all document and block instance ids with fresh UUIDs.
5. Store bundled media and replace `g7pb-media://` references with local URLs.
6. Resolve supported `g7pb-route://` references from the active G7 route
   catalog.
7. Compile the transformed document before persistence.
8. Create exactly one new draft with the administrator-provided title and
   slug. Default `shell_mode` is `template`.
9. On failure, remove only media created by this attempt and create no draft.

Applying a Page Kit never publishes it and never changes `/`, existing public
routes, template layouts, Header, Footer, or Site Shell.

## Official publishing flow

The operator creates a page normally, then exports a Page Kit ZIP from the
document manager. Export embeds module-owned images, replaces their URLs with
portable media references, removes runtime identity/publication/history data,
and emits file digests.

Publishing to the official store is a repository/operator operation:

1. review the exported Page Kit or Block Pack;
2. place it in the official store source directory;
3. run the store build command;
4. validate schemas, compatibility, archive digest, and duplicate versions;
5. deploy the generated catalog and immutable artifacts to the official
   distribution server.

There is deliberately no public upload endpoint.

## Error and rollback contract

- Catalog unavailable: show cached/empty state and keep installed assets.
- Compatibility failure: disable the action and state the failing requirement.
- Download/digest/archive failure: install nothing.
- Page Kit validation/compile failure: create no document.
- Media rollback failure: log a correlation id without deleting pre-existing
  media.
- An installed Block Pack and an imported Page remain usable if the official
  distribution server is unavailable later.

## Required regression gates

- JSON Schema fixtures for catalog and Page Kit;
- domain rejection tests for foreign publisher, paid license, unsafe URL,
  duplicate product identity, invalid SemVer, and digest;
- archive tests for zip-slip, undeclared files, digest, size, MIME, and media
  placeholder replacement;
- application tests for fresh ids, new draft only, compile-before-create,
  missing dependency/route fail-closed, and media rollback;
- integration tests for authenticated catalog, Block Pack install, Page Kit
  apply, Page Kit export, permission denial, and route isolation;
- browser test for browse -> preview -> install/apply -> open new draft;
- static boundary checks proving no G7 core/model/table/template/layout import.
