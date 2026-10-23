import type { MessageSource } from '../types/message';

/** Display order for inbox filters and manual entry. */
export const MESSAGE_SOURCES: MessageSource[] = [
  'whatsapp',
  'facebook',
  'instagram',
  'telegram',
  'email',
  'tiktok',
  'manual',
];

export const SOURCE_LABEL_KEYS: Record<MessageSource, string> = {
  whatsapp: 'source.whatsapp',
  facebook: 'source.facebook',
  instagram: 'source.instagram',
  telegram: 'source.telegram',
  email: 'source.email',
  tiktok: 'source.tiktok',
  manual: 'source.manual',
};
