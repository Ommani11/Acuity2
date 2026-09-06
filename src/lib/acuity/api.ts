import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isIsoDate, METRIC_KEYS, type MetricKey } from "./metrics";
import {
  MAX_OBSERVERS,
  type Bootstrap,
  type DailyLog,
  type ObserverLog,
  type PendingInvite,
  type ReportDay,
  type ReportPayload,
  type ReportTitration,
  type TitrationProfile,
} from "./types";
import {
  averageScores,
  eachIsoDate,
  scoresFromDaily,
  scoresFromObserver,
} from "./reports";

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length ? text : null;
}

function asNullableInt(value: unknown): number | null {
  if (value == null) return null;
  const n = asNumber(value);
  return Number.isFinite(n) ? n : null;
}

type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

async function getDb(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function ensureProfile(
  sql: Sql,
  userId: string,
): Promise<{ role: "primary" | "observer"; observesUserId: string | null }> {
  await sql`
    insert into profiles (user_id, role)
    values (${userId}, 'primary')
    on conflict (user_id) do nothing
  `;
  const rows = await sql<{
    role: "primary" | "observer";
    observes_user_id: string | null;
  }>`
    select role, observes_user_id from profiles where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Could not load profile");
  return { role: row.role, observesUserId: row.observes_user_id };
}

function mapTitration(row: {
  id: string;
  medication_name: string;
  dose_mg: unknown;
  daily_frequency: unknown;
  is_active: unknown;
  started_on: unknown;
}): TitrationProfile {
  return {
    id: row.id,
    medicationName: row.medication_name,
    doseMg: asNumber(row.dose_mg),
    dailyFrequency: asNumber(row.daily_frequency),
    isActive: asBool(row.is_active),
    startedOn: asString(row.started_on),
  };
}

function mapDailyLog(row: {
  id: string;
  log_date: unknown;
  titration_profile_id: string;
  executive_function: unknown;
  hyperactivity: unknown;
  mental_acuity: unknown;
  focus: unknown;
  mental_noise: unknown;
  sleep: unknown;
  crash: unknown;
  medication_taken: unknown;
  side_effects: unknown;
  notes: unknown;
}): DailyLog {
  return {
    id: row.id,
    logDate: asString(row.log_date),
    titrationProfileId: row.titration_profile_id,
    executiveFunction: asNumber(row.executive_function),
    hyperactivity: asNumber(row.hyperactivity),
    mentalAcuity: asNumber(row.mental_acuity),
    focus: asNumber(row.focus),
    mentalNoise: asNumber(row.mental_noise),
    sleep: asNumber(row.sleep),
    crash: asNumber(row.crash),
    medicationTaken: asBool(row.medication_taken),
    sideEffects: asNullableString(row.side_effects),
    notes: asNullableString(row.notes),
  };
}

function mapObserverLog(row: {
  id: string;
  log_date: unknown;
  titration_profile_id: string;
  executive_function: unknown;
  hyperactivity: unknown;
  mental_acuity: unknown;
  focus: unknown;
  mental_noise: unknown;
  sleep: unknown;
  crash: unknown;
  notes: unknown;
}): ObserverLog {
  return {
    id: row.id,
    logDate: asString(row.log_date),
    titrationProfileId: row.titration_profile_id,
    executiveFunction: asNullableInt(row.executive_function),
    hyperactivity: asNullableInt(row.hyperactivity),
    mentalAcuity: asNullableInt(row.mental_acuity),
    focus: asNullableInt(row.focus),
    mentalNoise: asNullableInt(row.mental_noise),
    sleep: asNullableInt(row.sleep),
    crash: asNullableInt(row.crash),
    notes: asNullableString(row.notes),
  };
}

function requireScore(value: unknown, label: string): number {
  const n = asNumber(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error(`${label} must be a whole number from 1 to 5`);
  }
  return n;
}

function optionalScore(value: unknown, label: string): number | null {
  if (value == null) return null;
  return requireScore(value, label);
}

function requireLogDate(value: unknown): string {
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error("Choose a valid date");
  }
  const utcMidnight = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) throw new Error("Choose a valid date");
  const now = Date.now();
  if (utcMidnight - now > 36 * 60 * 60 * 1000) {
    throw new Error("You cannot log a future day");
  }
  if (now - utcMidnight > 16 * 24 * 60 * 60 * 1000) {
    throw new Error("You can only log the last 14 days");
  }
  return value;
}

function newId(): string {
  return crypto.randomUUID();
}

export const getBootstrap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { today: string }) => data)
  .handler(async ({ context, data }): Promise<Bootstrap> => {
    const today = requireLogDate(data.today);
    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);

    const selfRows = await sql<{ name: string | null; email: string }>`
      select name, email from "user" where id = ${context.userId}
    `;
    const displayName =
      selfRows[0]?.name?.trim() || selfRows[0]?.email || "You";

    let activeTitration: TitrationProfile | null = null;
    let subject: Bootstrap["subject"] = null;
    let observers: Bootstrap["observers"] = [];
    let pendingInvite: PendingInvite | null = null;
    let todayLog: DailyLog | null = null;
    let todayObservation: ObserverLog | null = null;

    if (profile.role === "observer") {
      const subjectId = profile.observesUserId;
      if (!subjectId) throw new Error("Observer is not linked to a subject");

      const subjectRows = await sql<{ id: string; name: string | null; email: string }>`
        select u.id, u.name, u.email
        from "user" u
        where u.id = ${subjectId}
      `;
      const subjectRow = subjectRows[0];
      subject = {
        userId: subjectId,
        displayName: subjectRow?.name?.trim() || subjectRow?.email || "Your partner",
      };

      const titrationRows = await sql<{
        id: string;
        medication_name: string;
        dose_mg: unknown;
        daily_frequency: unknown;
        is_active: unknown;
        started_on: unknown;
      }>`
        select id, medication_name, dose_mg, daily_frequency, is_active, started_on
        from titration_profiles
        where user_id = ${subjectId} and is_active = true
        limit 1
      `;
      activeTitration = titrationRows[0] ? mapTitration(titrationRows[0]) : null;

      const observationRows = await sql<{
        id: string;
        log_date: unknown;
        titration_profile_id: string;
        executive_function: unknown;
        hyperactivity: unknown;
        mental_acuity: unknown;
        focus: unknown;
        mental_noise: unknown;
        sleep: unknown;
        crash: unknown;
        notes: unknown;
      }>`
        select id, log_date, titration_profile_id, executive_function, hyperactivity,
               mental_acuity, focus, mental_noise, sleep, crash, notes
        from observer_logs
        where observer_user_id = ${context.userId}
          and subject_user_id = ${subjectId}
          and log_date = ${today}
        limit 1
      `;
      todayObservation = observationRows[0]
        ? mapObserverLog(observationRows[0])
        : null;
    } else {
      const titrationRows = await sql<{
        id: string;
        medication_name: string;
        dose_mg: unknown;
        daily_frequency: unknown;
        is_active: unknown;
        started_on: unknown;
      }>`
        select id, medication_name, dose_mg, daily_frequency, is_active, started_on
        from titration_profiles
        where user_id = ${context.userId} and is_active = true
        limit 1
      `;
      activeTitration = titrationRows[0] ? mapTitration(titrationRows[0]) : null;

      const observerRows = await sql<{ id: string; name: string | null; email: string }>`
        select u.id, u.name, u.email
        from profiles p
        join "user" u on u.id = p.user_id
        where p.role = 'observer' and p.observes_user_id = ${context.userId}
        order by p.created_at asc
      `;
      observers = observerRows.map((row) => ({
        userId: row.id,
        displayName: row.name?.trim() || row.email || "Observer",
      }));

      const inviteRows = await sql<{ token: string; expires_at: unknown }>`
        select token, expires_at
        from observer_invitations
        where primary_user_id = ${context.userId}
          and accepted_at is null
          and expires_at > now()
        order by created_at desc
        limit 1
      `;
      if (inviteRows[0]) {
        pendingInvite = {
          token: inviteRows[0].token,
          expiresAt: asString(inviteRows[0].expires_at),
        };
      }

      const logRows = await sql<{
        id: string;
        log_date: unknown;
        titration_profile_id: string;
        executive_function: unknown;
        hyperactivity: unknown;
        mental_acuity: unknown;
        focus: unknown;
        mental_noise: unknown;
        sleep: unknown;
        crash: unknown;
        medication_taken: unknown;
        side_effects: unknown;
        notes: unknown;
      }>`
        select id, log_date, titration_profile_id, executive_function, hyperactivity,
               mental_acuity, focus, mental_noise, sleep, crash, medication_taken,
               side_effects, notes
        from daily_logs
        where user_id = ${context.userId} and log_date = ${today}
        limit 1
      `;
      todayLog = logRows[0] ? mapDailyLog(logRows[0]) : null;
    }

    return {
      role: profile.role,
      userId: context.userId,
      displayName,
      activeTitration,
      subject,
      observers,
      pendingInvite,
      todayLog,
      todayObservation,
    };
  });

function requireRangeDate(value: unknown): string {
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error("Choose a valid date");
  }
  return value;
}

export const getReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { from: string; to: string }) => data)
  .handler(async ({ context, data }): Promise<ReportPayload> => {
    const from = requireRangeDate(data.from);
    const to = requireRangeDate(data.to);
    if (from > to) throw new Error("The start date must be before the end date");
    const span = eachIsoDate(from, to);
    if (span.length > 120) throw new Error("Choose a shorter range");

    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    const canSeeSelf = profile.role === "primary";
    const subjectId =
      profile.role === "observer" ? profile.observesUserId : context.userId;
    if (!subjectId) throw new Error("Observer is not linked to a subject");

    const titrationRows = await sql<{
      id: string;
      medication_name: string;
      dose_mg: unknown;
      daily_frequency: unknown;
      is_active: unknown;
      started_on: unknown;
      ended_on: unknown;
    }>`
      select id, medication_name, dose_mg, daily_frequency, is_active, started_on, ended_on
      from titration_profiles
      where user_id = ${subjectId}
      order by started_on desc, created_at desc
    `;
    const titrations: ReportTitration[] = titrationRows.map((row) => ({
      ...mapTitration(row),
      endedOn: asNullableString(row.ended_on),
    }));

    const dailyByDate = new Map<string, DailyLog>();
    if (canSeeSelf) {
      const dailyRows = await sql<{
        id: string;
        log_date: unknown;
        titration_profile_id: string;
        executive_function: unknown;
        hyperactivity: unknown;
        mental_acuity: unknown;
        focus: unknown;
        mental_noise: unknown;
        sleep: unknown;
        crash: unknown;
        medication_taken: unknown;
        side_effects: unknown;
        notes: unknown;
      }>`
        select id, log_date, titration_profile_id, executive_function, hyperactivity,
               mental_acuity, focus, mental_noise, sleep, crash, medication_taken,
               side_effects, notes
        from daily_logs
        where user_id = ${context.userId}
          and log_date >= ${from}
          and log_date <= ${to}
        order by log_date asc
      `;
      for (const row of dailyRows) {
        const log = mapDailyLog(row);
        dailyByDate.set(log.logDate, log);
      }
    }

    const observerRows = await sql<{
      id: string;
      log_date: unknown;
      titration_profile_id: string;
      executive_function: unknown;
      hyperactivity: unknown;
      mental_acuity: unknown;
      focus: unknown;
      mental_noise: unknown;
      sleep: unknown;
      crash: unknown;
      notes: unknown;
      observer_name: string | null;
      observer_email: string;
    }>`
      select o.id, o.log_date, o.titration_profile_id, o.executive_function, o.hyperactivity,
             o.mental_acuity, o.focus, o.mental_noise, o.sleep, o.crash, o.notes,
             u.name as observer_name, u.email as observer_email
      from observer_logs o
      join "user" u on u.id = o.observer_user_id
      where o.subject_user_id = ${subjectId}
        and o.log_date >= ${from}
        and o.log_date <= ${to}
        and (${canSeeSelf} or o.observer_user_id = ${context.userId})
      order by o.log_date asc
    `;
    const observersByDate = new Map<
      string,
      Array<{ log: ObserverLog; name: string }>
    >();
    for (const row of observerRows) {
      const log = mapObserverLog(row);
      const name = row.observer_name?.trim() || row.observer_email || "Observer";
      const list = observersByDate.get(log.logDate) ?? [];
      list.push({ log, name });
      observersByDate.set(log.logDate, list);
    }

    const days: ReportDay[] = span.map((logDate) => {
      const selfLog = dailyByDate.get(logDate) ?? null;
      const observerLogs = observersByDate.get(logDate) ?? [];
      return {
        logDate,
        self: selfLog ? scoresFromDaily(selfLog) : null,
        observed: averageScores(observerLogs.map((item) => scoresFromObserver(item.log))),
        observerCount: observerLogs.length,
        titrationId: selfLog?.titrationProfileId ?? observerLogs[0]?.log.titrationProfileId ?? null,
        sideEffects: canSeeSelf ? selfLog?.sideEffects ?? null : null,
        selfNotes: canSeeSelf ? selfLog?.notes ?? null : null,
        medicationTaken: canSeeSelf ? (selfLog ? selfLog.medicationTaken : null) : null,
        observers: observerLogs.map((item) => ({
          observerName: item.name,
          scores: scoresFromObserver(item.log),
          notes: item.log.notes,
        })),
      };
    });

    return {
      role: profile.role,
      canSeeSelf,
      from,
      to,
      days,
      titrations,
    };
  });

export const getDailyLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { logDate: string }) => data)
  .handler(async ({ context, data }): Promise<DailyLog | null> => {
    const logDate = requireLogDate(data.logDate);
    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "primary") {
      throw new Error("Only the person taking medication can open self-reports");
    }
    const rows = await sql<{
      id: string;
      log_date: unknown;
      titration_profile_id: string;
      executive_function: unknown;
      hyperactivity: unknown;
      mental_acuity: unknown;
      focus: unknown;
      mental_noise: unknown;
      sleep: unknown;
      crash: unknown;
      medication_taken: unknown;
      side_effects: unknown;
      notes: unknown;
    }>`
      select id, log_date, titration_profile_id, executive_function, hyperactivity,
             mental_acuity, focus, mental_noise, sleep, crash, medication_taken,
             side_effects, notes
      from daily_logs
      where user_id = ${context.userId} and log_date = ${logDate}
      limit 1
    `;
    return rows[0] ? mapDailyLog(rows[0]) : null;
  });

export const getObserverLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { logDate: string }) => data)
  .handler(async ({ context, data }): Promise<ObserverLog | null> => {
    const logDate = requireLogDate(data.logDate);
    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "observer" || !profile.observesUserId) {
      throw new Error("Only a designated observer can record observations");
    }
    const rows = await sql<{
      id: string;
      log_date: unknown;
      titration_profile_id: string;
      executive_function: unknown;
      hyperactivity: unknown;
      mental_acuity: unknown;
      focus: unknown;
      mental_noise: unknown;
      sleep: unknown;
      crash: unknown;
      notes: unknown;
    }>`
      select id, log_date, titration_profile_id, executive_function, hyperactivity,
             mental_acuity, focus, mental_noise, sleep, crash, notes
      from observer_logs
      where observer_user_id = ${context.userId}
        and subject_user_id = ${profile.observesUserId}
        and log_date = ${logDate}
      limit 1
    `;
    return rows[0] ? mapObserverLog(rows[0]) : null;
  });

export type SaveTitrationInput = {
  medicationName: string;
  doseMg: number;
  dailyFrequency: number;
};

export const saveTitrationProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: SaveTitrationInput) => data)
  .handler(async ({ context, data }): Promise<TitrationProfile> => {
    const name = data.medicationName?.trim();
    if (!name) throw new Error("Enter a medication name");
    if (name.length > 80) throw new Error("Medication name is too long");
    const doseMg = asNumber(data.doseMg);
    const dailyFrequency = asNumber(data.dailyFrequency);
    if (!Number.isFinite(doseMg) || doseMg <= 0) {
      throw new Error("Dose must be greater than 0 mg");
    }
    if (!Number.isFinite(dailyFrequency) || dailyFrequency <= 0) {
      throw new Error("Daily frequency must be greater than 0");
    }

    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "primary") {
      throw new Error("Observers cannot change the titration profile");
    }

    await sql`
      update titration_profiles
      set is_active = false, ended_on = current_date
      where user_id = ${context.userId} and is_active = true
    `;

    const id = newId();
    const rows = await sql<{
      id: string;
      medication_name: string;
      dose_mg: unknown;
      daily_frequency: unknown;
      is_active: unknown;
      started_on: unknown;
    }>`
      insert into titration_profiles (
        id, user_id, medication_name, dose_mg, daily_frequency, is_active, started_on
      ) values (
        ${id}, ${context.userId}, ${name}, ${doseMg}, ${dailyFrequency}, true, current_date
      )
      returning id, medication_name, dose_mg, daily_frequency, is_active, started_on
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not save titration profile");
    return mapTitration(row);
  });

export type SaveDailyLogInput = {
  logDate: string;
  executiveFunction: number;
  hyperactivity: number;
  mentalAcuity: number;
  focus: number;
  mentalNoise: number;
  sleep: number;
  crash: number;
  medicationTaken: boolean;
  sideEffects: string;
  notes: string;
};

export const saveDailyLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: SaveDailyLogInput) => data)
  .handler(async ({ context, data }): Promise<DailyLog> => {
    const logDate = requireLogDate(data.logDate);
    const scores = {
      executive_function: requireScore(data.executiveFunction, "Executive function"),
      hyperactivity: requireScore(data.hyperactivity, "Hyperactivity"),
      mental_acuity: requireScore(data.mentalAcuity, "Mental acuity"),
      focus: requireScore(data.focus, "Focus"),
      mental_noise: requireScore(data.mentalNoise, "Mental noise"),
      sleep: requireScore(data.sleep, "Sleep"),
      crash: requireScore(data.crash, "Crash"),
    };
    const sideEffects = data.sideEffects?.trim() || null;
    const notes = data.notes?.trim() || null;
    const medicationTaken = Boolean(data.medicationTaken);

    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "primary") {
      throw new Error("Only the person taking medication can save a self-report");
    }

    const titrationRows = await sql<{ id: string }>`
      select id from titration_profiles
      where user_id = ${context.userId} and is_active = true
      limit 1
    `;
    const titrationId = titrationRows[0]?.id;
    if (!titrationId) {
      throw new Error("Set an active titration profile before logging a day");
    }

    const id = newId();
    const rows = await sql<{
      id: string;
      log_date: unknown;
      titration_profile_id: string;
      executive_function: unknown;
      hyperactivity: unknown;
      mental_acuity: unknown;
      focus: unknown;
      mental_noise: unknown;
      sleep: unknown;
      crash: unknown;
      medication_taken: unknown;
      side_effects: unknown;
      notes: unknown;
    }>`
      insert into daily_logs (
        id, user_id, titration_profile_id, log_date,
        executive_function, hyperactivity, mental_acuity, focus,
        mental_noise, sleep, crash, medication_taken, side_effects, notes
      ) values (
        ${id}, ${context.userId}, ${titrationId}, ${logDate},
        ${scores.executive_function}, ${scores.hyperactivity}, ${scores.mental_acuity},
        ${scores.focus}, ${scores.mental_noise}, ${scores.sleep}, ${scores.crash},
        ${medicationTaken}, ${sideEffects}, ${notes}
      )
      on conflict (user_id, log_date) do update set
        titration_profile_id = excluded.titration_profile_id,
        executive_function = excluded.executive_function,
        hyperactivity = excluded.hyperactivity,
        mental_acuity = excluded.mental_acuity,
        focus = excluded.focus,
        mental_noise = excluded.mental_noise,
        sleep = excluded.sleep,
        crash = excluded.crash,
        medication_taken = excluded.medication_taken,
        side_effects = excluded.side_effects,
        notes = excluded.notes,
        updated_at = now()
      returning id, log_date, titration_profile_id, executive_function, hyperactivity,
                mental_acuity, focus, mental_noise, sleep, crash, medication_taken,
                side_effects, notes
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not save the check-in");
    return mapDailyLog(row);
  });

export type SaveObserverLogInput = {
  logDate: string;
  scores: Partial<Record<MetricKey, number | null>>;
  notes: string;
};

export const saveObserverLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: SaveObserverLogInput) => data)
  .handler(async ({ context, data }): Promise<ObserverLog> => {
    const logDate = requireLogDate(data.logDate);
    const scores: Record<MetricKey, number | null> = {
      executive_function: null,
      hyperactivity: null,
      mental_acuity: null,
      focus: null,
      mental_noise: null,
      sleep: null,
      crash: null,
    };
    for (const key of METRIC_KEYS) {
      scores[key] = optionalScore(data.scores?.[key], key.replaceAll("_", " "));
    }
    scores.mental_noise = null;
    scores.sleep = null;
    scores.crash = null;
    const notes = data.notes?.trim() || null;
    const hasScore = METRIC_KEYS.some((key) => scores[key] != null);
    if (!hasScore && !notes) {
      throw new Error("Rate at least one scale, or leave a note on what you saw");
    }

    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "observer" || !profile.observesUserId) {
      throw new Error("Only a designated observer can save observations");
    }
    const subjectId = profile.observesUserId;

    const titrationRows = await sql<{ id: string }>`
      select id from titration_profiles
      where user_id = ${subjectId} and is_active = true
      limit 1
    `;
    const titrationId = titrationRows[0]?.id;
    if (!titrationId) {
      throw new Error("Your partner has not set an active medication yet");
    }

    const id = newId();
    const rows = await sql<{
      id: string;
      log_date: unknown;
      titration_profile_id: string;
      executive_function: unknown;
      hyperactivity: unknown;
      mental_acuity: unknown;
      focus: unknown;
      mental_noise: unknown;
      sleep: unknown;
      crash: unknown;
      notes: unknown;
    }>`
      insert into observer_logs (
        id, observer_user_id, subject_user_id, titration_profile_id, log_date,
        executive_function, hyperactivity, mental_acuity, focus,
        mental_noise, sleep, crash, notes
      ) values (
        ${id}, ${context.userId}, ${subjectId}, ${titrationId}, ${logDate},
        ${scores.executive_function}, ${scores.hyperactivity}, ${scores.mental_acuity},
        ${scores.focus}, ${scores.mental_noise}, ${scores.sleep}, ${scores.crash},
        ${notes}
      )
      on conflict (observer_user_id, subject_user_id, log_date) do update set
        titration_profile_id = excluded.titration_profile_id,
        executive_function = excluded.executive_function,
        hyperactivity = excluded.hyperactivity,
        mental_acuity = excluded.mental_acuity,
        focus = excluded.focus,
        mental_noise = excluded.mental_noise,
        sleep = excluded.sleep,
        crash = excluded.crash,
        notes = excluded.notes,
        updated_at = now()
      returning id, log_date, titration_profile_id, executive_function, hyperactivity,
                mental_acuity, focus, mental_noise, sleep, crash, notes
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not save the observation");
    return mapObserverLog(row);
  });

export const createObserverInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PendingInvite> => {
    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "primary") {
      throw new Error("Only the primary user can invite an observer");
    }

    const existingObservers = await sql<{ n: number }>`
      select count(*)::int as n from profiles
      where role = 'observer' and observes_user_id = ${context.userId}
    `;
    if ((existingObservers[0]?.n ?? 0) >= MAX_OBSERVERS) {
      throw new Error(`You can invite up to ${MAX_OBSERVERS} observers`);
    }

    await sql`
      delete from observer_invitations
      where primary_user_id = ${context.userId} and accepted_at is null
    `;

    const token = crypto.randomUUID().replaceAll("-", "");
    const id = newId();
    const rows = await sql<{ token: string; expires_at: unknown }>`
      insert into observer_invitations (id, primary_user_id, token, expires_at)
      values (${id}, ${context.userId}, ${token}, now() + interval '14 days')
      returning token, expires_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Could not create an invite");
    return { token: row.token, expiresAt: asString(row.expires_at) };
  });

export const previewObserverInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { token: string }) => data)
  .handler(async ({ context, data }) => {
    const token = data.token?.trim();
    if (!token) throw new Error("Missing invite token");
    const sql = await getDb();
    await ensureProfile(sql, context.userId);

    const rows = await sql<{
      primary_user_id: string;
      accepted_at: unknown;
      expires_at: unknown;
      name: string | null;
      email: string;
    }>`
      select i.primary_user_id, i.accepted_at, i.expires_at, u.name, u.email
      from observer_invitations i
      join "user" u on u.id = i.primary_user_id
      where i.token = ${token}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("This invite link is not valid");
    if (row.accepted_at) throw new Error("This invite has already been used");
    if (new Date(asString(row.expires_at)).getTime() < Date.now()) {
      throw new Error("This invite has expired");
    }
    if (row.primary_user_id === context.userId) {
      throw new Error("You cannot accept your own invite");
    }
    return {
      primaryUserId: row.primary_user_id,
      displayName: row.name?.trim() || row.email,
    };
  });

export const acceptObserverInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { token: string }) => data)
  .handler(async ({ context, data }) => {
    const token = data.token?.trim();
    if (!token) throw new Error("Missing invite token");
    const sql = await getDb();
    const profile = await ensureProfile(sql, context.userId);

    const inviteRows = await sql<{
      id: string;
      primary_user_id: string;
      accepted_at: unknown;
      expires_at: unknown;
    }>`
      select id, primary_user_id, accepted_at, expires_at
      from observer_invitations
      where token = ${token}
      limit 1
    `;
    const invite = inviteRows[0];
    if (!invite) throw new Error("This invite link is not valid");
    if (invite.accepted_at) throw new Error("This invite has already been used");
    if (new Date(asString(invite.expires_at)).getTime() < Date.now()) {
      throw new Error("This invite has expired");
    }
    if (invite.primary_user_id === context.userId) {
      throw new Error("You cannot accept your own invite");
    }
    if (profile.role === "observer") {
      throw new Error("This account is already an observer");
    }

    const ownLogs = await sql<{ n: number }>`
      select count(*)::int as n from daily_logs where user_id = ${context.userId}
    `;
    const ownProfiles = await sql<{ n: number }>`
      select count(*)::int as n from titration_profiles where user_id = ${context.userId}
    `;
    if ((ownLogs[0]?.n ?? 0) > 0 || (ownProfiles[0]?.n ?? 0) > 0) {
      throw new Error(
        "This account already has check-in data. Sign in with a different Google account to join as an observer.",
      );
    }

    const taken = await sql<{ n: number }>`
      select count(*)::int as n from profiles
      where role = 'observer' and observes_user_id = ${invite.primary_user_id}
    `;
    if ((taken[0]?.n ?? 0) >= MAX_OBSERVERS) {
      throw new Error("This person already has the maximum number of observers");
    }

    await sql`
      update profiles
      set role = 'observer',
          observes_user_id = ${invite.primary_user_id},
          updated_at = now()
      where user_id = ${context.userId}
    `;
    await sql`
      update observer_invitations
      set accepted_at = now(), accepted_by_user_id = ${context.userId}
      where id = ${invite.id}
    `;

    return { ok: true as const };
  });
