// Тексты по умолчанию — из юр. шаблона 07 (yuridicheskie-shablony/07-teksty-ekranov.md).
// Окончательные тексты пишет автор в админке (ТЗ 6.8) — на шаге 3 они переедут в Payload global.
export const DEFAULT_TEXTS = {
  betaBot:
    'Это бета-версия: бот в разработке и открыт только для тестирования. Что-то может работать не так, материалы ещё дополняются. После окончания тестирования все ваши данные в боте будут удалены.',
  betaBanner:
    'Бета-версия. Приложение в разработке: что-то может работать не так. После тестирования ваши данные будут удалены.',
  betaConsent: 'Идёт тестирование. Тексты согласий — черновики, окончательные появятся перед открытием.',
  notInAccessList: 'Бот пока в разработке. Скоро откроемся — следите за каналом автора: {channelUrl}',
  welcome:
    'Здравствуйте! Это «Дневник спокойного материнства» — упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев.\n\nМатериалы носят информационный характер и не заменяют консультацию врача.\n\nПользуясь ботом, вы принимаете <a href="{siteUrl}/terms">Пользовательское соглашение</a>.',
  startButton: 'Начать',
  openAppButton: 'Открыть приложение',
  needConsent: 'Чтобы продолжить, откройте приложение и отметьте согласие на обработку данных.',
  afterConsent: 'Готово! Материалы — в приложении, кнопка «Открыть приложение» рядом с полем ввода.',
  notReadyYet: 'Эта часть ещё в разработке. Пока всё — в приложении.',
  help:
    'Как пользоваться: нажмите «Открыть приложение» — там упражнения и практики по возрасту малыша.\n\nКанал автора: {channelUrl}\n<a href="{siteUrl}/terms">Пользовательское соглашение</a> · <a href="{siteUrl}/privacy">Политика обработки данных</a>',

  // Главное меню и настройки (ТЗ 6.2)
  mainMenu: 'Главное меню. Всё основное — в приложении.',
  helpButton: 'Помощь',
  settingsButton: 'Настройки',
  backButton: '« Назад',
  settingsTitle: 'Настройки',
  settingsAge: 'Возраст малыша: {age}.',
  settingsAgeEmpty: 'Возраст малыша не указан — он нужен только ленте и подсказке «ваш раздел».',
  ageButton: 'Возраст малыша',
  myConsentsButton: 'Мои согласия',
  revokeButton: 'Отозвать согласие',

  // Возраст ребёнка (ТЗ 6.3)
  ageAskYear: 'В каком году родился малыш? Точная дата не нужна.',
  ageAskMonth: 'В каком месяце?',
  ageSaved: 'Сохранено: {month} {year}.',
  ageTooYoung: 'Основные материалы начинаются с 3 месяцев, а пока вам может помочь «Спокойная мама».',
  ageClearButton: 'Удалить дату',
  ageCleared: 'Дата рождения удалена.',

  // Отзыв согласия (ТЗ 6.5, шаблон 07 §2)
  revokeConfirm:
    'Все ваши данные, закладки, календарь и подписка на ленту будут удалены без возможности восстановления. Удалить?',
  revokeSubscription:
    'У вас оплачена подписка до {date}. После удаления доступ к закрытым материалам прекратится. Вернуть деньги за неиспользованный период можно по <a href="{siteUrl}/oferta">условиям оферты</a>.',
  revokeYes: 'Да, удалить',
  revokeNo: 'Отмена',
  revokeDone:
    'Данные удалены. Сообщения в этом чате остались у вас — бот не может их удалить, вы можете очистить чат сами. Если захотите вернуться, нажмите /start.',
  revokeCancelled: 'Хорошо, ничего не удаляем.',
  revokeNothing: 'У нас нет ваших данных. Если захотите начать, нажмите /start.',
  consentRevokeItem: 'Отозвать согласие «{title}»?',
  consentRevokeItemPd: 'Все ваши данные будут удалены без возможности восстановления.',
  consentRevokeOk: 'Отозвать',

  // Свободный текст, голос и файлы (ТЗ 6.4)
  searchSoon: 'Поиск по материалам скоро появится. Пока всё — в приложении.',
  voiceNotSupported: 'Голосовые пока не поддерживаются.',
  onlyTextAndVoice: 'Я понимаю только текст и голос.',

  // Приложение: настройки
  appSettingsTitle: 'Настройки',
  appRevokeAll: 'Отозвать согласие и удалить данные',
  appDeletedTitle: 'Данные удалены',
  appDeleted: 'Мы удалили все ваши данные. Если захотите вернуться, откройте приложение снова.',
  consentTitle: 'Перед началом',
  consentIntro:
    'Отметьте, на что вы согласны. Мы храним минимум: ваш Telegram ID и то, что вы сами сохраните в приложении. Имя, телефон и голос не храним.',
  consentAcceptAll: 'Принять всё',
  consentContinue: 'Продолжить с выбранными',
  consentNotNow: 'Не сейчас',
  consentNotNowText: 'Без согласия на обработку данных приложение не работает. Вы можете вернуться в любой момент.',
  consentDocLink: 'Текст согласия',
  privacyLink: 'Политика обработки данных',
  openViaBot: 'Откройте приложение через бот в Telegram.',
  medicalDisclaimer: 'Материалы автора. Не заменяет консультацию врача.',
} as const

export type TextKey = keyof typeof DEFAULT_TEXTS

export function fmt(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

export const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const

/** «3 месяца», «12 месяцев». */
export function monthsLabel(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  const word = m10 === 1 && m100 !== 11 ? 'месяц' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'месяца' : 'месяцев'
  return `${n} ${word}`
}

/** Тексты, которые нужны мини-приложению (отдаются в /api/tma/session). */
export const CLIENT_TEXT_KEYS = [
  'betaBanner',
  'betaConsent',
  'consentTitle',
  'consentIntro',
  'consentAcceptAll',
  'consentContinue',
  'consentNotNow',
  'consentNotNowText',
  'consentDocLink',
  'privacyLink',
  'medicalDisclaimer',
  'settingsButton',
  'backButton',
  'appSettingsTitle',
  'myConsentsButton',
  'appRevokeAll',
  'revokeConfirm',
  'revokeYes',
  'revokeNo',
  'consentRevokeItem',
  'consentRevokeItemPd',
  'consentRevokeOk',
  'appDeletedTitle',
  'appDeleted',
] as const satisfies readonly TextKey[]

export type ClientTextKey = (typeof CLIENT_TEXT_KEYS)[number]
