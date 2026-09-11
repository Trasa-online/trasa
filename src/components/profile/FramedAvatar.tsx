import { avatarSrc } from "@/lib/avatar";
import { isAvatarFrame } from "@/lib/avatarFrames";
import AvatarFrame from "@/components/profile/AvatarFrame";

// Maly awatar (24 px) z ramka usera - do naglowkow wyjazdu i listy. Ramka tylko gdy user ja
// ustawil; bez niej to zwykly <img> jak dotad. Rozmiar 24 px = ten sam, co wczesniej w belce.
export function FramedAvatar({ src, frame, size = 24, className = "" }: { src?: string | null; frame?: string | null; size?: number; className?: string }) {
  const kind = isAvatarFrame(frame) ? frame : null;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <AvatarFrame kind={kind} size={size} />
      <img src={avatarSrc(src ?? null)} alt="" className="h-full w-full rounded-full object-cover bg-orange-100" />
    </span>
  );
}
