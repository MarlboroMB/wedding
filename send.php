<?php
/**
 * send.php — принимает данные анкеты и отправляет на email
 * 
 * Использование:
 *   POST /send.php
 *   Content-Type: application/json
 *   Body: { "name": "...", "attendance": "yes|no", "drinks": [...], "otherDrinkText": "..." }
 * 
 * Ответ приходит мгновенно, письмо уходит в фоне.
 */

require_once __DIR__ . '/config.php';

// Устанавливаем заголовки
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight-запроса (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Проверяем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Метод не поддерживается. Используйте POST.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Читаем тело запроса
$rawInput = file_get_contents('php://input');
if (!$rawInput) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Пустой запрос.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Парсим JSON
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Ошибка формата JSON: ' . json_last_error_msg(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Валидация
$errors = [];

$name = isset($data['name']) ? trim($data['name']) : '';
if (empty($name)) {
    $errors[] = 'Не указано имя гостя.';
}

$attendance = isset($data['attendance']) ? trim($data['attendance']) : '';
if (empty($attendance)) {
    $errors[] = 'Не указано присутствие.';
} elseif (!in_array($attendance, ['yes', 'no'], true)) {
    $errors[] = 'Некорректное значение присутствия.';
}

$drinks = isset($data['drinks']) && is_array($data['drinks']) ? $data['drinks'] : [];
$drinkOtherText = isset($data['otherDrinkText']) ? trim($data['otherDrinkText']) : '';
$allergy = isset($data['allergy']) ? trim($data['allergy']) : '';

if (in_array('other', $drinks, true) && empty($drinkOtherText)) {
    $errors[] = 'Укажите ваш вариант напитка.';
}

// Если есть ошибки — возвращаем (без фоновой отправки)
if (!empty($errors)) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => implode(' ', $errors),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ✅ Данные валидны — отвечаем мгновенно, письмо уйдёт в фоне
// Включаем буферизацию, чтобы захватить ответ
ob_start();

$response = json_encode([
    'success' => true,
    'message' => 'Анкета принята. Спасибо!',
], JSON_UNESCAPED_UNICODE);

echo $response;

// Получаем размер ответа
$size = ob_get_length();

if (function_exists('fastcgi_finish_request')) {
    // PHP-FPM (nginx + php-fpm)
    fastcgi_finish_request();
} else {
    // Apache mod_php: закрываем соединение, продолжаем выполнение
    ignore_user_abort(true);
    header('Content-Length: ' . $size);
    header('Connection: close');
    header('Content-Encoding: none');
    ob_flush();
    flush();
}

// ====== Дальше — фоновая отправка письма ======

// Форматируем присутствие
$attendanceText = $attendance === 'yes'
    ? 'Обязательно буду'
    : 'К сожалению, не смогу присутствовать';

// Маппинг напитков
$drinksMap = [
    'red_wine'   => 'Вино красное',
    'white_wine' => 'Вино белое',
    'champagne'  => 'Шампанское',
    'whiskey'    => 'Виски',
    'cognac'     => 'Коньяк',
    'vodka'      => 'Водка',
    'other'      => 'Другое',
];

$drinksList = [];
foreach ($drinks as $drink) {
    if (isset($drinksMap[$drink])) {
        if ($drink !== 'other') {
            $drinksList[] = $drinksMap[$drink];
        } elseif (!empty($drinkOtherText)) {
            $drinksList[] = 'Другое (' . htmlspecialchars($drinkOtherText, ENT_QUOTES, 'UTF-8') . ')';
        }
    }
}
$drinksText = !empty($drinksList) ? implode(', ', $drinksList) : 'Не выбрано';

$timestamp = date('d.m.Y в H:i');

// Формируем HTML-письмо
$emailBody = <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f0e8; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        h1 { font-family: 'Georgia', serif; color: #5e534a; font-size: 22px; margin: 0 0 20px; text-align: center; }
        .field { margin-bottom: 16px; }
        .field__label { font-size: 12px; color: #9e8a78; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .field__value { font-size: 16px; color: #362a22; padding: 10px 14px; background: #f9f6f1; border-radius: 8px; }
        .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e8e0d6; font-size: 12px; color: #9e8a78; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>💌 Новая анкета гостя</h1>

        <div class="field">
            <div class="field__label">Имя и фамилия</div>
            <div class="field__value">{$name}</div>
        </div>

        <div class="field">
            <div class="field__label">Присутствие</div>
            <div class="field__value">{$attendanceText}</div>
        </div>

        <div class="field">
            <div class="field__label">Предпочтения по напиткам</div>
            <div class="field__value">{$drinksText}</div>
        </div>

        <div class="field">
            <div class="field__label">Аллергия / непереносимость</div>
            <div class="field__value">' . (!empty($allergy) ? htmlspecialchars($allergy, ENT_QUOTES, 'UTF-8') : 'Не указано') . '</div>
        </div>

        <div class="footer">
            Отправлено {$timestamp}
        </div>
    </div>
</body>
</html>
HTML;

// Заголовки письма
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    'From: ' . FROM_NAME . ' <' . FROM_EMAIL . '>',
    'Reply-To: ' . FROM_EMAIL,
    'X-Mailer: PHP/' . phpversion(),
];

// Отправляем письмо (уже в фоне, пользователь не ждёт)
mail(TO_EMAIL, '=?UTF-8?B?' . base64_encode(EMAIL_SUBJECT) . '?=', $emailBody, implode("\r\n", $headers));
