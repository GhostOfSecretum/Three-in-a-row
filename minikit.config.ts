// Конфигурация для Base Mini App
// Обновите ROOT_URL после деплоя на Vercel
const ROOT_URL = 'https://three-in-a-row-nine.vercel.app';

export const minikitConfig = {
  // accountAssociation будет добавлен на шаге 5 после верификации
  accountAssociation: {
    "header": "",
    "payload": "",
    "signature": ""
  },
  miniapp: {
    version: "1",
    name: "Три в ряд", 
    subtitle: "Классическая игра-головоломка", 
    description: "Увлекательная игра три в ряд для Base app! Собирайте камни в ряды, набирайте очки и соревнуйтесь с друзьями. Каскадные совпадения, красивая графика и плавная анимация ждут вас!",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.svg`],
    iconUrl: `${ROOT_URL}/icon.svg`,
    splashImageUrl: `${ROOT_URL}/splash.svg`,
    splashBackgroundColor: "#4c1d95",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["games", "puzzle", "match3", "web3", "base", "entertainment"],
    heroImageUrl: `${ROOT_URL}/hero.svg`, 
    tagline: "Собери три в ряд и победи!",
    ogTitle: "Три в ряд - Игра для Base app",
    ogDescription: "Классическая игра три в ряд с современной графикой и плавной анимацией. Играйте прямо в Base app!",
    ogImageUrl: `${ROOT_URL}/og-image.svg`,
  },
} as const;

