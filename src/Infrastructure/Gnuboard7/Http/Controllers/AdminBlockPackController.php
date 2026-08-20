<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\GitHubBlockPackService;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInUseException;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRules;

final class AdminBlockPackController
{
    public function __construct(
        private readonly BlockPackManager $packs,
        private readonly BlockRegistry $registry,
        private readonly GitHubBlockPackService $github,
    ) {}

    public function index(): JsonResponse
    {
        $items = [];
        foreach ($this->registry->registeredManifests() as $manifest) {
            if ($manifest->packId !== 'jiwonpapa/builtin-core') {
                continue;
            }
            $items[] = $this->builtInData($manifest);
        }
        foreach ($this->packs->all() as $installation) {
            $usage = $this->packs->usage($installation->manifest->packId, $installation->manifest->packVersion);
            $items[] = [
                ...$this->installationData($installation),
                'usage' => ['documents' => $usage->documents, 'revisions' => $usage->revisions],
            ];
        }

        return $this->success('블록 팩 목록을 조회했습니다.', ['items' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'archive' => ['required', 'file', 'max:51200'],
            'archive_sha256' => ['nullable', 'regex:/^[a-f0-9]{64}$/'],
            'enable' => ['nullable', 'boolean'],
        ]);
        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_ARCHIVE_INVALID', '50MB 이하의 올바른 블록 팩 ZIP을 선택해 주세요.');
        }

        $archive = $request->file('archive');
        if (! $archive instanceof UploadedFile || ! $archive->isValid()) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_ARCHIVE_INVALID', '업로드한 블록 팩 ZIP을 읽지 못했습니다.');
        }
        $archivePath = $archive->getRealPath();
        if (! is_string($archivePath)) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_ARCHIVE_INVALID', '업로드한 블록 팩 ZIP 경로를 확인하지 못했습니다.');
        }

        try {
            $installation = $this->packs->installLocal(
                archivePath: $archivePath,
                actorId: $this->actorId($request),
                enable: $request->boolean('enable', true),
                expectedSha256: $request->string('archive_sha256')->toString() ?: null,
            );

            return $this->success('블록 팩을 검증하고 설치했습니다.', $this->installationData($installation), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_ARCHIVE_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_BLOCK_PACK_INSTALL_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function state(Request $request): JsonResponse
    {
        $identity = $this->identity($request);
        $state = $request->input('state');
        if ($identity === null || ! in_array($state, ['enabled', 'disabled'], true)) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_STATE_INVALID', '블록 팩 상태 요청이 올바르지 않습니다.');
        }

        try {
            $installation = $state === 'enabled'
                ? $this->packs->enable($identity['pack_id'], $identity['pack_version'])
                : $this->packs->disable($identity['pack_id'], $identity['pack_version']);

            return $this->success('블록 팩 상태를 변경했습니다.', $this->installationData($installation));
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_BLOCK_PACK_STATE_REJECTED', $exception->getMessage());
        }
    }

    public function destroy(Request $request): JsonResponse
    {
        $identity = $this->identity($request);
        if ($identity === null) {
            return $this->error($request, 422, 'G7PB_BLOCK_PACK_IDENTITY_INVALID', '블록 팩 식별자가 올바르지 않습니다.');
        }

        try {
            $this->packs->remove($identity['pack_id'], $identity['pack_version']);

            return $this->success('블록 팩 파일과 등록 정보를 제거했습니다.', $identity);
        } catch (BlockPackInUseException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
                'data' => [
                    'code' => 'G7PB_BLOCK_PACK_IN_USE',
                    'usage' => [
                        'documents' => $exception->usage->documents,
                        'revisions' => $exception->usage->revisions,
                    ],
                    'correlation_id' => $this->correlationId($request),
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_BLOCK_PACK_REMOVE_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function githubCheck(Request $request): JsonResponse
    {
        $source = $this->githubSource($request);
        if ($source === null) {
            return $this->error($request, 422, 'G7PB_GITHUB_SOURCE_INVALID', 'GitHub 저장소와 ZIP asset 이름이 올바르지 않습니다.');
        }

        try {
            $result = $this->github->check($source['owner'], $source['repository'], $source['asset_name']);

            return $this->success('설치 가능한 최신 안정 버전을 확인했습니다.', [
                'release' => $this->releaseData($result['release']),
                'installed_version' => $result['installed_version'],
                'update_available' => $result['update_available'],
            ]);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_GITHUB_SOURCE_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 404, 'G7PB_GITHUB_RELEASE_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function githubInstall(Request $request): JsonResponse
    {
        $source = $this->githubSource($request);
        if ($source === null) {
            return $this->error($request, 422, 'G7PB_GITHUB_SOURCE_INVALID', 'GitHub 저장소와 ZIP asset 이름이 올바르지 않습니다.');
        }

        try {
            $installation = $this->github->installLatest(
                owner: $source['owner'],
                repository: $source['repository'],
                assetName: $source['asset_name'],
                actorId: $this->actorId($request),
                enable: $request->boolean('enable', true),
            );

            return $this->success('GitHub Release asset의 digest를 확인하고 설치했습니다.', $this->installationData($installation), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_GITHUB_SOURCE_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_GITHUB_INSTALL_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    /** @return array{owner: string, repository: string, asset_name: string}|null */
    private function githubSource(Request $request): ?array
    {
        $owner = $request->input('owner');
        $repository = $request->input('repository');
        $assetName = $request->input('asset_name', 'g7pb-block-pack.zip');
        if (! is_string($owner) || ! is_string($repository) || ! is_string($assetName)
            || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $owner) !== 1
            || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $repository) !== 1
            || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/i', $assetName) !== 1) {
            return null;
        }

        return ['owner' => $owner, 'repository' => $repository, 'asset_name' => $assetName];
    }

    /** @return array<string, mixed> */
    private function releaseData(BlockPackRelease $release): array
    {
        return [
            'repository' => $release->repositoryIdentity(),
            'tag' => $release->tag,
            'version' => $release->version,
            'asset_name' => $release->assetName,
            'asset_bytes' => $release->assetBytes,
            'sha256' => $release->sha256,
            'release_url' => $release->releaseUrl,
            'published_at' => $release->publishedAt->format(DATE_ATOM),
        ];
    }

    /** @return array{pack_id: string, pack_version: string}|null */
    private function identity(Request $request): ?array
    {
        $packId = $request->input('pack_id');
        $packVersion = $request->input('pack_version');
        if (! is_string($packId) || ! is_string($packVersion)) {
            return null;
        }
        try {
            BlockPackRules::assertPackId($packId);
            BlockPackRules::assertSemver($packVersion, 'version');
        } catch (\InvalidArgumentException) {
            return null;
        }

        return ['pack_id' => $packId, 'pack_version' => $packVersion];
    }

    /** @return array<string, mixed> */
    private function installationData(BlockPackInstallation $installation): array
    {
        return [
            'pack_id' => $installation->manifest->packId,
            'pack_version' => $installation->manifest->packVersion,
            'kind' => $installation->manifest->kind,
            'publisher' => $installation->manifest->publisher,
            'state' => $installation->state->value,
            'source' => $installation->source,
            'source_uri' => $installation->sourceUri,
            'archive_sha256' => $installation->archiveSha256,
            'blocks' => count($installation->manifest->blocks),
            'presets' => count($installation->manifest->presets),
            'runtime_active' => $this->registry->resolvedVersion($installation->manifest->packId)
                === $installation->manifest->packVersion,
            'editor_asset_url' => $this->editorAssetUrl($installation),
            'style_asset_urls' => $this->styleAssetUrls($installation),
            'installed_at' => $installation->installedAt->format(DATE_ATOM),
            'updated_at' => $installation->updatedAt->format(DATE_ATOM),
        ];
    }

    /** @return array<string, mixed> */
    private function builtInData(BlockPackManifest $manifest): array
    {
        return [
            'pack_id' => $manifest->packId,
            'pack_version' => $manifest->packVersion,
            'kind' => $manifest->kind,
            'publisher' => $manifest->publisher,
            'state' => 'enabled',
            'source' => 'builtin',
            'source_uri' => null,
            'archive_sha256' => null,
            'blocks' => count($manifest->blocks),
            'presets' => count($manifest->presets),
            'runtime_active' => true,
            'editor_asset_url' => null,
            'style_asset_urls' => [],
            'usage' => null,
            'installed_at' => null,
            'updated_at' => null,
        ];
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    private function editorAssetUrl(BlockPackInstallation $installation): ?string
    {
        $runtime = $installation->manifest->runtime;

        return $runtime === null ? null : $this->assetUrl($installation, $runtime['editor']);
    }

    /** @return list<string> */
    private function styleAssetUrls(BlockPackInstallation $installation): array
    {
        $runtime = $installation->manifest->runtime;
        if ($runtime === null) {
            return [];
        }

        return array_map(fn (string $path): string => $this->assetUrl($installation, $path), $runtime['styles']);
    }

    private function assetUrl(BlockPackInstallation $installation, string $path): string
    {
        [$publisher, $pack] = explode('/', $installation->manifest->packId, 2);
        $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));

        return url('/modules/jiwonpapa-page_builder/block-packs/'
            .rawurlencode($publisher).'/'.rawurlencode($pack).'/'.rawurlencode($installation->manifest->packVersion).'/'.$encodedPath);
    }

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function error(Request $request, int $status, string $code, string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, 'correlation_id' => $this->correlationId($request)],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(Request $request, \Throwable $exception): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::error('G7 Page Builder Block Pack request failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return response()->json([
            'success' => false,
            'message' => '블록 팩 요청을 처리하지 못했습니다.',
            'data' => ['code' => 'G7PB_BLOCK_PACK_INTERNAL_ERROR', 'correlation_id' => $correlationId],
        ], 500, [], JSON_UNESCAPED_UNICODE);
    }

    private function correlationId(Request $request): string
    {
        $provided = $request->header('X-Correlation-ID');
        if (is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,100}$/', $provided) === 1) {
            return $provided;
        }

        return bin2hex(random_bytes(16));
    }
}
