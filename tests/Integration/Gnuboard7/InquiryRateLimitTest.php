<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\RateLimiter;
use Illuminate\Cache\Repository;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Route;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response;

/** Isolated counters: never flush or alter the installed runtime's cache. */
final class InquiryRateLimitTest extends TestCase
{
    public function test_inquiry_counter_is_independent_and_still_rejects_the_eleventh_request(): void
    {
        $provider = file_get_contents(dirname(__DIR__, 3).'/src/Providers/PageBuilderServiceProvider.php');
        self::assertIsString($provider);
        self::assertStringContainsString("Route::middleware(['web', 'throttle:10,1,g7pb_inquiry'])", $provider);

        $middleware = new ThrottleRequests(new RateLimiter(new Repository(new ArrayStore)));
        $request = Request::create('https://g7pb.test/pages/rate-fixture/inquiries', 'POST');
        $request->setUserResolver(static fn () => null);
        $request->setRouteResolver(static fn () => new Route(['POST'], 'pages/{slug}/inquiries', static fn () => new Response));
        $next = static fn () => new Response('', 204);

        // The same anonymous IP may already have loaded many ordinary APIs.
        for ($index = 0; $index < 25; $index++) {
            self::assertSame(204, $middleware->handle($request, $next, 600, 1)->getStatusCode());
        }
        for ($index = 0; $index < 10; $index++) {
            $response = $middleware->handle($request, $next, 10, 1, 'g7pb_inquiry');
            self::assertSame(204, $response->getStatusCode());
            self::assertSame('10', $response->headers->get('X-RateLimit-Limit'));
            self::assertSame((string) (9 - $index), $response->headers->get('X-RateLimit-Remaining'));
        }
        // Inquiry traffic does not consume the unrelated API counter either.
        self::assertSame('574', $middleware->handle($request, $next, 600, 1)->headers->get('X-RateLimit-Remaining'));
        $this->expectException(ThrottleRequestsException::class);
        $middleware->handle($request, $next, 10, 1, 'g7pb_inquiry');
    }
}
