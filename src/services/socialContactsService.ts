import { apiRequest } from '@/config/api';

export interface SocialContacts {
  whatsapp_number: string;
  whatsapp_message: string;
  telegram_username: string;
  instagram_username: string;
  tiktok_username: string;
  whatsapp_enabled: boolean;
  telegram_enabled: boolean;
  instagram_enabled: boolean;
  tiktok_enabled: boolean;
}

const DEFAULTS: SocialContacts = {
  whatsapp_number: '5598981074836',
  whatsapp_message: 'Olá, pode me ajudar? Estou no site apipainel.com.br',
  telegram_username: 'apipainel_bot',
  instagram_username: 'apipainel',
  tiktok_username: 'apipainel',
  whatsapp_enabled: true,
  telegram_enabled: true,
  instagram_enabled: true,
  tiktok_enabled: true,
};

let cachedContacts: SocialContacts | null = null;

export const socialContactsService = {
  async getContacts(): Promise<SocialContacts> {
    if (cachedContacts) return cachedContacts;

    const keys = [
      'contact_whatsapp_number',
      'contact_whatsapp_message',
      'contact_telegram_username',
      'contact_instagram_username',
      'contact_tiktok_username',
      'contact_whatsapp_enabled',
      'contact_telegram_enabled',
      'contact_instagram_enabled',
      'contact_tiktok_enabled',
    ];

    try {
      const results = await Promise.allSettled(
        keys.map(key => apiRequest<any>(`/system-config/get?key=${key}`))
      );

      const configMap: Record<string, unknown> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value?.success && result.value?.data) {
          configMap[keys[i]] = result.value.data.config_value;
        }
      });

      const hasAnyData = Object.keys(configMap).length > 0;

      const parseBool = (val: unknown, fallback: boolean) => {
        if (val === undefined || val === null || val === '') return fallback;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
          const normalized = val.trim().toLowerCase();
          return normalized === 'true' || normalized === '1';
        }
        return fallback;
      };

      cachedContacts = {
        whatsapp_number: String(configMap['contact_whatsapp_number'] ?? DEFAULTS.whatsapp_number),
        whatsapp_message: String(configMap['contact_whatsapp_message'] ?? DEFAULTS.whatsapp_message),
        telegram_username: String(configMap['contact_telegram_username'] ?? DEFAULTS.telegram_username),
        instagram_username: String(configMap['contact_instagram_username'] ?? DEFAULTS.instagram_username),
        tiktok_username: String(configMap['contact_tiktok_username'] ?? DEFAULTS.tiktok_username),
        whatsapp_enabled: parseBool(configMap['contact_whatsapp_enabled'], DEFAULTS.whatsapp_enabled),
        telegram_enabled: parseBool(configMap['contact_telegram_enabled'], DEFAULTS.telegram_enabled),
        instagram_enabled: parseBool(configMap['contact_instagram_enabled'], DEFAULTS.instagram_enabled),
        tiktok_enabled: parseBool(configMap['contact_tiktok_enabled'], DEFAULTS.tiktok_enabled),
      };

      console.log(`✅ [SOCIAL] Contatos carregados ${hasAnyData ? 'da API' : '(fallback)'}:`, cachedContacts);
    } catch (error) {
      console.warn('⚠️ [SOCIAL] Erro ao buscar contatos, usando defaults:', error);
      cachedContacts = { ...DEFAULTS };
    }

    return cachedContacts;
  },

  clearCache() {
    cachedContacts = null;
  }
};
