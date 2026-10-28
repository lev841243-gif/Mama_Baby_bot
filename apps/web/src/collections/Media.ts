import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditCollectionChange, auditCollectionDelete } from '../payload/hooks/audit'
import { MEDIA_DIR } from '../lib/media-config'

/**
 * Картинки, MP4 и аудио (ТЗ 9.4, 13). Картинки уменьшаются под телефон при загрузке (sharp).
 * Маме файлы отдаются только через /api/m/… по подписанной ссылке, выданной после проверки доступа
 * (закрытые материалы — ТЗ 8.6, 13); прямой доступ к коллекции — только у админки.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Файл', plural: 'Медиа' },
  admin: { group: 'Контент', defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'] },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAuthor },
  hooks: { afterChange: [auditCollectionChange], afterDelete: [auditCollectionDelete] },
  upload: {
    staticDir: MEDIA_DIR,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'],
    // Оригинал картинки не больше 2000 px; размеры для экрана — webp.
    resizeOptions: { width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true },
    imageSizes: [
      { name: 'thumb', width: 360, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 78 } } },
      { name: 'card', width: 720, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'full', width: 1280, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 82 } } },
    ],
    adminThumbnail: 'thumb',
  },
  fields: [
    {
      name: 'alt',
      label: 'Описание картинки',
      type: 'text',
      admin: { description: 'Коротко, что на картинке. Читается вслух программами для незрячих.' },
    },
  ],
}
