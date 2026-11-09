import { useEffect, useRef, useState } from 'react';

export function usePresence(onGone: () => void, exitMs = 200) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = window.setTimeout(onGone, exitMs);
  };

  const stateClass = leaving
    ? 'is-leaving'
    : shown
      ? 'is-shown'
      : 'is-entering';

  return { shown, leaving, stateClass, leave };
}
