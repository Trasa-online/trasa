import math, struct, wave, random

SR = 44100

# Ziarno losowosci NA STALE. Stuk palki (mallet_click) to krotki szum, wiec bez ziarna kazde
# uruchomienie dawalo INNY plik - "odtworz dzwiek ze zrodla" nie znaczylo wtedy nic, bo wychodzil
# podobny, ale nie ten sam. Z ziarnem skrypt odtwarza dokladnie plik, ktory siedzi w aplikacji.
random.seed(20260909)

def marimba_note(freq, dur, amp=1.0):
    """Ton marimby: fundament + charakterystyczny 4. alikwot (~3.9x) + jasny 10.5x.
    Szybki atak (2 ms), wykladniczy zanik - tak zachowuje sie uderzone drewno."""
    n = int(SR * dur)
    out = [0.0] * n
    partials = [(1.0, 1.00, dur), (3.9, 0.34, dur * 0.55), (10.5, 0.07, dur * 0.28)]
    for mult, pamp, pdur in partials:
        w = 2 * math.pi * freq * mult
        for i in range(n):
            t = i / SR
            env = math.exp(-t / (pdur / 4.0))
            atk = min(1.0, t / 0.002)
            out[i] += pamp * amp * env * atk * math.sin(w * t)
    return out

def mallet_click(dur=0.006, amp=0.10):
    """Stuk palki - krotki szum, zeby atak byl drewniany, a nie syntetyczny."""
    n = int(SR * dur)
    prev = 0.0
    out = []
    for i in range(n):
        s = random.uniform(-1, 1)
        hp = s - prev            # prosty gorno-przepustowy
        prev = s
        out.append(hp * amp * math.exp(-i / (n / 3.0)))
    return out

def mix(layers, total):
    n = int(SR * total)
    buf = [0.0] * n
    for data, at in layers:
        off = int(SR * at)
        for i, v in enumerate(data):
            if off + i < n:
                buf[off + i] += v
    return buf

def write(path, buf, fade=0.05):
    peak = max(abs(v) for v in buf) or 1.0
    g = 0.89 / peak                      # zapas na szczyt, bez obcinania
    n = len(buf)
    f = int(SR * fade)
    frames = bytearray()
    for i, v in enumerate(buf):
        x = v * g
        if i > n - f:                    # wyciszenie na koncu - zero trzasku
            x *= (n - i) / f
        frames += struct.pack("<h", int(max(-1.0, min(1.0, x)) * 32767))
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(frames))
    return n / SR

N = lambda name: {"C5": 523.25, "E5": 659.25, "F5": 698.46, "G5": 783.99, "A5": 880.00}[name]

# A: kwarta C5 -> F5. Cieple, spokojne, najblizej "przyjaznego powiadomienia".
a = mix([(mallet_click(), 0.0), (marimba_note(N("C5"), 0.45), 0.0),
         (mallet_click(), 0.115), (marimba_note(N("F5"), 0.55, 0.95), 0.115)], 0.62)
# B: kwinta C5 -> G5. Jasniejsza, bardziej "otwarta" - mocniej sie przebija.
b = mix([(mallet_click(), 0.0), (marimba_note(N("C5"), 0.45), 0.0),
         (mallet_click(), 0.115), (marimba_note(N("G5"), 0.55, 0.95), 0.115)], 0.62)
# C: trojdzwiek C5-E5-G5. Trzy szybkie tony - bardziej "cos sie wydarzylo".
c = mix([(mallet_click(), 0.0), (marimba_note(N("C5"), 0.32), 0.0),
         (mallet_click(), 0.085), (marimba_note(N("E5"), 0.32, 0.95), 0.085),
         (mallet_click(), 0.17), (marimba_note(N("G5"), 0.5, 0.9), 0.17)], 0.62)

for name, buf in [("spontaway-a-kwarta", a), ("spontaway-b-kwinta", b), ("spontaway-c-trojdzwiek", c)]:
    d = write(f"{name}.wav", buf)
    print(f"{name}.wav  {d:.2f}s")
