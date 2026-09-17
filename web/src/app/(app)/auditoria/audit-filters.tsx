"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/form";

export function AuditFilters({ from, to, action, user, users }: { from: string; to: string; action: string; user: string; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ de: from, ate: to, acao: action, usuario: user });
  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <Field label="De" htmlFor="au-de" className="w-40"><Input id="au-de" type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></Field>
      <Field label="Até" htmlFor="au-ate" className="w-40"><Input id="au-ate" type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></Field>
      <Field label="Tipo" htmlFor="au-acao" className="w-52">
        <Select id="au-acao" value={f.acao} onChange={(e) => setF({ ...f, acao: e.target.value })}>
          <option value="todas">Todas</option>
          <option value="sensiveis">Sensíveis (consulta, exportação, fusão, acesso negado)</option>
          <option value="alteracoes">Alterações</option>
          <option value="criacoes">Criações</option>
          <option value="acessos">Entradas e saídas</option>
          <option value="buscas">Buscas de paciente</option>
        </Select>
      </Field>
      <Field label="Usuário" htmlFor="au-user" className="min-w-52 flex-1">
        <Select id="au-user" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })}>
          <option value="todos">Todos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <Button onClick={() => router.push(`/auditoria?${new URLSearchParams({ ...f, pagina: "1" })}`)}>Filtrar</Button>
    </Card>
  );
}
