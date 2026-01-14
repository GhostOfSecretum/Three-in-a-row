#!/bin/bash

# Простой скрипт для создания GitHub репозитория

echo "🐙 Создание GitHub репозитория для Base Mini App"
echo ""

# Проверка авторизации
if ! gh auth status &> /dev/null; then
    echo "🔐 Требуется авторизация в GitHub"
    echo ""
    echo "Выполните эту команду:"
    echo "   gh auth login"
    echo ""
    echo "Или используйте ручной способ (см. GITHUB_SETUP.md)"
    exit 1
fi

# Запрос названия
read -p "📝 Введите название репозитория (например: base-match3-game): " REPO_NAME

if [ -z "$REPO_NAME" ]; then
    echo "❌ Название не может быть пустым"
    exit 1
fi

# Запрос видимости
echo ""
read -p "🌐 Публичный репозиторий? (y/n, по умолчанию y): " IS_PUBLIC

if [ "$IS_PUBLIC" = "n" ] || [ "$IS_PUBLIC" = "N" ]; then
    VISIBILITY="--private"
    echo "🔒 Создаю приватный репозиторий..."
else
    VISIBILITY="--public"
    echo "🌍 Создаю публичный репозиторий..."
fi

# Создание репозитория
echo ""
echo "🔄 Создаю репозиторий $REPO_NAME..."

gh repo create "$REPO_NAME" $VISIBILITY --source=. --remote=origin --push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Успешно! Репозиторий создан и код запушен!"
    echo ""
    GITHUB_USER=$(gh api user --jq .login)
    echo "🔗 URL: https://github.com/$GITHUB_USER/$REPO_NAME"
    echo ""
    echo "📋 Следующий шаг:"
    echo "   1. Перейдите на vercel.com"
    echo "   2. Импортируйте репозиторий $REPO_NAME"
    echo "   3. Нажмите Deploy"
    echo ""
    echo "   Подробнее в файле DEPLOY_NOW.md"
else
    echo ""
    echo "❌ Ошибка при создании репозитория"
    echo ""
    echo "Попробуйте создать вручную:"
    echo "   1. Перейдите на github.com/new"
    echo "   2. Создайте репозиторий $REPO_NAME"
    echo "   3. Затем выполните:"
    echo "      git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
    echo "      git push -u origin main"
fi

