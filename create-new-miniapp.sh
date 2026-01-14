#!/bin/bash

# Скрипт для создания нового Base Mini App на основе этого шаблона

if [ -z "$1" ]; then
  echo "❌ Ошибка: Укажите название проекта"
  echo "Использование: ./create-new-miniapp.sh название-проекта"
  exit 1
fi

PROJECT_NAME=$1
TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"
NEW_PROJECT_DIR="../$PROJECT_NAME"

echo "🚀 Создание нового Base Mini App: $PROJECT_NAME"
echo ""

# Проверка что директория не существует
if [ -d "$NEW_PROJECT_DIR" ]; then
  echo "❌ Ошибка: Директория $NEW_PROJECT_DIR уже существует"
  exit 1
fi

# Копирование проекта
echo "📁 Копирование файлов..."
cp -r "$TEMPLATE_DIR" "$NEW_PROJECT_DIR"

# Удаление ненужных файлов
cd "$NEW_PROJECT_DIR"
rm -rf .git
rm -rf node_modules
rm -rf .next
rm -f package-lock.json

# Обновление package.json
echo "📝 Обновление package.json..."
sed -i '' "s/\"name\": \"base-mini-app\"/\"name\": \"$PROJECT_NAME\"/g" package.json
sed -i '' "s/\"description\": \"Base Mini App для Base app\"/\"description\": \"Base Mini App: $PROJECT_NAME\"/g" package.json

# Обновление minikit.config.ts
echo "📝 Обновление minikit.config.ts..."
sed -i '' "s/const ROOT_URL = 'https:\/\/three-in-a-row-nine.vercel.app';/const ROOT_URL = process.env.NEXT_PUBLIC_ROOT_URL || 'http:\/\/localhost:3000';/g" minikit.config.ts
sed -i '' "s/name: \"Три в ряд\"/name: \"$PROJECT_NAME\"/g" minikit.config.ts
sed -i '' "s/accountAssociation: {/accountAssociation: {\n    \"header\": \"\",\n    \"payload\": \"\",\n    \"signature\": \"\"/g" minikit.config.ts

# Инициализация git
echo "🔧 Инициализация git..."
git init
git add .
git commit -m "Initial commit: Base Mini App template"

echo ""
echo "✅ Проект $PROJECT_NAME создан!"
echo ""
echo "📋 Следующие шаги:"
echo "  1. cd $NEW_PROJECT_DIR"
echo "  2. npm install"
echo "  3. Обновите minikit.config.ts под ваше приложение"
echo "  4. Создайте ваше приложение в app/page.tsx"
echo "  5. npm run dev - для локальной проверки"
echo "  6. Следуйте инструкциям в DEPLOY_NOW.md для деплоя"
echo ""

