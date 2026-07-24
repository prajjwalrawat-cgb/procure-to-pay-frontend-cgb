'use client';

import { Button, Input } from '@/components/ui';
import { Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  ASSIGNABLE_ROLES,
  roleLabel,
  useInviteMember,
  usePendingInvites,
  useRemoveMember,
  useRevokeInvite,
  useTeam,
  useUpdateMemberRole,
  type TeamMember,
} from '@/lib/api/users';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

function initials(name: string, email: string): string {
  const src = name?.trim() || email;
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TeamPage(): React.JSX.Element {
  const { data: members, isLoading, error } = useTeam();
  const { data: pending } = usePendingInvites();
  const invite = useInviteMember();
  const remove = useRemoveMember();
  const revoke = useRevokeInvite();
  const updateRole = useUpdateMemberRole();
  const toast = useToastStore((s) => s.push);
  const currentUser = useSessionStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(ASSIGNABLE_ROLES[0]?.value ?? 'REQUESTER');

  const onInvite = (e: React.FormEvent): void => {
    e.preventDefault();
    invite.mutate(
      { email: email.trim(), name: name.trim(), roles: [role] },
      {
        onSuccess: () => {
          toast(`Invitation sent to ${email.trim()}`, 'success');
          setEmail('');
          setName('');
        },
        onError: (err) =>
          toast(err instanceof Error ? err.message : 'Failed to send invite', 'error'),
      },
    );
  };

  const onRoleChange = (m: TeamMember, newRole: string): void => {
    if (m.roles[0] === newRole && m.roles.length === 1) return;
    updateRole.mutate(
      { id: m.id, roles: [newRole] },
      {
        onSuccess: () => toast(`${m.name || m.email} is now ${roleLabel(newRole)}`, 'success'),
        onError: (err) =>
          toast(err instanceof Error ? err.message : 'Failed to change role', 'error'),
      },
    );
  };

  const onRemove = (m: TeamMember): void => {
    if (!window.confirm(`Remove ${m.name || m.email}? They will lose access.`)) return;
    remove.mutate(m.id, {
      onSuccess: () => toast(`${m.name || m.email} removed`, 'success'),
      onError: (err) =>
        toast(err instanceof Error ? err.message : 'Failed to remove', 'error'),
    });
  };

  const onRevoke = (id: string, email: string): void => {
    if (!window.confirm(`Revoke the invitation for ${email}? Their link will stop working.`))
      return;
    revoke.mutate(id, {
      onSuccess: () => toast(`Invitation to ${email} revoked`, 'success'),
      onError: (err) =>
        toast(err instanceof Error ? err.message : 'Failed to revoke', 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="tracking-heading text-ink text-[22px] font-semibold">Team</h1>
        <p className="text-muted mt-1 text-[13px]">
          Manage who can access your workspace and what they can do.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Member list */}
        <div className="border-line bg-panel overflow-hidden rounded-xl border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-line text-muted border-b text-left text-[11px] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-muted px-4 py-8 text-center">
                    Loading team…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={5} className="text-danger px-4 py-8 text-center">
                    Failed to load team.
                  </td>
                </tr>
              )}
              {members?.map((m) => {
                const isSelf = m.id === currentUser?.id;
                return (
                  <tr key={m.id} className="border-line border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-accent flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white">
                          {initials(m.name, m.email)}
                        </span>
                        <div>
                          <div className="text-ink font-medium">
                            {m.name || m.email}
                            {isSelf && (
                              <span className="text-muted ml-2 text-[10px] font-semibold uppercase">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-muted text-[12px]">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        // Don't let an admin change their own role inline.
                        <span className="border-line text-ink rounded-full border px-2 py-0.5 text-[11px]">
                          {m.roles.map(roleLabel).join(', ') || '—'}
                        </span>
                      ) : (
                        <select
                          value={m.roles[0] ?? ''}
                          onChange={(e) => onRoleChange(m, e.target.value)}
                          disabled={updateRole.isPending}
                          className="border-line bg-surface text-ink rounded-md border px-2 py-1 text-[12px] disabled:opacity-50"
                          aria-label={`Role for ${m.name || m.email}`}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          m.isActive
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'
                            : 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700'
                        }
                      >
                        {m.isActive ? 'Active' : 'Invited'}
                      </span>
                    </td>
                    <td className="text-muted px-4 py-3 tabular-nums">
                      {formatDate(m.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => onRemove(m)}
                          disabled={remove.isPending}
                          className="text-muted hover:text-danger inline-flex items-center gap-1 text-[12px] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Invite panel */}
        <div className="border-line bg-panel h-fit rounded-xl border p-5">
          <h2 className="text-ink text-[15px] font-semibold">Invite teammate</h2>
          <p className="text-muted mt-1 text-[12px]">
            Sends an invitation email. They join the workspace after setting a password.
          </p>
          <form onSubmit={onInvite} className="mt-4 flex flex-col gap-3">
            <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
              Full name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </label>
            <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
              Email
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@artboxsolutions.com"
                required
              />
            </label>
            <label className="text-text flex flex-col gap-1 text-[12px] font-medium">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border-line bg-surface text-ink w-full rounded-md border px-3 py-2 text-[13px]"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-muted text-[11px]">
                {ASSIGNABLE_ROLES.find((r) => r.value === role)?.description}
              </span>
            </label>
            <Button
              type="submit"
              variant="accent"
              disabled={invite.isPending}
              className="mt-1 w-full"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </div>
      </div>

      {/* Pending invitations */}
      <div className="border-line bg-panel mt-6 rounded-xl border p-5">
        <h2 className="text-ink text-[15px] font-semibold">Pending invitations</h2>
        <p className="text-muted mt-1 text-[12px]">
          Invited users appear in the team above once they accept. Revoking an
          invitation immediately disables its link.
        </p>
        {pending && pending.length > 0 ? (
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="border-line text-muted border-b text-left text-[11px] uppercase tracking-wide">
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Sent</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-line border-b last:border-0">
                  <td className="text-ink px-2 py-2">{p.email}</td>
                  <td className="text-muted px-2 py-2">
                    {p.roles.map(roleLabel).join(', ') || '—'}
                  </td>
                  <td className="text-muted px-2 py-2 tabular-nums">
                    {formatDate(p.invitedAt)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRevoke(p.id, p.email)}
                      disabled={revoke.isPending}
                      className="text-muted hover:text-danger inline-flex items-center gap-1 text-[12px] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted mt-4 text-[13px]">No pending invitations.</p>
        )}
      </div>
    </div>
  );
}
