// Без зависимостей — можно импортировать в клиентский код мини-приложения.
export const CONSENT_TYPES = ['pd', 'feed', 'calendar', 'ads'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]
