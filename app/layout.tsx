import type { Metadata } from 'next';
import { minikitConfig } from '@/minikit.config';
import BaseMeta from './components/BaseMeta';
import './globals.css';

export const metadata: Metadata = {
  title: minikitConfig.miniapp.name,
  description: minikitConfig.miniapp.description,
  openGraph: {
    title: minikitConfig.miniapp.ogTitle || minikitConfig.miniapp.name,
    description: minikitConfig.miniapp.ogDescription || minikitConfig.miniapp.description,
    images: [minikitConfig.miniapp.ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <meta name="base:app_id" content="69669e6abc744612f97d61d4" />
      </head>
      <body>
        <BaseMeta />
        {children}
      </body>
    </html>
  );
}

