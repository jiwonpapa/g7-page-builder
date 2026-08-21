<?php

return [
    'recipient' => env('G7PB_FORM_RECIPIENT'),
    'ip_hash_key' => env('G7PB_FORM_IP_HASH_KEY', env('APP_KEY', 'g7-page-builder')),
    'minimum_fill_seconds' => (int) env('G7PB_FORM_MINIMUM_FILL_SECONDS', 2),
];
