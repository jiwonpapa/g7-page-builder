<?php

return [
    // key_id => ['publisher_id' => 'vendor', 'public_key' => 'base64 Ed25519 public key']
    // 키는 publisher_id에 귀속되며 다른 namespace의 Code Pack 서명에 사용할 수 없습니다.
    'trusted_publishers' => [],
];
