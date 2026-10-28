// Тексты по умолчанию — из юр. шаблона 07 (yuridicheskie-shablony/07-teksty-ekranov.md).
// Окончательные тексты пишет автор в админке (ТЗ 6.8): Payload global «Тексты» → app.app_settings,
// живой объект `T` в settings.ts. Файл без зависимостей — его импортирует клиентский код.
export const DEFAULT_TEXTS = {
  // Описание бота в профиле и в пустом чате (ТЗ 6.8). Аватар ставится в BotFather.
  botDescription:
    'Упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев. Спокойно, по шагам, по возрасту малыша.',
  botShortDescription: 'Упражнения и практики для мам малышей 3–18 месяцев.',

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

  // Приложение: материалы (ТЗ 8.1, 8.2)
  homeTitle: 'Дневник спокойного материнства',
  homeSections: 'Разделы по возрасту',
  yourSection: 'ваш раздел',
  homeContinue: 'Продолжить',
  homeFresh: 'Новое от автора',
  homeEmpty: 'Материалы скоро появятся.',
  sectionLabel: '{from}–{to} месяцев',
  tabExercises: 'Упражнения',
  tabArticles: 'Статьи',
  sectionEmptyTab: 'Здесь пока пусто.',
  minutesShort: '{n} мин',
  lockedTitle: 'Материал по подписке',
  lockedText: 'Этот материал открывается с подпиской.',
  unavailable: 'Материал больше недоступен.',
  notFound: 'Материал не найден.',
  loadError: 'Не получилось загрузить. Закройте и откройте приложение ещё раз.',
  stepOf: 'Шаг {n} из {total}',
  stepNext: 'Дальше',
  howToKnowTitle: 'Как понять, что получается',
  doneButton: 'Получилось',
  notYetButton: 'Пока не получается',
  notYetDefault:
    'Это нормально: у каждого малыша свой темп. Если малыш плачет, напрягается или ему больно — остановитесь. Это не провал: попробуйте в другой день или обсудите упражнение со специалистом.',
  easierTitle: 'Облегчённый вариант',
  doctorTitle: 'Когда показать врачу',
  doneNext: 'Отмечено. Следующее упражнение раздела:',
  doneLast: 'Отмечено. Это было последнее упражнение раздела.',
  doneBadge: 'выполнено',
  bookmarkAdd: 'В закладки',
  bookmarkRemove: 'В закладках ✓',
  bookmarksTitle: 'Закладки',
  bookmarksEmpty: 'Пока нет закладок.',
  seeAlso: 'См. также',
  ageInApp: 'Возраст малыша',
  ageInAppHint: 'Нужен только для подсказки «ваш раздел». Месяц и год, точная дата не нужна.',
  ageNotSet: 'не указан',
  ageSaveButton: 'Сохранить',
  fontBigger: 'Крупнее шрифт',
} as const

export type TextKey = keyof typeof DEFAULT_TEXTS

/** Подписи и группы текстов для админки автора. Каждый ключ — ровно в одной группе (проверяется тестом). */
export const TEXT_GROUPS: { label: string; texts: Partial<Record<TextKey, string>> }[] = [
  {
    label: 'Вход и бета',
    texts: {
      botDescription: 'Описание бота (профиль, пустой чат)',
      botShortDescription: 'Короткое описание бота',
      betaBot: 'Бета: первая строка приветствия и /help',
      betaBanner: 'Бета: плашка в приложении',
      betaConsent: 'Бета: над окном согласий',
      notInAccessList: 'Не из списка доступа ({channelUrl} — ссылка на канал)',
      welcome: 'Приветствие после /start ({siteUrl} — адрес сайта)',
      startButton: 'Кнопка «Начать»',
      openAppButton: 'Кнопка «Открыть приложение»',
      needConsent: 'Нет согласия — просьба открыть приложение',
      afterConsent: 'После окна согласий (в чат)',
      openViaBot: 'Приложение открыто вне Telegram',
    },
  },
  {
    label: 'Меню и помощь',
    texts: {
      mainMenu: 'Главное меню',
      helpButton: 'Кнопка «Помощь»',
      settingsButton: 'Кнопка «Настройки»',
      backButton: 'Кнопка «Назад»',
      help: 'Текст /help ({channelUrl}, {siteUrl})',
      notReadyYet: 'Функция ещё в разработке',
    },
  },
  {
    label: 'Настройки и возраст',
    texts: {
      settingsTitle: 'Заголовок настроек в боте',
      settingsAge: 'Возраст малыша ({age})',
      settingsAgeEmpty: 'Возраст не указан',
      ageButton: 'Кнопка «Возраст малыша»',
      myConsentsButton: 'Кнопка «Мои согласия»',
      revokeButton: 'Кнопка «Отозвать согласие»',
      ageAskYear: 'Вопрос о годе рождения',
      ageAskMonth: 'Вопрос о месяце рождения',
      ageSaved: 'Дата сохранена ({month} {year})',
      ageTooYoung: 'Малышу меньше 3 месяцев',
      ageClearButton: 'Кнопка «Удалить дату»',
      ageCleared: 'Дата удалена',
      appSettingsTitle: 'Заголовок настроек в приложении',
    },
  },
  {
    label: 'Согласия и отзыв',
    texts: {
      consentTitle: 'Окно согласий: заголовок',
      consentIntro: 'Окно согласий: вступление',
      consentAcceptAll: 'Кнопка «Принять всё»',
      consentContinue: 'Кнопка «Продолжить с выбранными»',
      consentNotNow: 'Кнопка «Не сейчас»',
      consentNotNowText: 'После «Не сейчас»',
      consentDocLink: 'Ссылка «Текст согласия»',
      privacyLink: 'Ссылка на политику',
      revokeConfirm: 'Подтверждение отзыва',
      revokeSubscription: 'Отзыв при оплаченной подписке ({date}, {siteUrl})',
      revokeYes: 'Кнопка «Да, удалить»',
      revokeNo: 'Кнопка «Отмена»',
      revokeDone: 'Данные удалены (бот)',
      revokeCancelled: 'Отзыв отменён',
      revokeNothing: 'Удалять нечего',
      consentRevokeItem: 'Отзыв одного пункта ({title})',
      consentRevokeItemPd: 'Отзыв первого пункта — пояснение',
      consentRevokeOk: 'Кнопка «Отозвать»',
      appRevokeAll: 'Приложение: кнопка полного отзыва',
      appDeletedTitle: 'Приложение: заголовок после удаления',
      appDeleted: 'Приложение: текст после удаления',
    },
  },
  {
    label: 'Чат и материалы',
    texts: {
      searchSoon: 'Поиск ещё не готов',
      voiceNotSupported: 'Голосовые не поддерживаются',
      onlyTextAndVoice: 'Пришли фото, файл или стикер',
      medicalDisclaimer: 'Подпись под каждым материалом',
    },
  },
  {
    label: 'Приложение: материалы',
    texts: {
      homeTitle: 'Главная: заголовок',
      homeSections: 'Главная: «Разделы по возрасту»',
      yourSection: 'Пометка «ваш раздел»',
      homeContinue: 'Главная: «Продолжить»',
      homeFresh: 'Главная: «Новое от автора»',
      homeEmpty: 'Главная: материалов ещё нет',
      sectionLabel: 'Название раздела ({from}, {to})',
      tabExercises: 'Вкладка «Упражнения»',
      tabArticles: 'Вкладка «Статьи»',
      sectionEmptyTab: 'Пустая вкладка',
      minutesShort: 'Время ({n})',
      lockedTitle: 'Закрытый материал: заголовок',
      lockedText: 'Закрытый материал: текст',
      unavailable: 'Материал в архиве',
      notFound: 'Материал не найден',
      loadError: 'Ошибка загрузки',
      stepOf: 'Шаг ({n}, {total})',
      stepNext: 'Кнопка «Дальше»',
      howToKnowTitle: 'Заголовок «Как понять, что получается»',
      doneButton: 'Кнопка «Получилось»',
      notYetButton: 'Кнопка «Пока не получается»',
      notYetDefault: '«Пока не получается»: общий текст, если у упражнения нет своего',
      easierTitle: 'Заголовок «Облегчённый вариант»',
      doctorTitle: 'Заголовок «Когда показать врачу»',
      doneNext: 'После «Получилось»: есть следующее',
      doneLast: 'После «Получилось»: последнее в разделе',
      doneBadge: 'Пометка «выполнено»',
      bookmarkAdd: 'Кнопка «В закладки»',
      bookmarkRemove: 'Кнопка «В закладках»',
      bookmarksTitle: 'Закладки: заголовок',
      bookmarksEmpty: 'Закладок нет',
      seeAlso: '«См. также»',
      ageInApp: 'Настройки: «Возраст малыша»',
      ageInAppHint: 'Настройки: пояснение к возрасту',
      ageNotSet: 'Возраст не указан',
      ageSaveButton: 'Кнопка «Сохранить»',
      fontBigger: 'Переключатель «Крупнее шрифт»',
    },
  },
]

export const TEXT_LABELS = Object.assign({}, ...TEXT_GROUPS.map((g) => g.texts)) as Record<TextKey, string>

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
  'ageClearButton',
  'ageTooYoung',
  ...(Object.keys(TEXT_GROUPS.find((g) => g.label === 'Приложение: материалы')!.texts) as TextKey[]),
] as const satisfies readonly TextKey[]

export type ClientTextKey = (typeof CLIENT_TEXT_KEYS)[number]
