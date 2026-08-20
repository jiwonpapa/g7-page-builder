<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackReleaseSourcePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;

final readonly class GitHubReleaseSourceAdapter implements BlockPackReleaseSourcePort
{
    private const API = 'https://api.github.com';

    private const MAX_PAGES = 5;

    public function __construct(private ?string $token = null) {}

    public function releases(string $owner, string $repository, string $assetName): array
    {
        $this->assertRepository($owner, $repository);
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/i', $assetName) !== 1) {
            throw new \InvalidArgumentException('GitHub Block Pack asset name must be a ZIP file.');
        }

        $results = [];
        for ($page = 1; $page <= self::MAX_PAGES; $page++) {
            $payload = $this->json(sprintf(
                '%s/repos/%s/%s/releases?per_page=100&page=%d',
                self::API,
                rawurlencode($owner),
                rawurlencode($repository),
                $page,
            ));
            if (! array_is_list($payload)) {
                throw new \RuntimeException('GitHub Release API 응답 형식이 올바르지 않습니다.');
            }
            foreach ($payload as $release) {
                if (! is_array($release) || ($release['draft'] ?? true) !== false || ($release['prerelease'] ?? true) !== false) {
                    continue;
                }
                $tag = $release['tag_name'] ?? null;
                $publishedAt = $release['published_at'] ?? null;
                if (! is_string($tag) || ! is_string($publishedAt)) {
                    continue;
                }
                $version = str_starts_with($tag, 'v') ? substr($tag, 1) : $tag;
                if (preg_match('/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/', $version) !== 1) {
                    continue;
                }
                $assets = $release['assets'] ?? null;
                if (! is_array($assets)) {
                    continue;
                }
                foreach ($assets as $asset) {
                    if (! is_array($asset) || ($asset['name'] ?? null) !== $assetName) {
                        continue;
                    }
                    $digest = $asset['digest'] ?? null;
                    if (! is_string($digest) || ! str_starts_with($digest, 'sha256:')) {
                        continue;
                    }
                    $assetId = $asset['id'] ?? null;
                    $assetBytes = $asset['size'] ?? null;
                    if (! is_int($assetId) || ! is_int($assetBytes)) {
                        continue;
                    }
                    try {
                        $published = new \DateTimeImmutable($publishedAt);
                    } catch (\Exception) {
                        continue;
                    }
                    $results[] = new BlockPackRelease(
                        owner: $owner,
                        repository: $repository,
                        tag: $tag,
                        version: $version,
                        assetId: $assetId,
                        assetName: $assetName,
                        assetBytes: $assetBytes,
                        sha256: substr($digest, 7),
                        releaseUrl: 'https://github.com/'.rawurlencode($owner).'/'.rawurlencode($repository).'/releases/tag/'.rawurlencode($tag),
                        publishedAt: $published,
                    );
                }
            }
            if (count($payload) < 100) {
                break;
            }
        }

        return $results;
    }

    public function download(BlockPackRelease $release): string
    {
        $path = tempnam(sys_get_temp_dir(), 'g7pb-github-pack-');
        if ($path === false) {
            throw new \RuntimeException('GitHub 블록 팩 임시 파일을 만들지 못했습니다.');
        }
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            unlink($path);
            throw new \RuntimeException('GitHub 블록 팩 임시 파일을 열지 못했습니다.');
        }

        $curl = curl_init(self::API.'/repos/'.rawurlencode($release->owner).'/'.rawurlencode($release->repository).'/releases/assets/'.$release->assetId);
        if (! $curl instanceof \CurlHandle) {
            fclose($handle);
            unlink($path);
            throw new \RuntimeException('GitHub 다운로드 요청을 시작하지 못했습니다.');
        }
        $downloadedBytes = 0;
        curl_setopt_array($curl, [
            CURLOPT_HTTPHEADER => $this->headers('application/octet-stream'),
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_FAILONERROR => false,
            CURLOPT_WRITEFUNCTION => static function (\CurlHandle $_curl, string $chunk) use ($handle, &$downloadedBytes, $release): int {
                $downloadedBytes += strlen($chunk);
                if ($downloadedBytes > $release->assetBytes || $downloadedBytes > 52_428_800) {
                    return 0;
                }
                $written = fwrite($handle, $chunk);

                return is_int($written) ? $written : 0;
            },
        ]);

        try {
            $success = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            if ($success !== true || $status !== 200) {
                throw new \RuntimeException("GitHub Release asset 다운로드가 실패했습니다. HTTP {$status}");
            }
        } catch (\Throwable $exception) {
            if (is_file($path)) {
                unlink($path);
            }

            throw $exception;
        } finally {
            curl_close($curl);
            fclose($handle);
        }

        if ($downloadedBytes !== $release->assetBytes) {
            unlink($path);
            throw new \DomainException('GitHub Release asset 크기가 API 메타데이터와 일치하지 않습니다.');
        }
        $sha256 = hash_file('sha256', $path);
        if (! is_string($sha256) || ! hash_equals($release->sha256, $sha256)) {
            unlink($path);
            throw new \DomainException('GitHub Release asset SHA-256이 API digest와 일치하지 않습니다.');
        }

        return $path;
    }

    /** @return array<mixed> */
    private function json(string $url): array
    {
        $curl = curl_init($url);
        if (! $curl instanceof \CurlHandle) {
            throw new \RuntimeException('GitHub API 요청을 시작하지 못했습니다.');
        }
        curl_setopt_array($curl, [
            CURLOPT_HTTPHEADER => $this->headers('application/vnd.github+json'),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_FAILONERROR => false,
        ]);
        try {
            $response = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        } finally {
            curl_close($curl);
        }
        if (! is_string($response) || $status !== 200) {
            throw new \RuntimeException("GitHub Release API 조회가 실패했습니다. HTTP {$status}");
        }

        $payload = json_decode($response, true, 128, JSON_THROW_ON_ERROR);

        return is_array($payload) ? $payload : throw new \RuntimeException('GitHub API JSON 응답이 올바르지 않습니다.');
    }

    /** @return list<string> */
    private function headers(string $accept): array
    {
        $headers = [
            'Accept: '.$accept,
            'User-Agent: g7-page-builder',
            'X-GitHub-Api-Version: 2022-11-28',
        ];
        if (is_string($this->token) && $this->token !== '') {
            $headers[] = 'Authorization: Bearer '.$this->token;
        }

        return $headers;
    }

    private function assertRepository(string $owner, string $repository): void
    {
        foreach ([$owner, $repository] as $part) {
            if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $part) !== 1) {
                throw new \InvalidArgumentException('GitHub 저장소 소유자 또는 이름이 올바르지 않습니다.');
            }
        }
    }
}
