<?php

return [
    // 두 Site Part의 마지막 정상 발행본이 모두 있을 때만 활성 User Template 전체에 적용됩니다.
    // API/컴파일/호환성 실패 시 원본 G7 Header·Footer가 자동으로 유지됩니다.
    'enabled' => env('G7PB_SITE_SHELL_ENABLED', true),
];
