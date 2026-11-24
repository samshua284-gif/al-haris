# Generates bell.mp3 — the pin-arrival chime (1.158).
# A soft bell: fundamental 987.77 Hz (B5) with decaying harmonic partials,
# 1.6 s, mono 22050 Hz. Requires ffmpeg with libmp3lame.
#   python3 make-bell.py && ffmpeg -y -v error -i /tmp/bell.wav -codec:a libmp3lame -q:a 4 bell.mp3
import math, struct, wave
sr = 22050; dur = 1.6; n = int(sr * dur)
f0 = 987.77
partials = [(1.0, 1.0, 2.6), (2.0, 0.35, 3.6), (2.76, 0.12, 5.0), (5.40, 0.05, 8.0)]
frames = bytearray()
for i in range(n):
    t = i / sr
    v = 0.0
    for m, g, dec in partials:
        v += g * math.sin(2 * math.pi * f0 * m * t) * math.exp(-dec * t)
    v *= 0.42 * min(1.0, t / 0.006)
    s = max(-1.0, min(1.0, v))
    frames += struct.pack('<h', int(s * 32767))
w = wave.open('/tmp/bell.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes(bytes(frames)); w.close()
print("wrote /tmp/bell.wav")
