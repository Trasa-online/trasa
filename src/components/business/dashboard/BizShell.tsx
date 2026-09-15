// Szkielet panelu lokalu: boczna nawigacja, gorna belka i dolny pasek na telefonie.
// Wzor: Figma „B2B Dashboard / 1 Spokojny panel" (wybor Nat) - jeden spokojny uklad
// zamiast kolorowych kafli, akcent marki tylko na aktywnej pozycji i na guziku premium.
//
// ⚠️ Komponent NIE dotyka danych. Dostaje wszystko propsami, zeby dalo sie go uzyc
// w panelu lokalu i w podgladzie, bez przeciagania calego stanu dashboardu.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Store, BookOpen, CalendarDays, MessageSquareQuote, Images, Settings,
  Bell, LogOut, ChevronDown, Loader2, Check, MoreHorizontal, X, Plus,
} from "lucide-react";
import { TrasaLogo } from "@/components/TrasaLogo";
import { markBusinessLangChoice } from "@/lib/businessLanguage";
import { venueKey, type OwnedVenue } from "@/lib/businessVenues";
import i18n from "@/i18n";

export type BizSection = "overview" | "profile" | "menu" | "posts" | "community" | "gallery" | "settings";

const SECTION_ICON: Record<BizSection, typeof Store> = {
  overview: LayoutDashboard,
  profile: Store,
  menu: BookOpen,
  posts: CalendarDays,
  community: MessageSquareQuote,
  gallery: Images,
  settings: Settings,
};

// Kolejnosc z makiety. Na telefonie pierwsze CZTERY siedza w dolnym pasku,
// reszta chowa sie pod „Więcej" - piec pozycji to maksimum, ktore da sie tapnac.
const ORDER: BizSection[] = ["overview", "profile", "menu", "posts", "community", "gallery", "settings"];
const MOBILE_PRIMARY: BizSection[] = ["overview", "profile", "menu", "posts"];

export interface BizShellProps {
  active: BizSection;
  onSelect: (section: BizSection) => void;
  businessName: string;
  city?: string | null;
  avatarUrl?: string | null;
  planLabel: string;
  isPremium: boolean;
  /** Stan miekkiego zapisu - lokal nie klika „Zapisz", wiec musi widziec, ze zmiany leca. */
  saveStatus?: "idle" | "saving" | "saved";
  /** Tytul sekcji. Pusty = sekcja rysuje wlasny naglowek (stan przejsciowy przebudowy). */
  title?: string;
  subtitle?: string;
  /** Akcje przy tytule sekcji (np. „Zapisz zmiany", „Dodaj pozycję"). */
  actions?: ReactNode;
  /** Banery nad trescia (powitanie, weryfikacja, tryb podgladu). */
  banners?: ReactNode;
  onLogout: () => void;
  onSupport: () => void;
  onUpgrade: () => void;
  /** Wszystkie lokale wlasciciela. Jeden lokal = przelacznik pokazuje sama nazwe. */
  venues?: OwnedVenue[];
  /** Klucz otwartego lokalu (place_id albo id wizytowki - to samo, co w adresie). */
  currentVenueKey?: string;
  onSwitchVenue?: (key: string) => void;
  onAddVenue?: () => void;
  children: ReactNode;
}

export function BizShell(props: BizShellProps) {
  const { t } = useTranslation("bizdash");
  const [moreOpen, setMoreOpen] = useState(false);

  const label = (s: BizSection) => t(`shell.nav.${s}`);
  const initial = (props.businessName || "?").trim().charAt(0).toUpperCase();

  const Avatar = ({ size = 32 }: { size?: number }) => (
    props.avatarUrl
      ? <img src={props.avatarUrl} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-lg object-cover" />
      : <span
          style={{ width: size, height: size }}
          className="flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500"
        >{initial}</span>
  );

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* ── Boczna nawigacja (od md) ── */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-100 bg-white p-4 md:flex">
        <div className="mb-5 flex items-center gap-2 px-1">
          <TrasaLogo size={26} />
          <span className="text-[15px] font-black leading-none">
            spontaway <span className="text-primary">biznes</span>
          </span>
        </div>

        <VenueSwitcher
          businessName={props.businessName || t("business_name_fallback")}
          city={props.city}
          avatar={<Avatar />}
          venues={props.venues ?? []}
          currentKey={props.currentVenueKey}
          onSwitch={props.onSwitchVenue}
          onAdd={props.onAddVenue}
          onOpenProfile={() => props.onSelect("profile")}
        />

        <nav className="flex flex-col gap-0.5">
          {ORDER.map((id) => {
            const Icon = SECTION_ICON[id];
            const on = props.active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => props.onSelect(id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  on ? "bg-slate-100 font-bold text-slate-900" : "font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${on ? "text-primary" : "text-slate-400"}`} />
                {label(id)}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <SupportCard onClick={props.onSupport} label={t("shell.support.title")} subtitle={t("shell.support.subtitle")} />
          {!props.isPremium ? <PremiumCard planLabel={props.planLabel} onUpgrade={props.onUpgrade} /> : null}
        </div>
      </aside>

      {/* ── Tresc ── */}
      <div className="flex min-h-screen flex-col md:ml-64">
        {/* Gorna belka */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-4 md:h-16 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="md:hidden"><Avatar size={30} /></span>
            <span className="min-w-0 md:hidden">
              <span className="block truncate text-sm font-bold text-slate-900">{props.businessName || t("business_name_fallback")}</span>
              <span className="block truncate text-xs text-slate-400">{label(props.active)}</span>
            </span>
            <span className="hidden text-sm md:inline">
              <span className="text-slate-400">{t("shell.breadcrumb")}</span>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="font-semibold text-slate-900">{label(props.active)}</span>
            </span>
            {props.saveStatus && props.saveStatus !== "idle" ? (
              <span className="ml-2 hidden items-center gap-1.5 text-[11px] font-semibold text-slate-400 sm:inline-flex">
                {props.saveStatus === "saving"
                  ? <><Loader2 className="h-3 w-3 animate-spin" />{t("save.autosaving")}</>
                  : <><Check className="h-3 w-3 text-emerald-500" />{t("save.autosaved")}</>}
              </span>
            ) : null}
          </div>

          <LangSwitch />

          <button
            type="button"
            title={t("shell.notifications")}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>

          <span className="hidden items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 md:inline-flex">
            <Avatar size={26} />
            <span className="max-w-[160px] truncate text-sm font-semibold text-slate-800">{props.businessName || t("business_name_fallback")}</span>
          </span>

          <button
            type="button"
            onClick={props.onLogout}
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 md:inline-flex"
          >
            <LogOut className="h-4 w-4" />
            {t("sidebar.logout")}
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          {props.banners}
          {props.title || props.actions ? (
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {props.title ? <h1 className="text-[26px] font-black leading-tight text-slate-900 md:text-[30px]">{props.title}</h1> : null}
                {props.subtitle ? <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p> : null}
              </div>
              {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
            </div>
          ) : null}
          {props.children}
        </main>
      </div>

      {/* ── Dolny pasek (telefon) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {MOBILE_PRIMARY.map((id) => {
          const Icon = SECTION_ICON[id];
          const on = props.active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => props.onSelect(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${on ? "text-primary" : "text-slate-400"}`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label(id)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${
            MOBILE_PRIMARY.includes(props.active) ? "text-slate-400" : "text-primary"
          }`}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
          {t("shell.more")}
        </button>
      </nav>

      {/* Arkusz „Więcej": reszta sekcji + wsparcie + wylogowanie. */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative mx-2 mb-2 w-[calc(100%-16px)] rounded-[32px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-black text-slate-900">{t("shell.more")}</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label={t("shell.close")} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {ORDER.filter((id) => !MOBILE_PRIMARY.includes(id)).map((id) => {
                const Icon = SECTION_ICON[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { props.onSelect(id); setMoreOpen(false); }}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold ${
                      props.active === id ? "bg-slate-100 text-slate-900" : "text-slate-600"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${props.active === id ? "text-primary" : "text-slate-400"}`} />
                    {label(id)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => { setMoreOpen(false); props.onSupport(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600"
              >
                <MessageSquareQuote className="h-4 w-4 text-slate-400" />
                {t("shell.support.title")}
              </button>
              <button
                type="button"
                onClick={() => { setMoreOpen(false); props.onLogout(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                {t("sidebar.logout")}
              </button>
            </div>
            {!props.isPremium ? (
              <div className="mt-3"><PremiumCard planLabel={props.planLabel} onUpgrade={() => { setMoreOpen(false); props.onUpgrade(); }} /></div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Przelacznik lokali. Wlasciciel kilku lokali przelacza sie tutaj, a nie przez adres URL.
// Jeden lokal = ta sama karta, tylko bez listy - zeby nie sugerowac wyboru, ktorego nie ma.
function VenueSwitcher({ businessName, city, avatar, venues, currentKey, onSwitch, onAdd, onOpenProfile }: {
  businessName: string;
  city?: string | null;
  avatar: ReactNode;
  venues: OwnedVenue[];
  currentKey?: string;
  onSwitch?: (key: string) => void;
  onAdd?: () => void;
  onOpenProfile: () => void;
}) {
  const { t } = useTranslation("bizdash");
  const [open, setOpen] = useState(false);
  const many = venues.length > 1;

  return (
    <div className="relative mb-4">
      <button
        type="button"
        onClick={() => (many || onAdd ? setOpen((v) => !v) : onOpenProfile())}
        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:bg-slate-50"
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{businessName}</span>
          <span className="block truncate text-xs text-slate-400">
            {many ? t("shell.venues.count", { count: venues.length }) : city || ""}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {venues.map((v) => {
              const key = venueKey(v);
              const on = key === currentKey;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setOpen(false); if (!on) onSwitch?.(key); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${on ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">
                      {v.business_name || t("business_name_fallback")}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {v.is_draft ? t("shell.venues.draft") : !v.is_active ? t("shell.venues.hidden") : v.city || ""}
                    </span>
                  </span>
                  {on ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
            {onAdd ? (
              <button
                type="button"
                onClick={() => { setOpen(false); onAdd(); }}
                className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-[13px] font-bold text-primary"
              >
                <Plus className="h-4 w-4" />
                {t("shell.venues.add")}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// „Napisz do nas" = bezposredni kontakt z zespolem (otwiera formularz zgloszenia).
// ⛔ NIE pokazujemy tu adresu e-mail: w makiecie stal placeholder, a wpisanie prywatnej
// skrzynki w panel widziany przez kazdy lokal to zaproszenie do spamu. Zamiast adresu
// obiecujemy to, co naprawde dotrzymujemy - odpowiedz tego samego dnia.
function SupportCard({ onClick, label, subtitle }: { onClick: () => void; label: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:bg-slate-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">N</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900">{label}</span>
        <span className="block truncate text-[11px] text-slate-400">{subtitle}</span>
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
    </button>
  );
}

function PremiumCard({ planLabel, onUpgrade }: { planLabel: string; onUpgrade: () => void }) {
  const { t } = useTranslation("bizdash");
  return (
    <div className="rounded-2xl bg-[#FDF184] p-4">
      <span className="inline-block rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5B2C06]">
        {planLabel}
      </span>
      <p className="mt-2 text-[13px] font-semibold leading-snug text-[#5B2C06]">{t("shell.premium.copy")}</p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        {t("shell.premium.cta")}
      </button>
    </div>
  );
}

// Panel lokalu jest domyslnie po polsku, ale wybor jezyka zostaje przy lokalu
// (klucz `spontaway_biz_lang_choice` wygrywa na stale - patrz businessLanguage.ts).
function LangSwitch() {
  const current = (i18n.language || "").toLowerCase().startsWith("en") ? "en" : "pl";
  return (
    <div className="flex shrink-0 gap-0.5 rounded-full bg-slate-100 p-0.5">
      {(["pl", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => { if (code !== current) { markBusinessLangChoice(code); i18n.changeLanguage(code); } }}
          className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase transition-colors ${
            code === current ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
