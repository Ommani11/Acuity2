import type { MetricKey } from "./metrics";

export type UserRole = "primary" | "observer";

export const MAX_OBSERVERS = 8;

export type TitrationProfile = {
  id: string;
  medicationName: string;
  doseMg: number;
  dailyFrequency: number;
  isActive: boolean;
  startedOn: string;
};

export type DailyLog = {
  id: string;
  logDate: string;
  titrationProfileId: string;
  executiveFunction: number;
  hyperactivity: number;
  mentalAcuity: number;
  focus: number;
  mentalNoise: number;
  sleep: number;
  crash: number;
  medicationTaken: boolean;
  sideEffects: string | null;
  notes: string | null;
};

export type ObserverLog = {
  id: string;
  logDate: string;
  titrationProfileId: string;
  executiveFunction: number | null;
  hyperactivity: number | null;
  mentalAcuity: number | null;
  focus: number | null;
  mentalNoise: number | null;
  sleep: number | null;
  crash: number | null;
  notes: string | null;
};

export type LinkedPerson = {
  userId: string;
  displayName: string;
};

export type PendingInvite = {
  token: string;
  expiresAt: string;
};

export type Bootstrap = {
  role: UserRole;
  userId: string;
  displayName: string;
  activeTitration: TitrationProfile | null;
  subject: LinkedPerson | null;
  observers: LinkedPerson[];
  pendingInvite: PendingInvite | null;
  todayLog: DailyLog | null;
  todayObservation: ObserverLog | null;
};

export type ReportRangeDays = 7 | 14 | 28 | 90;

export type ReportTitration = TitrationProfile & {
  endedOn: string | null;
};

export type ReportObserverEntry = {
  observerName: string;
  scores: Record<MetricKey, number | null>;
  notes: string | null;
};

export type ReportDay = {
  logDate: string;
  self: Record<MetricKey, number> | null;
  observed: Record<MetricKey, number | null> | null;
  observerCount: number;
  titrationId: string | null;
  sideEffects: string | null;
  selfNotes: string | null;
  medicationTaken: boolean | null;
  observers: ReportObserverEntry[];
};

export type ReportPayload = {
  role: UserRole;
  canSeeSelf: boolean;
  from: string;
  to: string;
  days: ReportDay[];
  titrations: ReportTitration[];
};

export type MetricScores = Record<MetricKey, number>;
export type OptionalMetricScores = Record<MetricKey, number | null>;
