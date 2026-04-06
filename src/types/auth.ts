export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  sector: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: AppUser;
}
