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
  }, []);

  return null;
}

