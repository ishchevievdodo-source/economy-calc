type TelegramUser = { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }
type TelegramWebApp = {
  initData: string
  initDataUnsafe: { user?: TelegramUser }
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy'): void; notificationOccurred(type: 'success' | 'error'): void }
}

declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }

export const telegram = window.Telegram?.WebApp
export const telegramUser = telegram?.initDataUnsafe.user
export const telegramInitData = telegram?.initData ?? ''

if (telegram) {
  telegram.ready()
  telegram.expand()
  telegram.setHeaderColor('#1f4d3e')
  telegram.setBackgroundColor('#f4f0e7')
}

