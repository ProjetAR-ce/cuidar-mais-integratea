"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, ClipboardList, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleDialog } from "@/components/care/schedule-dialog";
import { ReferralDialog } from "@/components/care/referral-dialog";
import type { PickedPatient } from "@/components/care/patient-picker";
import { can } from "@/lib/auth/permissions";
import type { Offer, StaffMember } from "@/lib/data/reference";
import type { Role, Service, Specialty } from "@/types/domain";

export function PatientActions({
  patient, role, userServiceId, services, specialties, offers, staff,
}: { patient: PickedPatient; role: Role; userServiceId: string | null; services: Service[]; specialties: Specialty[]; offers: Offer[]; staff: StaffMember[] }) {
  const [schedule, setSchedule] = React.useState(false);
  const [referral, setReferral] = React.useState(false);
  const defaults = React.useMemo(() => ({ patient, service_id: userServiceId }), [patient, userServiceId]);

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      {can(role, "triage.create") && (
        <Button asChild variant="peach" className="flex-1 sm:flex-none"><Link href={`/triagem?paciente=${patient.id}`}><ClipboardList /> Triar</Link></Button>
      )}
      {can(role, "agenda.manage") && (
        <Button variant="mint" className="flex-1 sm:flex-none" onClick={() => setSchedule(true)}><CalendarPlus /> Agendar</Button>
      )}
      {can(role, "referrals.manage") && (
        <Button variant="lilac" className="flex-1 sm:flex-none" onClick={() => setReferral(true)}><Send /> Encaminhar</Button>
      )}
      <ScheduleDialog open={schedule} onOpenChange={setSchedule} defaults={defaults} services={services} specialties={specialties} offers={offers} staff={staff} />
      <ReferralDialog open={referral} onOpenChange={setReferral} patient={patient} services={services} specialties={specialties} offers={offers} originServiceId={userServiceId} lockOrigin={role === "profissional"} />
    </div>
  );
}
