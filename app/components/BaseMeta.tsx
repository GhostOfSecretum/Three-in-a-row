'use client';

import { useEffect } from 'react';
import { minikitConfig } from '@/minikit.config';

export default function BaseMeta() {
  useEffect(() => {
    // Добавляем meta тег для Base app embed
    const embedMetadata = {
      version: "next",
      imageUrl: minikitConfig.miniapp.ogImageUrl,
      button: {
        title: "Открыть игру",
        action: {
          type: "launch_frame",
          url: minikitConfig.miniapp.homeUrl,
          name: minikitConfig.miniapp.name,
          splashImageUrl: minikitConfig.miniapp.splashImageUrl,
          splashBackgroundColor: minikitConfig.miniapp.splashBackgroundColor,
        },
      },
    };

    // Удаляем старый meta тег если есть
    const existingMeta = document.querySelector('meta[name="fc:miniapp"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    // Создаем новый meta тег
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'fc:miniapp');
    meta.setAttribute('content', JSON.stringify(embedMetadata));
    document.head.appendChild(meta);

    // Добавляем base:app_id meta тег для верификации
    const appIdMeta = document.querySelector('meta[name="base:app_id"]');
    if (!appIdMeta) {
      const baseAppId = document.createElement('meta');
      baseAppId.setAttribute('name', 'base:app_id');
      baseAppId.setAttribute('content', '69669e6abc744612f97d61d4');
      document.head.appendChild(baseAppId);
    }
  }, []);

  return null;
}

