import { avatarSrc } from "@/lib/avatar";
import { isAvatarFrame } from "@/lib/avatarFrames";
import { useAvatarFrame } from "@/lib/avatarFrameLoader";
import AvatarFrame from "@/components/profile/AvatarFrame";

// Maly awatar (domyslnie 24 px) z ramka usera - naglowki wyjazdu i listy, autor na kartach,
// kafelki eksploracji, arkusz udostepniania. Ramka tylko gdy user ja ustawil; bez niej to
// zwykly <img> jak dotad.
export function FramedAvatar({ src, frame, color, size = 24, className = "", imgClassName = "" }: {
  src?: string | null; frame?: string | null; color?: string | null; size?: number; className?: string;
  /** Dodatkowe klasy na samym zdjeciu (np. `ring-2 ring-white`). */
  imgClassName?: string;
}) {
  const kind = isAvatarFrame(frame) ? frame : null;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <AvatarFrame kind={kind} color={color} size={size} />
      <img src={avatarSrc(src ?? null)} alt="" className={`h-full w-full rounded-full object-cover bg-orange-100 ${imgClassName}`} />
    </span>
  );
}

/**
 * Awatar CUDZEGO usera z ramka dociagana po `userId` (loader zbiera pytania z jednego renderu
 * w jedno zapytanie - patrz avatarFrameLoader). Gdy rodzic ma juz ramke pod reka, podaje
 * `frame`/`color` wprost (nawet null) i lookup nie startuje.
 */
export function UserAvatar({ userId, src, frame, color, size = 24, className = "", imgClassName = "" }: {
  userId?: string | null; src?: string | null; frame?: string | null; color?: string | null;
  size?: number; className?: string; imgClassName?: string;
}) {
  const explicit = frame !== undefined;
  const looked = useAvatarFrame(explicit ? null : userId);
  return (
    <FramedAvatar
      src={src}
      frame={explicit ? frame : looked?.frame}
      color={explicit ? color : looked?.color}
      size={size}
      className={className}
      imgClassName={imgClassName}
    />
  );
}

/**
 * Sama RAMKA (bez zdjecia) dociagana po `userId` - do polozenia obok istniejacego <Avatar>
 * w elemencie `relative` (wiersze ludzi w wyszukiwarce, polecani). `size` = srednica awatara.
 */
export function UserFrameRing({ userId, size }: { userId?: string | null; size: number }) {
  const info = useAvatarFrame(userId);
  return <AvatarFrame kind={isAvatarFrame(info?.frame) ? info.frame : null} color={info?.color} size={size} />;
}
