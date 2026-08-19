<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\CanonicalApiAccessResponse;
use PHPUnit\Framework\TestCase;

final class CanonicalApiAccessResponseTest extends TestCase
{
    public function test_authentication_exception_becomes_the_canonical_401_envelope(): void
    {
        $request = Request::create('/api/modules/jiwonpapa-page_builder/admin/documents');
        $request->headers->set('X-Correlation-ID', 'g7pb-test-auth-01');
        $middleware = new CanonicalApiAccessResponse;

        $response = $middleware->handle(
            $request,
            static fn () => throw new AuthenticationException('Bearer token leaked message'),
        );
        /** @var array<string, mixed> $payload */
        $payload = $response->getData(true);

        self::assertSame(401, $response->getStatusCode());
        self::assertFalse($payload['success']);
        self::assertSame('G7PB_AUTH_REQUIRED', $payload['data']['code']);
        self::assertSame('g7pb-test-auth-01', $payload['data']['correlation_id']);
        self::assertSame('g7pb-test-auth-01', $response->headers->get('X-Correlation-ID'));
        self::assertStringNotContainsString('leaked', $response->getContent());
    }

    public function test_downstream_permission_response_becomes_the_canonical_403_envelope(): void
    {
        $request = Request::create('/api/modules/jiwonpapa-page_builder/admin/documents');
        $middleware = new CanonicalApiAccessResponse;

        $response = $middleware->handle(
            $request,
            static fn (): JsonResponse => new JsonResponse([
                'message' => 'internal permission detail',
                'required_permissions' => ['secret.permission'],
            ], 403),
        );
        /** @var array<string, mixed> $payload */
        $payload = $response->getData(true);

        self::assertSame(403, $response->getStatusCode());
        self::assertFalse($payload['success']);
        self::assertSame('G7PB_PERMISSION_DENIED', $payload['data']['code']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{24}$/', $payload['data']['correlation_id']);
        self::assertStringNotContainsString('secret.permission', $response->getContent());
    }
}
