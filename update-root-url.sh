#!/bin/bash

# Скрипт для автоматического обновления ROOT_URL

echo "🔧 Обновление ROOT_URL в minikit.config.ts"
echo ""

# Проверка что мы в правильной директории
if [ ! -f "minikit.config.ts" ]; then
    echo "❌ Ошибка: minikit.config.ts не найден. Убедитесь что вы в корне проекта."
    exit 1
fi

# Запрос URL
echo "📝 Введите URL вашего приложения на Vercel"
echo "   Например: https://base-match3-game.vercel.app"
echo ""
read -p "URL: " APP_URL

if [ -z "$APP_URL" ]; then
    echo "❌ URL не может быть пустым"
    exit 1
fi

# Удаляем слеш в конце если есть
APP_URL="${APP_URL%/}"

# Проверка что URL начинается с http:// или https://
if [[ ! "$APP_URL" =~ ^https?:// ]]; then
    echo "⚠️  URL должен начинаться с http:// или https://"
    echo "   Добавляю https:// автоматически..."
    APP_URL="https://$APP_URL"
fi

echo ""
echo "🔄 Обновляю ROOT_URL на: $APP_URL"

# Создаем резервную копию
cp minikit.config.ts minikit.config.ts.backup

# Обновляем файл
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|const ROOT_URL = process.env.NEXT_PUBLIC_ROOT_URL || '.*';|const ROOT_URL = '$APP_URL';|g" minikit.config.ts
    sed -i '' "s|const ROOT_URL = '.*';|const ROOT_URL = '$APP_URL';|g" minikit.config.ts
else
    # Linux
    sed -i "s|const ROOT_URL = process.env.NEXT_PUBLIC_ROOT_URL || '.*';|const ROOT_URL = '$APP_URL';|g" minikit.config.ts
    sed -i "s|const ROOT_URL = '.*';|const ROOT_URL = '$APP_URL';|g" minikit.config.ts
fi

# Проверяем что обновление прошло
if grep -q "const ROOT_URL = '$APP_URL';" minikit.config.ts; then
    echo "✅ ROOT_URL успешно обновлен!"
    echo ""
    echo "📋 Следующие шаги:"
    echo "   1. Проверьте файл minikit.config.ts"
    echo "   2. Запушьте изменения:"
    echo "      git add minikit.config.ts"
    echo "      git commit -m 'Update ROOT_URL to $APP_URL'"
    echo "      git push"
    echo ""
    echo "💾 Резервная копия сохранена в: minikit.config.ts.backup"
else
    echo "❌ Ошибка при обновлении. Восстанавливаю из резервной копии..."
    mv minikit.config.ts.backup minikit.config.ts
    exit 1
fi

