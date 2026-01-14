// Конфигурация для Base Mini App
// Обновите ROOT_URL после деплоя на Vercel
const ROOT_URL = 'https://three-in-a-row-nine.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    "header": "eyJmaWQiOi0xLCJ0eXBlIjoiYXV0aCIsImtleSI6IjB4M0IxRjE3RTZBYWM4MkI1MzU0ODgxMjE5ODBlOERFRDY4MkI4YUM5NiJ9",
    "payload": "eyJkb21haW4iOiJ0aHJlZS1pbi1hLXJvdy1uaW5lLnZlcmNlbC5hcHAifQ",
    "signature": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQXXuL6R_lP5lhdt5PtfvxIYB4sXh5OWi_kAqOvtYssVdkmD6BJolRMzLb50PTzmlKvOHygLVcVCh664VCVZlKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl8ZgIay2xclZzG8RWZzuWvO8j9R0fus3XxDee9lRlVy8dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACKeyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiMEJ2TDIzOUU1X1FhUkZDTUJMZWJUVEJRejd6QWFGbzJEX3ZEc3BaV3hVUSIsIm9yaWdpbiI6Imh0dHBzOi8va2V5cy5jb2luYmFzZS5jb20iLCJjcm9zc09yaWdpbiI6ZmFsc2V9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
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

