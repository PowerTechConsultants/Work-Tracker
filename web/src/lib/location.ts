export interface BestLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationCapturedAt: string;
}

export interface CaptureOptions {
  goodAccuracy?: number;
  timeoutMs?: number;
  onProgress?: (accuracy: number) => void;
}

const DEFAULT_GOOD_ACCURACY = 25;
const DEFAULT_TIMEOUT_MS = 10000;

export function captureBestLocation(options: CaptureOptions = {}): Promise<BestLocation | null> {
  const goodAccuracy = options.goodAccuracy ?? DEFAULT_GOOD_ACCURACY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const onProgress = options.onProgress;

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    let best: BestLocation | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = (loc: BestLocation | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(loc);
    };

    const handlePosition = (pos: GeolocationPosition) => {
      const candidate: BestLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        locationCapturedAt: new Date().toISOString(),
      };
      if (!best || candidate.accuracy < best.accuracy) best = candidate;
      onProgress?.(best.accuracy);
      if (best.accuracy <= goodAccuracy) finish(best);
    };

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      () => finish(best),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    timer = setTimeout(() => finish(best), timeoutMs);
  });
}
