import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Permet de séparer les fichiers JSON par namespace (page)
  const namespaces = ['login', 'register', 'sidebar', 'common', 'superadmin', 'auth'];
  const messages: Record<string, any> = {};

  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`../messages/${locale}/${ns}.json`)).default;
    } catch (e) {
      // Si le fichier n'existe pas encore, on l'ignore (fallback silencieux)
      messages[ns] = {};
    }
  }

  return {
    locale,
    messages
  };
});
