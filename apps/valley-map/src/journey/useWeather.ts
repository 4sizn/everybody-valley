import { parseApiAlert, type ValleyAlertState } from '@modu-valley/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createApiClient } from '@/api/createApiClient';

const api = createApiClient();
export function useWeather(valleyId: string) {
  const previousValley = useRef(valleyId);
  const [value, setValue] = useState<ValleyAlertState | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    if (previousValley.current !== valleyId) {
      setValue(null);
      setError(false);
      previousValley.current = valleyId;
    }
    void attempt;
    const load = async () => {
      const result = await api.alerts();
      if (!active) return;
      setError(!result.ok);
      if (result.ok) {
        const entry = result.value.find((v) => v.valleyId === valleyId);
        setValue(entry ? parseApiAlert(entry) : null);
      }
    };
    void load();
    const subscription = api.subscribeEvents(['alert'], () => void load());
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      subscription.dispose();
      clearInterval(interval);
    };
  }, [valleyId, attempt]);
  return { value, error, refresh };
}
