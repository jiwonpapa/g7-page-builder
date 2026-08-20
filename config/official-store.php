<?php

return [
    'publisher_id' => 'jiwonpapa',
    'catalog_url' => env(
        'G7PB_STORE_CATALOG_URL',
        'https://g7devops.com/modules/jiwonpapa-page_builder/store/catalog.json',
    ),
    'allowed_hosts' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('G7PB_STORE_ALLOWED_HOSTS', 'www.g7devops.com,g7devops.com')),
    ))),
    'ca_bundle' => env('G7PB_STORE_CA_BUNDLE'),
    'catalog_max_bytes' => 1_048_576,
    'artifact_max_bytes' => 52_428_800,
    'connect_timeout_seconds' => 5,
    'timeout_seconds' => 20,
];
