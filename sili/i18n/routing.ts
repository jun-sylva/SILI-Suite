import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed' // Maintient l'URL d'origine pour le FR par défaut
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);
