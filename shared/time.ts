export function clampTimeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function normalizeEventRange(
  startMs: number,
  endMs: number,
  fallbackCenterMs = 0,
  fallbackDurationMs = 10_000,
): { startMs: number; endMs: number } {
  const safeStart = clampTimeMs(startMs);
  const safeEnd = clampTimeMs(endMs);

  if (safeEnd > safeStart) {
    return { startMs: safeStart, endMs: safeEnd };
  }

  const half = Math.max(500, Math.round(fallbackDurationMs / 2));
  const center = clampTimeMs(fallbackCenterMs);
  return {
    startMs: Math.max(0, center - half),
    endMs: center + half,
  };
}

export function formatTimecode(ms: number, showMillis = false): string {
  const safe = clampTimeMs(ms);
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  const base = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return showMillis ? `${base}:${millis.toString().padStart(3, "0")}` : base;
}

export function parseTimecode(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, h, m, s, ms = "0"] = match;
  const minutes = Number(m);
  const seconds = Number(s);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return (
    Number(h) * 3_600_000 +
    minutes * 60_000 +
    seconds * 1_000 +
    Number(ms.padEnd(3, "0").slice(0, 3))
  );
}
