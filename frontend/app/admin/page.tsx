"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Input } from "@/components/Input";
import { RoleGuard } from "@/components/RoleGuard";
import { Select } from "@/components/Select";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import {
  api,
  ApiError,
  type AdminUsersPage,
  type AuditLogPage,
  type User,
} from "@/lib/api";
import { fadeUp } from "@/lib/motion";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function Rows({ n }: { n: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function Pager({
  total,
  offset,
  onChange,
}: {
  total: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-charcoal/60">
      <span>
        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total} onClick={() => onChange(offset + PAGE_SIZE)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function UsersSection() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .adminUsers({ q: search, role: roleFilter, limit: PAGE_SIZE, offset })
      .then((p) => !cancelled && setPage(p))
      .catch((err) => !cancelled && setError(errMsg(err, "Failed to load users.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, roleFilter, offset, reloadKey]);

  async function patch(u: User, change: { role?: string; is_active?: boolean }, label: string) {
    setBusyId(u.id);
    try {
      const updated = await api.adminUpdateUser(u.id, change);
      setPage((p) => p && { ...p, items: p.items.map((x) => (x.id === updated.id ? updated : x)) });
      toast.push({ title: label, description: u.email, tone: "success" });
    } catch (err) {
      toast.push({ title: "Update failed", description: errMsg(err, "Couldn't update user."), tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const roleOptions = (page?.roles ?? ["USER", "RESEARCHER", "AGRICULTURAL_EXPERT", "ADMIN"]).map((r) => ({
    value: r,
    label: r,
  }));

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl">Users</h2>
      <div className="mt-5 grid items-end gap-4 sm:grid-cols-2">
        <Input label="Search" placeholder="Email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select
          label="Role"
          value={roleFilter}
          onChange={(v) => {
            setRoleFilter(v);
            setOffset(0);
          }}
          options={[{ value: "", label: "All roles" }, ...roleOptions]}
        />
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading && !page ? (
        <Rows n={5} />
      ) : !page || page.items.length === 0 ? (
        <EmptyState title="No users found" description="No users match the current search and role filter." />
      ) : (
        <div className={cn("mt-6 overflow-x-auto transition-opacity", loading && "opacity-60")}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal/15 text-xs uppercase tracking-[0.12em] text-charcoal/45">
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Last login</th>
                <th className="pb-3 text-right font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-b border-charcoal/8 align-middle">
                    <td className="py-3">
                      <p className="font-medium text-charcoal">{u.full_name}</p>
                      <p className="text-xs text-charcoal/50">{u.email}</p>
                    </td>
                    <td className="w-56 py-3 pr-4">
                      {/* Native select: the custom dropdown would be clipped by the scrolling table. */}
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        disabled={isSelf || busyId === u.id}
                        onChange={(e) => e.target.value !== u.role && void patch(u, { role: e.target.value }, `Role set to ${e.target.value}`)}
                        className="h-10 w-full rounded-md border border-charcoal/12 bg-white px-3 text-sm text-charcoal focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 disabled:opacity-60"
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "active" : "deactivated"}</Badge>
                    </td>
                    <td className="py-3 text-charcoal/55">{formatDate(u.last_login_at)}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.is_active}
                        aria-label={`${u.is_active ? "Deactivate" : "Activate"} ${u.email}`}
                        disabled={isSelf || busyId === u.id}
                        onClick={() =>
                          void patch(u, { is_active: !u.is_active }, u.is_active ? "User deactivated" : "User activated")
                        }
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/40 focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          u.is_active ? "bg-emerald" : "bg-charcoal/20"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                            u.is_active ? "translate-x-[22px]" : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager total={page.total} offset={offset} onChange={setOffset} />
        </div>
      )}
    </section>
  );
}

function AuditSection() {
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    if (rangeInvalid) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .adminAuditLogs({
        action,
        date_from: dateFrom,
        date_to: dateTo,
        limit: PAGE_SIZE,
        offset,
      })
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        setActions(p.actions);
      })
      .catch((err) => !cancelled && setError(errMsg(err, "Failed to load audit logs.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [action, dateFrom, dateTo, offset, reloadKey, rangeInvalid]);

  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl">Audit log</h2>
      <div className="mt-5 grid items-end gap-4 sm:grid-cols-3">
        <Select
          label="Action"
          value={action}
          onChange={(v) => {
            setAction(v);
            setOffset(0);
          }}
          options={[{ value: "", label: "All actions" }, ...actions.map((a) => ({ value: a, label: a }))]}
        />
        <Input
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setOffset(0);
          }}
          error={rangeInvalid ? "Start must be before end" : undefined}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setOffset(0);
          }}
        />
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading && !page ? (
        <Rows n={5} />
      ) : !page || page.items.length === 0 ? (
        <EmptyState title="No audit entries" description="No audit log entries match the current filters." />
      ) : (
        <div className={cn("mt-6 overflow-x-auto transition-opacity", loading && "opacity-60")}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal/15 text-xs uppercase tracking-[0.12em] text-charcoal/45">
                <th className="pb-3 font-semibold">When</th>
                <th className="pb-3 font-semibold">Actor</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Resource</th>
                <th className="pb-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((l) => (
                <tr key={l.id} className="border-b border-charcoal/8 align-top">
                  <td className="py-3 text-charcoal/55">{formatDate(l.created_at)}</td>
                  <td className="py-3 text-charcoal/70">{l.user_email || "system"}</td>
                  <td className="py-3">
                    <Badge tone="info">{l.action}</Badge>
                  </td>
                  <td className="py-3 text-charcoal/60">
                    {l.resource_type || "—"}
                    {l.resource_id && <span className="block text-xs text-charcoal/40">{l.resource_id.slice(0, 8)}</span>}
                  </td>
                  <td className="max-w-xs break-words py-3 font-mono text-xs text-charcoal/55">
                    {l.metadata && Object.keys(l.metadata).length > 0 ? JSON.stringify(l.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager total={page.total} offset={offset} onChange={setOffset} />
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <AppShell>
      <RoleGuard roles={["ADMIN"]}>
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <p className="eyebrow">Administration</p>
          <h1 className="mt-2 font-display text-4xl text-charcoal">Admin dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-charcoal/60">
            Manage user roles and access, and review every administrative change.
          </p>
        </motion.div>
        <UsersSection />
        <AuditSection />
      </RoleGuard>
    </AppShell>
  );
}
