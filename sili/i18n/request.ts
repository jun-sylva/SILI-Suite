import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Charge uniquement les namespaces réellement utilisés et présents
  // dans les dossiers messages/<locale>.
  const namespaces = [
    'auth',
    'dashboard',
    'diagnostic',
    'errors',
    'login',
    'logs',
    'modules',
    'navigation',
    'recovery',
    'register',
    'remediation',
    'reporting',
    'securite',
    'societes',
    'societe_settings',
    'societe_users',
    'superadmin',
    'tenant_settings',
    'tenants',
    'utilisateurs',
    'validation',
  ];
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
