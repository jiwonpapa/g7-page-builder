<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

final class CanonicalApiAccessResponse
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $response = $next($request);
        } catch (AuthenticationException) {
            return $this->accessError($request, 401);
        } catch (AuthorizationException) {
            return $this->accessError($request, 403);
        } catch (HttpExceptionInterface $exception) {
            if (in_array($exception->getStatusCode(), [401, 403], true)) {
                return $this->accessError($request, $exception->getStatusCode());
            }

            throw $exception;
        }

        if (in_array($response->getStatusCode(), [401, 403], true)) {
            return $this->accessError($request, $response->getStatusCode());
        }

        return $response;
    }

    private function accessError(Request $request, int $status): JsonResponse
    {
        $unauthenticated = $status === 401;
        $correlationId = $this->correlationId($request);

        return new JsonResponse([
            'success' => false,
            'message' => $unauthenticated
                ? '관리자 인증이 필요합니다.'
                : '페이지 빌더 권한이 없습니다.',
            'data' => [
                'code' => $unauthenticated
                    ? 'G7PB_AUTH_REQUIRED'
                    : 'G7PB_PERMISSION_DENIED',
                'correlation_id' => $correlationId,
            ],
        ], $status, [
            'X-Correlation-ID' => $correlationId,
        ], JSON_UNESCAPED_UNICODE);
    }

    private function correlationId(Request $request): string
    {
        $provided = $request->header('X-Correlation-ID');

        if (is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,100}$/', $provided) === 1) {
            return $provided;
        }

        return bin2hex(random_bytes(12));
    }
}
