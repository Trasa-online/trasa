// Ustawienia lokalu: konto, haslo, zgody mailowe, zgloszenie problemu i usuniecie konta.
//
// Prosba Nat z briefu: „ustawienia ze zmiana hasla, zgloszeniem problemu". Do dzis jedno
// i drugie siedzialo w bocznym pasku pod ikonkami, a zmiana hasla znaczyla „wyslij sobie
// maila z linkiem" - teraz haslo zmienia sie na miejscu.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { BizCard, BizCardTitle } from "./BizCard";

export interface NotificationPrefs {
  newNote: boolean;
  weeklyDigest: boolean;
  news: boolean;
}

export interface SettingsSectionProps {
  email: string;
  planLabel: string;
  planHint: string;
  isPremium: boolean;
  prefs: NotificationPrefs;
  onPrefsChange: (patch: Partial<NotificationPrefs>) => void;
  /** Zmiana hasla na miejscu. Zwraca komunikat bledu albo null, gdy sie udalo. */
  onChangePassword: (current: string, next: string) => Promise<string | null>;
  onForgotPassword: () => void;
  forgotPending: boolean;
  onSubmitReport: (topic: string, message: string) => Promise<boolean>;
  onUpgrade: () => void;
  onSupport: () => void;
  /** Istniejacy komponent usuwania konta - sekcja tylko go osadza. */
  deleteAccount: ReactNode;
}

const TOPICS = ["listing", "menu", "events", "account", "other"] as const;

export function SettingsSection(props: SettingsSectionProps) {
  const { t } = useTranslation("bizdash");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const savePassword = async () => {
    setPwError(null);
    setPwDone(false);
    if (next.length < 8 || !/\d/.test(next)) { setPwError(t("settings.pw_rule")); return; }
    if (next !== repeat) { setPwError(t("settings.pw_mismatch")); return; }
    setPwBusy(true);
    const err = await props.onChangePassword(current, next);
    setPwBusy(false);
    if (err) { setPwError(err); return; }
    setCurrent(""); setNext(""); setRepeat(""); setPwDone(true);
  };

  const sendReport = async () => {
    if (!message.trim()) return;
    setReportBusy(true);
    const ok = await props.onSubmitReport(t(`settings.topics.${topic}`), message.trim());
    setReportBusy(false);
    if (ok) setMessage("");
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
      <div className="flex flex-col gap-4">
        <BizCard>
          <BizCardTitle title={t("settings.account_title")} />
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-slate-900">{props.email || "-"}</p>
              <p className="text-[12px] text-slate-500">{t("settings.account_hint")}</p>
            </div>
            <button
              type="button"
              onClick={props.onSupport}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
            >
              {t("settings.account_change")}
            </button>
          </div>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("settings.pw_title")} hint={t("settings.pw_hint")} />
          <div className="flex flex-col gap-3">
            <Labeled label={t("settings.pw_current")}>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={INPUT} autoComplete="current-password" />
            </Labeled>
            <Labeled label={t("settings.pw_new")}>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={INPUT} autoComplete="new-password" />
            </Labeled>
            <Labeled label={t("settings.pw_repeat")}>
              <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={INPUT} autoComplete="new-password" />
            </Labeled>
            {pwError ? <p className="text-[13px] font-semibold text-red-500">{pwError}</p> : null}
            {pwDone ? <p className="text-[13px] font-semibold text-emerald-600">{t("settings.pw_done")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePassword}
                disabled={pwBusy || !current || !next || !repeat}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("settings.pw_save")}
              </button>
              <button
                type="button"
                onClick={props.onForgotPassword}
                disabled={props.forgotPending}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {props.forgotPending ? t("sidebar.sending") : t("settings.pw_forgot")}
              </button>
            </div>
          </div>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("settings.notif_title")} />
          <div className="flex flex-col">
            <Toggle
              label={t("settings.notif_note")} hint={t("settings.notif_note_hint")}
              on={props.prefs.newNote} onChange={(v) => props.onPrefsChange({ newNote: v })}
            />
            <Toggle
              label={t("settings.notif_weekly")} hint={t("settings.notif_weekly_hint")}
              on={props.prefs.weeklyDigest} onChange={(v) => props.onPrefsChange({ weeklyDigest: v })}
            />
            <Toggle
              label={t("settings.notif_news")} hint={t("settings.notif_news_hint")}
              on={props.prefs.news} onChange={(v) => props.onPrefsChange({ news: v })}
            />
          </div>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("settings.report_title")} hint={t("settings.report_hint")} />
          <Labeled label={t("settings.report_topic")}>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={INPUT}>
              {TOPICS.map((id) => <option key={id} value={id}>{t(`settings.topics.${id}`)}</option>)}
            </select>
          </Labeled>
          <Labeled label={t("settings.report_message")}>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder={t("settings.report_placeholder")}
              className={`${INPUT} resize-none leading-relaxed`}
            />
          </Labeled>
          <button
            type="button"
            onClick={sendReport}
            disabled={reportBusy || !message.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {reportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.report_send")}
          </button>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("settings.danger_title")} hint={t("settings.danger_hint")} />
          {props.deleteAccount}
        </BizCard>
      </div>

      <div className="flex flex-col gap-4">
        <BizCard>
          <BizCardTitle title={t("settings.write_title")} />
          <p className="text-[13px] leading-5 text-slate-500">{t("settings.write_hint")}</p>
          <button
            type="button"
            onClick={props.onSupport}
            className="mt-3 flex w-full items-center gap-2.5 rounded-xl bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">N</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-slate-900">{t("shell.support.title")}</span>
              <span className="block text-[12px] text-slate-500">{t("shell.support.subtitle")}</span>
            </span>
          </button>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("settings.plan_title")} />
          <p className="text-[14px] font-bold text-slate-900">{props.planLabel}</p>
          <p className="text-[13px] text-slate-500">{props.planHint}</p>
          {!props.isPremium ? (
            <button
              type="button"
              onClick={props.onUpgrade}
              className="mt-3 w-full rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {t("settings.plan_cta")}
            </button>
          ) : null}
        </BizCard>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white";

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
