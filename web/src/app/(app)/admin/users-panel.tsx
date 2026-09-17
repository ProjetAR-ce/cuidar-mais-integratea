"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { createUser, updateUser } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ServiceChip } from "@/components/care/service-chip";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, type Role, type Service, type Specialty } from "@/types/domain";

export type UserRow = { id: string; full_name: string; email: string | null; role: Role; service_id: string | null; specialty_id: string | null; job_title: string | null; active: boolean; created_at: string };

const ROLES: Role[] = ["recepcao", "profissional", "coordenacao", "gestao", "admin", "responsavel"];

export function UsersPanel({ users, services, specialties, currentUserId }: { users: UserRow[]; services: Service[]; specialties: Specialty[]; currentUserId: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState("todos");
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const svc = Object.fromEntries(services.map((s) => [s.id, s]));
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const list = users.filter((u) => (role === "todos" || u.role === role) && (!q || norm(`${u.full_name} ${u.email}`).includes(norm(q))));

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-60 flex-1">
          <label htmlFor="u-q" className="sr-only">Buscar usuário</label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-12" />
        </div>
        <Field label="Perfil" htmlFor="u-role" className="w-48">
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="todos">Todos</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Button variant="mint" onClick={() => setCreating(true)}><UserPlus /> Novo usuário</Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">Usuários do sistema</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-caption font-bold tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">Usuário</th>
                <th scope="col" className="px-3 py-3">Perfil</th>
                <th scope="col" className="px-3 py-3">Serviço</th>
                <th scope="col" className="px-3 py-3">Situação</th>
                <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink-strong">{u.full_name}{u.id === currentUserId && <span className="ml-1 text-caption text-ink-muted">(você)</span>}</p>
                        <p className="truncate text-caption text-ink-muted">{u.email} · {u.job_title ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Badge tone={u.role === "admin" ? "rose" : u.role === "gestao" ? "sun" : u.role === "coordenacao" ? "lilac" : u.role === "profissional" ? "mint" : u.role === "recepcao" ? "peach" : "ink"} size="sm">{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="px-3 py-3">{u.service_id && svc[u.service_id] ? <ServiceChip name={svc[u.service_id].name} color={svc[u.service_id].color} size="sm" /> : <span className="text-caption text-ink-muted">Rede toda</span>}</td>
                  <td className="px-3 py-3">{u.active ? <Badge tone="mint" size="sm">Ativo</Badge> : <Badge tone="ink" size="sm">Inativo</Badge>}</td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Editar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-caption text-ink-muted">{list.length} de {users.length} usuários · desde {users.length ? fmtDate(users.map((u) => u.created_at).sort()[0]) : "—"}</p>
      </Card>

      <UserDialog
        open={creating || !!editing}
        user={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        services={services}
        specialties={specialties}
        onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
      />
    </>
  );
}

function UserDialog({ open, user, onClose, services, specialties, onSaved }: { open: boolean; user: UserRow | null; onClose: () => void; services: Service[]; specialties: Specialty[]; onSaved: () => void }) {
  const [f, setF] = React.useState({ full_name: "", email: "", password: "", role: "profissional" as Role, service_id: "", specialty_id: "", job_title: "", active: true });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [prev, setPrev] = React.useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  if (open !== prev.open || user !== prev.user) {
    setPrev({ open, user });
    if (open) {
    setError(null);
    setF(user
      ? { full_name: user.full_name, email: user.email ?? "", password: "", role: user.role, service_id: user.service_id ?? "", specialty_id: user.specialty_id ?? "", job_title: user.job_title ?? "", active: user.active }
      : { full_name: "", email: "", password: "", role: "profissional", service_id: "", specialty_id: "", job_title: "", active: true });
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const r = user
      ? await updateUser(user.id, { full_name: f.full_name, role: f.role, service_id: f.service_id || null, specialty_id: f.specialty_id || null, job_title: f.job_title || null, active: f.active })
      : await createUser({ full_name: f.full_name, email: f.email, password: f.password, role: f.role, service_id: f.service_id || null, specialty_id: f.specialty_id || null, job_title: f.job_title });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    toast.success(user ? "Usuário atualizado" : "Usuário criado", { description: user ? "A alteração foi registrada na auditoria." : "Envie a senha provisória por um canal seguro." });
    onSaved();
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={user ? "Editar usuário" : "Novo usuário"} description="Cada pessoa vê apenas o necessário para a sua função e o seu serviço."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="mint" loading={saving} onClick={save}>Salvar</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Nome completo" htmlFor="uf-name" required><Input id="uf-name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="E-mail" htmlFor="uf-email" required><Input id="uf-email" type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        {!user && <Field label="Senha provisória" htmlFor="uf-pass" required hint="Mínimo de 8 caracteres."><Input id="uf-pass" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>}
        <Field label="Perfil" htmlFor="uf-role" required>
          <Select id="uf-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Serviço" htmlFor="uf-service" hint="Coordenação, gestão e admin podem atuar na rede toda.">
          <Select id="uf-service" value={f.service_id} onChange={(e) => setF({ ...f, service_id: e.target.value })}>
            <option value="">Rede toda</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Especialidade" htmlFor="uf-sp">
          <Select id="uf-sp" value={f.specialty_id} onChange={(e) => setF({ ...f, specialty_id: e.target.value })}>
            <option value="">—</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Cargo" htmlFor="uf-job"><Input id="uf-job" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></Field>
        {user && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 p-4 sm:col-span-2">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-5 accent-[var(--color-ink)]" />
            <span><span className="block font-semibold text-ink-strong">Acesso ativo</span><span className="block text-footnote text-ink-muted">Desativar bloqueia o login imediatamente. O histórico é mantido.</span></span>
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-4 py-3 text-callout font-semibold text-rose-ink">{error}</p>}
    </Modal>
  );
}
