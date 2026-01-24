// Конфигурация для Base Mini App
// Обновите ROOT_URL после деплоя на Vercel
const ROOT_URL = 'https://three-in-a-row-nine.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    "header": "eyJmaWQiOjExMDg2NzUsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg4OGJlRDE3NzI1ZkViMDA1Yzk5OTFmNzc1QkYxMWE5MEM2RUNmMWU4In0",
    "payload": "eyJkb21haW4iOiJ0aHJlZS1pbi1hLXJvdy1uaW5lLnZlcmNlbC5hcHAifQ",
    "signature": "PU4BCk1/OZRMJ/1tvrNCdDcMEkOPdRKSQt1FKN8R8rwF9IMI9Hj1Ujj5MI2BWtrT09Q5ohQC5ZRsF6d+VDcQvhw="
  },
  miniapp: {
    version: "1",
    name: "Doom 1993 Mini",
    subtitle: "Классический шутер в MiniApp",
    description: "Прототип Doom 1993-style для Base app: быстрый старт, Canvas-рендер и управление для мобайла и десктопа.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.svg`],
    iconUrl: `${ROOT_URL}/icon.svg`,
    splashImageUrl: `${ROOT_URL}/splash.svg`,
    splashBackgroundColor: "#0b0b0b",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["games", "fps", "doom", "retro", "web", "base"],
    heroImageUrl: `${ROOT_URL}/hero.svg`,
    tagline: "Doom внутри Base MiniApp",
    ogTitle: "Doom 1993 MiniApp для Base",
    ogDescription: "Классический FPS в формате MiniApp: Canvas, WASM и быстрый cold start.",
    ogImageUrl: `${ROOT_URL}/og-image.svg`,
  },
} as const;

