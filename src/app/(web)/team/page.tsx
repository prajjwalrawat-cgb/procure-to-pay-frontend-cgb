'use client';

import {
  Button,
  Card,
  CardHeader,
  CardMeta,
  CardTitle,
  DataState,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonRows,
  SortableHead,
  StatusText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  controlClass,
  useSort,
} from '@/components/ui';
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
import { formatDate } from '@/lib/format';

function initials(name: string, email: string): string {
  const src = name?.trim() || email;
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

export default function TeamPage(): React.JSX.Element {
  const { data: members, isLoading, error, refetch } = useTeam();
  const { data: pending, isLoading: pendingLoading } = usePendingInvites();
  const invite = useInviteMember();
  const remove = useRemoveMember();
  const revoke = useRevokeInvite();
  const updateRole = useUpdateMemberRole();
  const toast = useToastStore((s) => s.push);
  const currentUser = useSessionStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(ASSIGNABLE_ROLES[0]?.value ?? 'REQUESTER');
  // Removing a member and revoking an invite both cut someone's access, so
  // each goes through the same confirm step rather than a browser dialog.
  const [confirm, setConfirm] = useState<
    | { kind: 'remove'; member: TeamMember }
    | { kind: 'revoke'; id: string; email: string }
    | null
  >(null);
  const { sorted, sort, toggle } = useSort<TeamMember, 'member' | 'role' | 'status' | 'joined'>(
    members ?? [],
    {
      member: (m) => m.name || m.email,
      role: (m) => m.roles.map(roleLabel).join(', '),
      status: (m) => (m.isActive ? 'Active' : 'Invited'),
      joined: (m) => new Date(m.createdAt),
    },
  );

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
        onSuccess: () =>
          toast(`${m.name || m.email} is now ${roleLabel(newRole)}`, 'success'),
        onError: (err) =>
          toast(err instanceof Error ? err.message : 'Failed to change role', 'error'),
      },
    );
  };

  const onRemove = (m: TeamMember): void => {
    remove.mutate(m.id, {
      onSuccess: () => {
        setConfirm(null);
        toast(`${m.name || m.email} removed`, 'success');
      },
      onError: (err) =>
        toast(err instanceof Error ? err.message : 'Failed to remove', 'error'),
    });
  };

  const onRevoke = (id: string, email: string): void => {
    revoke.mutate(id, {
      onSuccess: () => {
        setConfirm(null);
        toast(`Invitation to ${email} revoked`, 'success');
      },
      onError: (err) =>
        toast(err instanceof Error ? err.message : 'Failed to revoke', 'error'),
    });
  };

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage who can access your workspace and what they can do."
      />

      {/*
       * `minmax(0,1fr)`, not `1fr`. A grid track sized `1fr` refuses to shrink
       * below its content's min-content width, so the member table pushed past
       * its own column and the Remove action was clipped off the right edge.
       * This is the fix for that class of bug everywhere, not a nudge.
       */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Table>
            <TableHeader>
              <tr>
                <SortableHead label="Member" sortKey="member" sort={sort} onSort={toggle} />
                <SortableHead label="Role" sortKey="role" sort={sort} onSort={toggle} />
                <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggle} />
                <SortableHead label="Joined" sortKey="joined" sort={sort} onSort={toggle} />
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={5} />
              ) : error || !members?.length ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <DataState
                      isLoading={isLoading}
                      error={error}
                      isEmpty={!members?.length}
                      onRetry={() => void refetch()}
                      empty={{
                        title: 'No one else here yet',
                        detail:
                          'People you invite appear here once they have set a password.',
                      }}
                    >
                      {null}
                    </DataState>
                  </td>
                </tr>
              ) : null}

              {!isLoading && sorted.map((m) => {
                const isSelf = m.id === currentUser?.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="bg-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white">
                          {initials(m.name, m.email)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-ink truncate font-medium">
                            {m.name || m.email}
                            {isSelf && <span className="text-muted ml-1.5">(you)</span>}
                          </div>
                          <div className="text-muted truncate text-caption">{m.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isSelf ? (
                        // An admin cannot change their own role inline — losing
                        // your own admin rights mid-session is not undoable from
                        // inside the app.
                        <span className="text-text">
                          {m.roles.map(roleLabel).join(', ') || '—'}
                        </span>
                      ) : (
                        <Select
                          value={m.roles[0] ?? ''}
                          onChange={(e) => onRoleChange(m, e.target.value)}
                          disabled={updateRole.isPending}
                          // `w-auto` sizes to content, but an `appearance-none`
                          // select does not reserve room for the chevron we
                          // draw ourselves — so the longest role names were
                          // clipped under it. The min-width buys that room.
                          className={cn(
                            controlClass,
                            'w-auto min-w-44 py-1.5 text-caption',
                          )}
                          aria-label={`Role for ${m.name || m.email}`}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </TableCell>

                    <TableCell>
                      <StatusText variant={m.isActive ? 'success' : 'warn'}>
                        {m.isActive ? 'Active' : 'Invited'}
                      </StatusText>
                    </TableCell>

                    <TableCell className="text-muted font-numeric">
                      {formatDate(m.createdAt)}
                    </TableCell>

                    <TableCell className="text-right">
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirm({ kind: 'remove', member: m })}
                          disabled={remove.isPending}
                          className="hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Invite panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Invite teammate</CardTitle>
            <CardMeta>
              Sends an invitation email. They join the workspace after setting a password.
            </CardMeta>
          </CardHeader>
          <form onSubmit={onInvite} className="flex flex-col gap-3 px-4 pb-4">
            <Field label="Full name" htmlFor="invite-name" required>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </Field>
            <Field label="Email" htmlFor="invite-email" required>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </Field>
            <Field
              label="Role"
              htmlFor="invite-role"
              hint={ASSIGNABLE_ROLES.find((r) => r.value === role)?.description}
            >
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              variant="primary"
              disabled={invite.isPending}
              className="mt-1 w-full"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Pending invitations */}
      <section className="mt-8">
        <h2 className="text-ink tracking-heading text-h3 font-semibold">
          Pending invitations
        </h2>
        <p className="text-muted mt-1 text-caption">
          Invited people appear in the team above once they accept. Revoking an invitation
          immediately disables its link.
        </p>

        {pendingLoading ? (
          <Table className="mt-3">
            <TableBody>
              <SkeletonRows rows={2} cols={4} />
            </TableBody>
          </Table>
        ) : pending && pending.length > 0 ? (
          <Table className="mt-3">
            <TableHeader>
              <tr>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-ink">{p.email}</TableCell>
                  <TableCell className="text-muted">
                    {p.roles.map(roleLabel).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted font-numeric">
                    {formatDate(p.invitedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirm({ kind: 'revoke', id: p.id, email: p.email })}
                      disabled={revoke.isPending}
                      className="hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="border-line bg-panel mt-3 rounded-lg border">
            <EmptyState
              compact
              title="No invitations outstanding"
              detail="Anyone you invite is listed here until they set a password."
            />
          </div>
        )}
      </section>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm?.kind === 'remove' && (
            <>
              <DialogTitle>Remove {confirm.member.name || confirm.member.email}?</DialogTitle>
              <DialogDescription>
                They lose access to the workspace straight away. Documents they created
                or approved keep their history.
              </DialogDescription>
            </>
          )}
          {confirm?.kind === 'revoke' && (
            <>
              <DialogTitle>Revoke the invitation for {confirm.email}?</DialogTitle>
              <DialogDescription>
                Their invitation link stops working immediately. You can invite them again
                later.
              </DialogDescription>
            </>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={remove.isPending || revoke.isPending}
              onClick={() => {
                if (confirm?.kind === 'remove') onRemove(confirm.member);
                if (confirm?.kind === 'revoke') onRevoke(confirm.id, confirm.email);
              }}
            >
              {confirm?.kind === 'revoke' ? 'Revoke invitation' : 'Remove member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
