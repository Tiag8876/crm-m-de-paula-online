import type { AppUser } from '@/types/auth';

export type UserAccessProfile = 'admin' | 'commercial' | 'traffic';

const normalize = (value: string | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toLowerCase()
    .trim();

const looksLikeAdminSector = (sectorRaw: string | undefined): boolean => {
  const sector = normalize(sectorRaw);
  if (!sector) return false;

  if (/(comerc|venda|vendedor|traf|midia|marketing)/.test(sector)) {
    return false;
  }

  if (/(diret|admin|propriet|owner)/.test(sector)) {
    return true;
  }

  if (/(gest|gerenc)/.test(sector)) {
    return true;
  }

  return false;
};

export function getUserAccessProfile(user: AppUser | null): UserAccessProfile {
  if (!user) return 'commercial';
  if (isAdminUser(user)) return 'admin';

  const sector = normalize(user.sector);
  if (sector.includes('traf') || sector.includes('traffic') || sector.includes('midia')) {
    return 'traffic';
  }

  return 'commercial';
}

export function isAdminUser(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return looksLikeAdminSector(user.sector);
}

export function getDefaultRouteForUser(user: AppUser | null): string {
  const profile = getUserAccessProfile(user);
  if (profile === 'traffic') return '/traffic';
  return '/';
}

export function canAccessPath(user: AppUser | null, path: string): boolean {
  const profile = getUserAccessProfile(user);
  if (profile === 'admin') return true;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const modulePath = cleanPath.split('?')[0];

  if (profile === 'traffic') {
    return (
      modulePath === '/' ||
      modulePath.startsWith('/campaigns') ||
      modulePath.startsWith('/traffic') ||
      modulePath.startsWith('/calendar') ||
      modulePath.startsWith('/settings')
    );
  }

  return (
    modulePath === '/' ||
    modulePath.startsWith('/leads') ||
    modulePath.startsWith('/prospecting') ||
    modulePath.startsWith('/reports') ||
    modulePath.startsWith('/calendar') ||
    modulePath.startsWith('/settings')
  );
}
