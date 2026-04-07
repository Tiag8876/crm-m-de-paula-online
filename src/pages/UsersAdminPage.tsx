import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import type { AppUser, UserRole } from '@/types/auth';
import { getUserAccessProfile } from '@/lib/access';

const ACCESS_OPTIONS = [
  { value: 'commercial', label: 'Comercial' },
  { value: 'traffic', label: 'Tráfego' },
] as const;

type AccessOption = (typeof ACCESS_OPTIONS)[number]['value'];

export function UsersAdminPage({ embedded = false }: { embedded?: boolean }) {
  const { users, user: currentUser, fetchUsers, createUser, updateUser, deleteUser } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [accessProfile, setAccessProfile] = useState<AccessOption>('commercial');
  const [error, setError] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAccessProfile, setEditAccessProfile] = useState<AccessOption>('commercial');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    fetchUsers().catch(() => null);
  }, [fetchUsers]);

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId) || null,
    [users, editingUserId]
  );

  useEffect(() => {
    if (!editingUser) {
      return;
    }
    setEditName(editingUser.name);
    setEditEmail(editingUser.email);
    setEditAccessProfile(getUserAccessProfile(editingUser) === 'traffic' ? 'traffic' : 'commercial');
    setEditRole(editingUser.role);
    setEditActive(editingUser.active);
    setEditPassword('');
  }, [editingUser]);

  const onCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const sector = role === 'admin' ? 'Diretoria' : accessProfile === 'traffic' ? 'Tráfego' : 'Comercial';
      await createUser({ name, email, password, role, sector, active: true });
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setAccessProfile('commercial');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuario');
    }
  };

  const onSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    setError(null);
    try {
      const sector = editRole === 'admin' ? 'Diretoria' : editAccessProfile === 'traffic' ? 'Tráfego' : 'Comercial';
      await updateUser(editingUser.id, {
        name: editName,
        email: editEmail,
        sector,
        role: editRole,
        active: editActive,
        password: editPassword || undefined,
      });
      setEditingUserId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar usuario');
    }
  };

  const onDeleteUser = async (targetUser: AppUser) => {
    if (targetUser.id === currentUser?.id) {
      setError('Nao e permitido excluir o proprio usuario logado');
      return;
    }

    const confirmed = window.confirm(`Deseja realmente excluir o usuario "${targetUser.name}"? Esta acao nao pode ser desfeita.`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteUser(targetUser.id);
      if (editingUserId === targetUser.id) {
        setEditingUserId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir usuario');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {!embedded && (
        <header>
          <h1 className="text-4xl font-serif font-bold gold-text-gradient">Administracao de Usuarios</h1>
          <p className="text-muted-foreground">Cadastre usuarios, setor, perfil e credenciais. Apenas admin pode editar.</p>
        </header>
      )}

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Novo Usuario</h2>
        <form onSubmit={onCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nome" className="rounded-lg border border-border bg-background px-3 py-2" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="Email" className="rounded-lg border border-border bg-background px-3 py-2" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" placeholder="Senha inicial" className="rounded-lg border border-border bg-background px-3 py-2" />
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
          <select
            value={accessProfile}
            onChange={(e) => setAccessProfile(e.target.value as AccessOption)}
            disabled={role === 'admin'}
            className="rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-50"
          >
            {ACCESS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest px-4 py-2">Criar</button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Categoria de acesso: Admin vê tudo. Comercial vê Leads e Relatórios. Tráfego vê Painel de Tráfego.
        </p>
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Usuarios Cadastrados</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2">Nome</th>
                <th className="py-2">Email</th>
                <th className="py-2">Setor</th>
                <th className="py-2">Perfil</th>
                <th className="py-2">Status</th>
                <th className="py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/60">
                  <td className="py-2">{user.name}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">{user.sector}</td>
                  <td className="py-2">{user.role}</td>
                  <td className="py-2">{user.active ? 'Ativo' : 'Inativo'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditingUserId(user.id)} className="text-primary hover:underline">Editar</button>
                      <button
                        onClick={() => onDeleteUser(user)}
                        disabled={user.id === currentUser?.id}
                        className="text-red-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingUser && (
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Editar Usuario</h2>
          <form onSubmit={onSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} required className="rounded-lg border border-border bg-background px-3 py-2" />
            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required type="email" className="rounded-lg border border-border bg-background px-3 py-2" />
            <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)} className="rounded-lg border border-border bg-background px-3 py-2">
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              value={editAccessProfile}
              onChange={(e) => setEditAccessProfile(e.target.value as AccessOption)}
              disabled={editRole === 'admin'}
              className="rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-50"
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} type="password" placeholder="Nova senha (opcional)" className="rounded-lg border border-border bg-background px-3 py-2" />
            <label className="flex items-center gap-2 text-sm">
              <input checked={editActive} onChange={(e) => setEditActive(e.target.checked)} type="checkbox" /> Usuario ativo
            </label>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest px-4 py-2">Salvar</button>
              <button type="button" onClick={() => setEditingUserId(null)} className="rounded-lg border border-border px-4 py-2">Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

