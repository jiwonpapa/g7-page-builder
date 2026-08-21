<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $page_slug
 * @property string $block_instance_id
 * @property string $form_kind
 * @property array<string, mixed> $payload_json
 * @property string $email
 * @property string $subject
 * @property string $status
 * @property string $mail_status
 * @property string|null $mail_error
 * @property int $mail_attempts
 * @property string $ip_hash
 * @property string $user_agent
 * @property \DateTimeInterface|null $mail_sent_at
 * @property \DateTimeInterface|null $created_at
 * @property \DateTimeInterface|null $updated_at
 */
final class FormSubmissionRecord extends Model
{
    protected $table = 'g7pb_form_submissions';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id', 'page_slug', 'block_instance_id', 'form_kind', 'payload_json', 'email', 'subject',
        'status', 'mail_status', 'mail_error', 'mail_attempts', 'ip_hash', 'user_agent',
        'mail_sent_at', 'created_at', 'updated_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'mail_attempts' => 'integer',
            'mail_sent_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
