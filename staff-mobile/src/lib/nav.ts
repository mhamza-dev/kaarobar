import { router } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Maps the legacy `/app/*` deep-link paths (shared with kaarobar-web) onto this
 * app's Expo Router tree. Screens keep using the same path strings they used
 * under React Navigation, so routing stays one concept rather than two.
 */
function resolve(path: string): Href | null {
  if (path === '/landing' || path === 'Landing') return '/landing';
  if (path === '/login' || path === 'Login') return '/login';
  if (path === '/signup' || path === 'Signup') return '/signup';

  // Tabs
  if (path === '/app/pos') return '/(tabs)/pos';
  if (path === '/app/sales') return '/(tabs)/sales';
  if (path === '/app/inventory' || path === '/app/products') return '/(tabs)/products';
  if (path === '/app/customers') return '/(tabs)/customers';
  if (path === '/app/settings') return '/(tabs)/settings';

  // Settings stack
  if (path === '/app/dashboard') return '/(tabs)/settings/workspace';
  if (path === '/app/ess' || path === '/app/attendance') {
    return '/(tabs)/settings/attendance';
  }
  if (path === '/app/leave') return '/(tabs)/settings/leave';
  if (path === '/app/notifications') return '/(tabs)/settings/notifications';
  if (path === '/app/returns') return '/(tabs)/settings/returns';
  if (path === '/app/businesses') return '/(tabs)/settings/businesses';
  if (path === '/app/marketing') return '/(tabs)/settings/marketing';

  if (path.startsWith('/app/marketing/templates/')) {
    const id = path.split('/').pop();
    return id ? (`/(tabs)/settings/marketing/template/${id}` as Href) : null;
  }
  if (path.startsWith('/app/businesses/')) {
    const id = path.split('/').pop();
    return id ? (`/(tabs)/settings/businesses/${id}` as Href) : null;
  }

  // Any other /app/* path lands on the workspace entry point.
  if (path.startsWith('/app/')) return '/(tabs)/pos';
  return null;
}

function withParams(href: Href, params?: Record<string, unknown>): Href {
  if (!params || Object.keys(params).length === 0) return href;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  if (!query) return href;
  return `${href}${String(href).includes('?') ? '&' : '?'}${query}` as Href;
}

/** Replace the current history entry (sign-in / sign-out transitions). */
export function replacePath(path: string, params?: Record<string, unknown>) {
  const href = resolve(path);
  if (href) router.replace(withParams(href, params));
}

/** Push a new screen. */
export function pushPath(path: string, params?: Record<string, unknown>) {
  const href = resolve(path);
  if (href) router.push(withParams(href, params));
}

/** Go back if possible, else fall back to the workspace root. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/pos');
}

export { router };
