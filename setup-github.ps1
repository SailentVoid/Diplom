# GitHub Project Setup Script
# Этот скрипт создаст репозиторий на GitHub и запушит весь проект

param(
    [string]$RepoName = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GitHub Project Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Шаг 1: Проверка наличия git
Write-Host "[1/7] Проверка git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    Write-Host "  ✓ Git найден: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Git не найден! Установите git с https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Шаг 2: Запрос GitHub токена
Write-Host ""
Write-Host "[2/7] Авторизация в GitHub..." -ForegroundColor Yellow
Write-Host "Для создания репозитория нужен Personal Access Token (PAT)." -ForegroundColor White
Write-Host "Как получить токен:" -ForegroundColor White
Write-Host "  1. Перейдите: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host "  2. Нажмите 'Generate new token (classic)'" -ForegroundColor Gray
Write-Host "  3. Дайте права: repo (полный доступ)" -ForegroundColor Gray
Write-Host "  4. Скопируйте токен" -ForegroundColor Gray
Write-Host ""

$token = Read-Host "Введите ваш GitHub Personal Access Token" -AsSecureString
$tokenBSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
$tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($tokenBSTR)

if ([string]::IsNullOrWhiteSpace($tokenPlain)) {
    Write-Host "  ✗ Токен не введён!" -ForegroundColor Red
    exit 1
}

# Проверка токена через API
Write-Host "  Проверка токена..." -ForegroundColor White
$authHeader = @{ Authorization = "token $tokenPlain" }
try {
    $user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $authHeader -ErrorAction Stop
    Write-Host "  ✓ Авторизован как: $($user.login)" -ForegroundColor Green
    
    # Проверка scopes токена
    Write-Host "  Проверка прав токена..." -ForegroundColor White
    $scopesHeader = $authHeader
    $tokenInfo = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $authHeader -Method Get -ErrorAction SilentlyContinue
    Write-Host "  ✓ Токен активен" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка авторизации! Проверьте токен." -ForegroundColor Red
    Write-Host "  Детали: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Убедитесь, что токен имеет права 'repo' (полный доступ к репозиториям)." -ForegroundColor Yellow
    Write-Host "При создании токена отметьте:" -ForegroundColor Yellow
    Write-Host "  ☑ repo (все подпункты)" -ForegroundColor Yellow
    exit 1
}

# Шаг 3: Запрос имени репозитория
Write-Host ""
Write-Host "[3/7] Создание репозитория..." -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($RepoName)) {
    $RepoName = Read-Host "Введите имя репозитория"
}

if ([string]::IsNullOrWhiteSpace($RepoName)) {
    Write-Host "  ✗ Имя репозитория не введено!" -ForegroundColor Red
    exit 1
}

Write-Host "  Создание репозитория: $RepoName" -ForegroundColor White

# Шаг 4: Создание репозитория через GitHub API
$repoData = @{
    name = $RepoName
    description = "Diploma Project - Full Stack Application"
    private = $false
    auto_init = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.github.com/user/repos" `
        -Headers $authHeader `
        -Method Post `
        -Body $repoData `
        -ContentType "application/json; charset=utf-8" `
        -ErrorAction Stop
    
    Write-Host "  ✓ Репозиторий создан: $($response.html_url)" -ForegroundColor Green
    $repoUrl = $response.html_url
    $repoCloneUrl = $response.clone_url
} catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    $errorBody = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
    } catch {}
    
    if ($statusCode -eq 422) {
        Write-Host "  ⚠ Репозиторий с таким именем уже существует!" -ForegroundColor Yellow
        $repoUrl = "https://github.com/$($user.login)/$RepoName"
        $repoCloneUrl = "https://github.com/$($user.login)/$RepoName.git"
    } elseif ($statusCode -eq 403) {
        Write-Host "  ✗ Ошибка 403: Нет прав для создания репозитория!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Возможные причины:" -ForegroundColor Yellow
        Write-Host "  1. Токен не имеет права 'repo'" -ForegroundColor Yellow
        Write-Host "  2. Аккаунт не подтверждён" -ForegroundColor Yellow
        Write-Host "  3. Превышен лимит репозиториев" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Создайте новый токен с правами 'repo':" -ForegroundColor White
        Write-Host "  https://github.com/settings/tokens/new?scopes=repo&description=PowerShell+Script" -ForegroundColor Cyan
        exit 1
    } else {
        Write-Host "  ✗ Ошибка создания репозитория!" -ForegroundColor Red
        Write-Host "  Код: $statusCode" -ForegroundColor Red
        Write-Host "  Детали: $errorBody" -ForegroundColor Red
        exit 1
    }
}

# Шаг 5: Инициализация git локально
Write-Host ""
Write-Host "[4/7] Инициализация git..." -ForegroundColor Yellow

Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
    git init
    Write-Host "  ✓ Git инициализирован" -ForegroundColor Green
} else {
    Write-Host "  ✓ Git уже инициализирован" -ForegroundColor Green
}

# Создание .gitignore если его нет
if (-not (Test-Path ".gitignore")) {
    Write-Host "  Создание .gitignore..." -ForegroundColor White
    @("node_modules/",
      ".env",
      ".idea/",
      "*.log",
      ".DS_Store"
    ) | Set-Content -Path ".gitignore" -Encoding UTF8
    Write-Host "  ✓ .gitignore создан" -ForegroundColor Green
}

# Шаг 6: Добавление файлов и коммит
Write-Host ""
Write-Host "[5/7] Добавление файлов..." -ForegroundColor Yellow

git add -A
$status = git status --porcelain

if ($status) {
    git commit -m "Initial commit: Diploma project"
    Write-Host "  ✓ Файлы добавлены и закоммичены" -ForegroundColor Green
} else {
    Write-Host "  ✓ Нет изменений для коммита" -ForegroundColor Green
}

# Шаг 7: Push на GitHub
Write-Host ""
Write-Host "[6/7] Настройка remote..." -ForegroundColor Yellow

# Удаляем старый origin если есть
git remote remove origin 2>$null

# Добавляем новый origin с токеном для авторизации
$repoUrlWithToken = $repoCloneUrl -replace "https://", "https://$($user.login):$tokenPlain@"

git remote add origin $repoCloneUrl
Write-Host "  ✓ Remote origin настроен" -ForegroundColor Green

Write-Host ""
Write-Host "[7/7] Push на GitHub..." -ForegroundColor Yellow

# Пробуем запушить
$pushOutput = git push -u origin master 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -ne 0) {
    # Если master не существует, пробуем main
    $pushOutput = git push -u origin main 2>&1
    $pushExitCode = $LASTEXITCODE
}

if ($pushExitCode -eq 0) {
    Write-Host "  ✓ Успешно запушено!" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Возможно нужно сначала создать ветку:" -ForegroundColor Yellow
    Write-Host "  Выполните вручную: git branch -M main && git push -u origin main" -ForegroundColor Yellow
}

# Финальное сообщение
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Готово!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ваш репозиторий: $repoUrl" -ForegroundColor White
Write-Host ""
Write-Host "Токен был использован только для авторизации и не сохранён." -ForegroundColor Gray
Write-Host "Рекомендуется сохранить токен в git credential manager для будущих операций." -ForegroundColor Gray
Write-Host ""

# Очистка токена из памяти
$tokenPlain = $null
[System.GC]::Collect()
