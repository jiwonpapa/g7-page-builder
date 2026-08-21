<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\FormSubmissionRecord;

final class FormSubmissionController
{
    private const KINDS = ['inquiry', 'quote', 'reservation', 'application', 'newsletter'];

    public function __construct(private readonly PageBuilderService $pages) {}

    public function store(Request $request, string $slug): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'block_instance_id' => ['required', 'uuid'],
            'form_kind' => ['required', 'in:'.implode(',', self::KINDS)],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:320'],
            'phone' => ['nullable', 'string', 'max:40'],
            'subject' => ['nullable', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:5000'],
            'privacy' => ['accepted'],
            'website' => ['nullable', 'max:0'],
            'started_at' => ['required', 'integer'],
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => '입력 내용을 확인해 주세요.', 'data' => ['errors' => $validator->errors()]], 422);
        }
        if (time() - (int) $request->input('started_at') < max(1, (int) config('g7-page-builder.forms.minimum_fill_seconds', 2))) {
            return response()->json(['success' => false, 'message' => '잠시 후 다시 제출해 주세요.', 'data' => []], 422);
        }

        $page = $this->pages->findPublished($slug);
        $blockId = (string) $request->input('block_instance_id');
        $encodedBlockId = preg_quote(htmlspecialchars($blockId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), '/');
        if ($page === null
            || preg_match('/<section\s+data-block-id="'.$encodedBlockId.'"[^>]*data-block-type="inquiry-form"/', $page->artifact) !== 1) {
            abort(404);
        }

        $now = now();
        $record = FormSubmissionRecord::query()->create([
            'id' => $this->uuidV4(),
            'page_slug' => $slug,
            'block_instance_id' => $blockId,
            'form_kind' => (string) $request->input('form_kind'),
            'payload_json' => [
                'name' => trim((string) $request->input('name')),
                'email' => trim((string) $request->input('email')),
                'phone' => trim((string) $request->input('phone', '')),
                'subject' => trim((string) $request->input('subject', '')),
                'message' => trim((string) $request->input('message')),
            ],
            'email' => trim((string) $request->input('email')),
            'subject' => trim((string) $request->input('subject', '')),
            'status' => 'unread',
            'mail_status' => 'pending',
            'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('g7-page-builder.forms.ip_hash_key')),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->deliver($record);

        return response()->json(['success' => true, 'message' => '문의가 접수되었습니다.', 'data' => ['submission_id' => $record->id]], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $requestedStatus = $request->query('status', 'all');
        $status = is_string($requestedStatus) ? $requestedStatus : 'all';
        $query = FormSubmissionRecord::query()->orderByDesc('created_at');
        if (in_array($status, ['unread', 'read', 'archived'], true)) {
            $query->where('status', $status);
        }
        /** @var Collection<int, FormSubmissionRecord> $records */
        $records = $query->limit(100)->get();
        $items = $records->map(fn (FormSubmissionRecord $record): array => $this->resource($record))->all();

        return response()->json(['success' => true, 'message' => '문의함을 조회했습니다.', 'data' => ['items' => $items]]);
    }

    public function update(Request $request, string $submission): JsonResponse
    {
        $status = (string) $request->input('status');
        if (! in_array($status, ['unread', 'read', 'archived'], true)) {
            return response()->json(['success' => false, 'message' => '문의 상태가 올바르지 않습니다.', 'data' => []], 422);
        }
        $record = FormSubmissionRecord::query()->findOrFail($submission);
        $record->forceFill(['status' => $status, 'updated_at' => now()])->save();

        return response()->json(['success' => true, 'message' => '문의 상태를 변경했습니다.', 'data' => $this->resource($record)]);
    }

    public function retry(string $submission): JsonResponse
    {
        $record = FormSubmissionRecord::query()->findOrFail($submission);
        $this->deliver($record);

        return response()->json(['success' => true, 'message' => $record->mail_status === 'sent' ? '메일을 발송했습니다.' : '문의는 보존했지만 메일 발송에 실패했습니다.', 'data' => $this->resource($record)]);
    }

    private function deliver(FormSubmissionRecord $record): void
    {
        $recipient = config('g7-page-builder.forms.recipient');
        $record->mail_attempts = ((int) $record->mail_attempts) + 1;
        if (! is_string($recipient) || filter_var($recipient, FILTER_VALIDATE_EMAIL) === false) {
            $record->mail_status = 'failed';
            $record->mail_error = 'G7PB_FORM_RECIPIENT is not configured.';
            $record->updated_at = now();
            $record->save();

            return;
        }
        try {
            $payload = $record->payload_json;
            $body = "페이지: {$record->page_slug}\n유형: {$record->form_kind}\n이름: ".($payload['name'] ?? '')."\n이메일: {$record->email}\n전화: ".($payload['phone'] ?? '')."\n제목: {$record->subject}\n\n".($payload['message'] ?? '');
            Mail::raw($body, function ($message) use ($recipient, $record): void {
                $message->to($recipient)->subject('[Page Builder 문의] '.($record->subject !== '' ? $record->subject : $record->page_slug));
            });
            $record->mail_status = 'sent';
            $record->mail_error = null;
            $record->mail_sent_at = now();
        } catch (\Throwable $exception) {
            $record->mail_status = 'failed';
            $record->mail_error = mb_substr($exception->getMessage(), 0, 2000);
        }
        $record->updated_at = now();
        $record->save();
    }

    /** @return array<string, mixed> */
    private function resource(FormSubmissionRecord $record): array
    {
        return [
            'id' => $record->id, 'page_slug' => $record->page_slug, 'block_instance_id' => $record->block_instance_id,
            'form_kind' => $record->form_kind, 'payload' => $record->payload_json, 'email' => $record->email,
            'subject' => $record->subject, 'status' => $record->status, 'mail_status' => $record->mail_status,
            'mail_error' => $record->mail_error, 'mail_attempts' => $record->mail_attempts,
            'created_at' => $record->created_at?->format(DATE_ATOM), 'updated_at' => $record->updated_at?->format(DATE_ATOM),
        ];
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
    }
}
