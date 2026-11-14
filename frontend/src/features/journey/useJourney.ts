// Journey mode state (PLAN 18.5–18.7): asks for location permission, follows the phone's position in the foreground
// (expo-location, works in Expo Go), plans the route from the live position, moves through the steps, re-plans when
// the user leaves the route and stops at the destination.
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { planRoute } from '@/api/endpoints.routing';
import type { PlanMode } from '@/api/types.routing';
import { distanceMeters, toNearParam, type Coordinates } from '@/lib/geo';

import { journeyProgress, MOVED_REPLAN_METERS, OFF_ROUTE_METERS, type JourneyProgress } from './progress';

/** Where the journey goes, and where the AI's route started (to tell whether the user has moved since). */
export type JourneyTarget = {
  to: Coordinates;
  name: string | null;
  mode: PlanMode;
  answeredFrom: Coordinates | null;
};

export type JourneyPermission = 'checking' | 'granted' | 'denied';

/** Wait at least this long between two automatic re-plans. */
const REPLAN_COOLDOWN_MS = 10_000;

/** Journey state for `target`; everything is idle while `target` is null. */
export function useJourney(target: JourneyTarget | null) {
  const [permission, setPermission] = useState<JourneyPermission>('checking');
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [planFrom, setPlanFrom] = useState<Coordinates | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [replans, setReplans] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const lastReplan = useRef(0);

  // A new target starts from scratch.
  useEffect(() => {
    setPermission('checking');
    setPosition(null);
    setPlanFrom(null);
    setStepIndex(0);
    setArrived(false);
    setReplans(0);
    lastReplan.current = 0;
  }, [target]);

  // Permission, a first fix, then position updates while the journey runs (foreground only).
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    (async () => {
      try {
        const asked = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (asked.status !== 'granted') {
          setPermission('denied');
          return;
        }
        setPermission('granted');
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        const here = { lat: first.coords.latitude, lon: first.coords.longitude };
        setPosition(here);
        setPlanFrom(here);
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
          (update) => setPosition({ lat: update.coords.latitude, lon: update.coords.longitude }),
        );
        if (cancelled) subscription.remove();
      } catch {
        if (!cancelled) setPermission('denied');
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [target, attempt]);

  // Always planned from the live position, never from where the AI answered (18.5, 18.7).
  const fromParam = planFrom ? toNearParam(planFrom) : '';
  const toParam = target ? toNearParam(target.to) : '';
  const mode = target?.mode ?? 'TRANSIT';
  const plan = useQuery({
    queryKey: ['journey', fromParam, toParam, mode],
    queryFn: () => planRoute(fromParam, toParam, mode),
    enabled: !!target && !!planFrom && !arrived,
    staleTime: Infinity,
    retry: false,
    // While a re-plan loads, keep showing the old route instead of an empty map.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === toParam && previousQuery?.queryKey[3] === mode ? previous : undefined,
  });

  // A new plan starts at its first step.
  useEffect(() => {
    setStepIndex(0);
  }, [plan.data]);

  const progress: JourneyProgress | null = useMemo(
    () => (plan.data && position && target ? journeyProgress(plan.data, position, stepIndex, target.to) : null),
    [plan.data, position, stepIndex, target],
  );

  // Follow the user: next step, arrival, or a re-plan when they are off the route.
  useEffect(() => {
    if (!progress || !position || arrived) return;
    if (progress.arrived) {
      setArrived(true);
      return;
    }
    if (progress.stepIndex !== stepIndex) setStepIndex(progress.stepIndex);
    const now = Date.now();
    if (progress.offRouteMeters > OFF_ROUTE_METERS && !plan.isFetching && now - lastReplan.current >= REPLAN_COOLDOWN_MS) {
      lastReplan.current = now;
      setPlanFrom(position);
      setReplans((n) => n + 1);
    }
  }, [progress, position, arrived, stepIndex, plan.isFetching]);

  /** Asks for permission again after it was denied. */
  const retryPermission = useCallback(() => setAttempt((n) => n + 1), []);

  // The user had moved away from where the AI's route started, so this route starts where they are now (18.7).
  const movedSinceAnswer =
    !!target?.answeredFrom && !!planFrom && replans === 0 && distanceMeters(target.answeredFrom, planFrom) > MOVED_REPLAN_METERS;

  return { permission, position, plan, progress, stepIndex: progress?.stepIndex ?? stepIndex, arrived, replans, movedSinceAnswer, retryPermission };
}
