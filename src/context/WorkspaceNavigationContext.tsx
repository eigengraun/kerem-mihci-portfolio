"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useDesktopStore, WorkspaceId } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";
import { workspacesData } from "@/data/workspaces";

interface WorkspaceNavigationContextType {
  activeWorkspace: WorkspaceId;
  isTransitioning: boolean;
  transitionDirection: "down" | "up";
  outgoingWorkspace: WorkspaceId | null;
  incomingWorkspace: WorkspaceId | null;
  scrollProgress: number;
  scrollDirection: "down" | "up" | null;
  isActiveScroll: boolean;
  navigateToWorkspace: (targetId: WorkspaceId, explicitDirection?: "down" | "up", isWheelSource?: boolean) => void;
}

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextType | null>(null);

export const useWorkspaceNavigation = () => {
  const context = useContext(WorkspaceNavigationContext);
  if (!context) {
    throw new Error("useWorkspaceNavigation must be used within a WorkspaceNavigationProvider");
  }
  return context;
};

// Check if element or any parent is isolated from workspace scroll navigation
function isScrollableUI(e: WheelEvent): boolean {
  if (e.ctrlKey) return true;
  if (useSessionStore.getState().isDraggingProject) return true;

  const path = e.composedPath ? e.composedPath() : [];
  for (let i = 0; i < path.length; i++) {
    const el = path[i] as HTMLElement;
    if (!el || !el.getAttribute) continue;

    if (
      el.getAttribute("data-prevent-workspace-wheel") === "true" ||
      el.getAttribute("data-workspace-scroll-lock") === "true"
    ) {
      return true;
    }

    const className = el.className;
    if (typeof className === "string" && className.length > 0) {
      if (
        className.includes("desktop-window") ||
        className.includes("window-content") ||
        className.includes("dock-container") ||
        className.includes("workspace-switcher") ||
        className.includes("popup") ||
        className.includes("popover") ||
        className.includes("modal") ||
        className.includes("overflow-y-auto") ||
        className.includes("overflow-auto") ||
        className.includes("overflow-y-scroll")
      ) {
        return true;
      }
    }

    const tagName = el.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }
  }

  return false;
}

// Navigation timing & intent constants
const SCROLL_THRESHOLD = 300;
const MAX_DELTA_PER_EVENT = 60;
const ANIMATION_DURATION = 520; // ms visual transition
const GESTURE_SETTLE_TIMEOUT = 220; // ms trackpad momentum settle
const GRACE_PERIOD_TIMEOUT = 850; // ms partial scroll grace period
const DECAY_DURATION = 300; // ms smooth ease-out reset animation
const REVERSAL_DURATION = 200; // ms direction reversal reset animation
const REVERSAL_INTENT_THRESHOLD = 20; // delta threshold for direction reversal noise filter
const HOLD_FULL_PROGRESS_TIMEOUT = 100; // ms hold 100% fill before reset
const FAILSAFE_UNLOCK_TIMEOUT = 1200; // ms failsafe unlock timer

type NavigationState = "IDLE" | "GESTURE_ACTIVE" | "REVERSING" | "TRANSITIONING" | "WAITING_FOR_GESTURE_END";

export const WorkspaceNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeWorkspace, setActiveWorkspace, dismissHint } = useDesktopStore();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<"down" | "up">("down");
  const [outgoingWorkspace, setOutgoingWorkspace] = useState<WorkspaceId | null>(null);
  const [incomingWorkspace, setIncomingWorkspace] = useState<WorkspaceId | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<"down" | "up" | null>(null);
  const [isActiveScroll, setIsActiveScroll] = useState(false);

  // Mutable refs for state machine and stable event tracking
  const activeWorkspaceRef = useRef(activeWorkspace);
  const navStateRef = useRef<NavigationState>("IDLE");
  const accumulatorRef = useRef(0);
  const scrollDirectionRef = useRef<"down" | "up" | null>(null);
  const scrollProgressRef = useRef(0);

  const reversalIntentRef = useRef(0);
  const pendingDirectionRef = useRef<"down" | "up" | null>(null);
  const bufferedDeltaRef = useRef(0);

  const decayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const decayRafRef = useRef<number | null>(null);

  // Always keep activeWorkspaceRef current
  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  // Keep scrollProgressRef updated
  const updateProgressState = useCallback((prog: number) => {
    setScrollProgress(prog);
    scrollProgressRef.current = prog;
  }, []);

  // Helper to force-return system to IDLE cleanly
  const resetToIdle = useCallback(() => {
    if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
    navStateRef.current = "IDLE";
    setIsTransitioning(false);
    setOutgoingWorkspace(null);
    setIncomingWorkspace(null);
    accumulatorRef.current = 0;
    scrollDirectionRef.current = null;
    reversalIntentRef.current = 0;
    pendingDirectionRef.current = null;
    bufferedDeltaRef.current = 0;
    updateProgressState(0);
    setScrollDirection(null);
    setIsActiveScroll(false);
  }, [updateProgressState]);

  const navigateToWorkspace = useCallback(
    (targetId: WorkspaceId, explicitDirection?: "down" | "up", isWheelSource = false) => {
      const currentWs = activeWorkspaceRef.current;
      if (targetId === currentWs && navStateRef.current !== "TRANSITIONING") return;
      if (navStateRef.current === "TRANSITIONING") return;

      const currentIndex = workspacesData.findIndex((w) => w.id === currentWs);
      const targetIndex = workspacesData.findIndex((w) => w.id === targetId);

      if (targetIndex < 0 || targetIndex === currentIndex) return;

      const direction = explicitDirection || (targetIndex > currentIndex ? "down" : "up");

      // Lock state machine to transitioning
      navStateRef.current = "TRANSITIONING";

      setIsTransitioning(true);
      setTransitionDirection(direction);
      setOutgoingWorkspace(currentWs);
      setIncomingWorkspace(targetId);

      if (isWheelSource) {
        dismissHint();
      }

      setActiveWorkspace(targetId);
      activeWorkspaceRef.current = targetId;

      // Hold 100% fill briefly then reset progress
      if (fullHoldTimerRef.current) clearTimeout(fullHoldTimerRef.current);
      fullHoldTimerRef.current = setTimeout(() => {
        accumulatorRef.current = 0;
        scrollDirectionRef.current = null;
        reversalIntentRef.current = 0;
        pendingDirectionRef.current = null;
        bufferedDeltaRef.current = 0;
        updateProgressState(0);
        setScrollDirection(null);
        setIsActiveScroll(false);
      }, HOLD_FULL_PROGRESS_TIMEOUT);

      // Clear existing animation / failsafe timers before starting new transition
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (gestureEndTimerRef.current) clearTimeout(gestureEndTimerRef.current);
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);

      // Schedule transition end
      animationTimerRef.current = setTimeout(() => {
        setIsTransitioning(false);
        setOutgoingWorkspace(null);
        setIncomingWorkspace(null);

        if (isWheelSource) {
          navStateRef.current = "WAITING_FOR_GESTURE_END";
          gestureEndTimerRef.current = setTimeout(() => {
            navStateRef.current = "IDLE";
            if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
          }, GESTURE_SETTLE_TIMEOUT);
        } else {
          // Explicit click from WorkspaceSwitcher returns directly to IDLE
          navStateRef.current = "IDLE";
          if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
        }
      }, ANIMATION_DURATION);

      // Failsafe timer: force-reset to IDLE after 1200ms if anything hangs
      failsafeTimerRef.current = setTimeout(() => {
        if (navStateRef.current !== "IDLE") {
          resetToIdle();
        }
      }, FAILSAFE_UNLOCK_TIMEOUT);
    },
    [setActiveWorkspace, dismissHint, updateProgressState, resetToIdle]
  );

  // Store navigateToWorkspace in ref for wheel handler
  const navigateToWorkspaceRef = useRef(navigateToWorkspace);
  useEffect(() => {
    navigateToWorkspaceRef.current = navigateToWorkspace;
  }, [navigateToWorkspace]);

  // Smoothly decay partial scroll progress to zero after 850ms grace period
  const triggerDecay = useCallback(() => {
    if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);

    const startProg = scrollProgressRef.current;
    if (startProg <= 0) {
      accumulatorRef.current = 0;
      scrollDirectionRef.current = null;
      reversalIntentRef.current = 0;
      updateProgressState(0);
      setScrollDirection(null);
      if (navStateRef.current === "GESTURE_ACTIVE") {
        navStateRef.current = "IDLE";
      }
      return;
    }

    const startTime = performance.now();

    const animateDecay = (now: number) => {
      const elapsed = now - startTime;
      const factor = Math.max(1 - elapsed / DECAY_DURATION, 0);
      const currentProg = startProg * factor;

      updateProgressState(currentProg);

      if (factor > 0) {
        decayRafRef.current = requestAnimationFrame(animateDecay);
      } else {
        accumulatorRef.current = 0;
        scrollDirectionRef.current = null;
        reversalIntentRef.current = 0;
        updateProgressState(0);
        setScrollDirection(null);
        if (navStateRef.current === "GESTURE_ACTIVE") {
          navStateRef.current = "IDLE";
        }
      }
    };

    decayRafRef.current = requestAnimationFrame(animateDecay);
  }, [updateProgressState]);

  const triggerDecayRef = useRef(triggerDecay);
  useEffect(() => {
    triggerDecayRef.current = triggerDecay;
  }, [triggerDecay]);

  // Trigger smooth 200ms direction reversal: decays old fill to 0 first, then switches direction
  const triggerDirectionReversal = useCallback(
    (newDir: "down" | "up", initialClampedDelta: number) => {
      if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);

      navStateRef.current = "REVERSING";
      pendingDirectionRef.current = newDir;
      bufferedDeltaRef.current = Math.abs(initialClampedDelta);

      const startProg = scrollProgressRef.current;
      const startTime = performance.now();

      const animateReversal = (now: number) => {
        const elapsed = now - startTime;
        const factor = Math.max(1 - elapsed / REVERSAL_DURATION, 0);
        const currentProg = startProg * factor;

        updateProgressState(currentProg);

        if (factor > 0) {
          decayRafRef.current = requestAnimationFrame(animateReversal);
        } else {
          // Zero reached! Switch direction now
          const targetDir = pendingDirectionRef.current || newDir;
          scrollDirectionRef.current = targetDir;
          setScrollDirection(targetDir);

          // Apply buffered new-direction contribution (clamped to max 25% progress)
          const bufferedDelta = bufferedDeltaRef.current;
          bufferedDeltaRef.current = 0;
          reversalIntentRef.current = 0;

          const clampedAcc = Math.min(bufferedDelta, SCROLL_THRESHOLD * 0.25);
          accumulatorRef.current = clampedAcc;

          const newProgress = Math.min(clampedAcc / SCROLL_THRESHOLD, 1.0);
          updateProgressState(newProgress);
          setIsActiveScroll(true);

          navStateRef.current = "GESTURE_ACTIVE";

          // Schedule decay if user stops scrolling after reversal
          if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
          decayTimerRef.current = setTimeout(() => triggerDecayRef.current(), GRACE_PERIOD_TIMEOUT);
        }
      };

      decayRafRef.current = requestAnimationFrame(animateReversal);
    },
    [updateProgressState]
  );

  // Stable wheel handler function reading from refs
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (window.innerWidth < 768) return;
      if (isScrollableUI(e)) return;

      const state = navStateRef.current;

      if (state === "TRANSITIONING") {
        e.preventDefault();
        return;
      }

      if (state === "WAITING_FOR_GESTURE_END") {
        e.preventDefault();
        return;
      }

      let deltaY = e.deltaY;
      if (e.deltaMode === 1) deltaY *= 20;
      else if (e.deltaMode === 2) deltaY *= 800;

      if (Math.abs(deltaY) <= Math.abs(e.deltaX) * 1.2) {
        return;
      }

      e.preventDefault();

      const clampedDelta = Math.max(Math.min(deltaY, MAX_DELTA_PER_EVENT), -MAX_DELTA_PER_EVENT);
      const newDir: "down" | "up" = clampedDelta > 0 ? "down" : "up";

      // While in REVERSING state (old progress is decaying to 0 over 200ms):
      // Buffer incoming new-direction wheel events without disturbing decay animation
      if (state === "REVERSING") {
        if (pendingDirectionRef.current === newDir) {
          bufferedDeltaRef.current = Math.min(
            bufferedDeltaRef.current + Math.abs(clampedDelta),
            SCROLL_THRESHOLD * 0.4
          );
        }
        return;
      }

      // Cancel any active decay timer or animation on fresh active scroll input
      if (decayRafRef.current) {
        cancelAnimationFrame(decayRafRef.current);
        decayRafRef.current = null;
      }
      if (decayTimerRef.current) {
        clearTimeout(decayTimerRef.current);
        decayTimerRef.current = null;
      }

      // Direction reversal detection while progress > 0
      if (
        scrollDirectionRef.current !== null &&
        newDir !== scrollDirectionRef.current &&
        scrollProgressRef.current > 0.02
      ) {
        reversalIntentRef.current += Math.abs(clampedDelta);
        if (reversalIntentRef.current >= REVERSAL_INTENT_THRESHOLD) {
          // Confirmed reversal intent! Smoothly decay old progress to 0 before switching direction
          triggerDirectionReversal(newDir, clampedDelta);
          return;
        }
        // Below noise threshold: ignore tiny trackpad jitter
        return;
      }

      // Reset reversal intent on same-direction gesture
      reversalIntentRef.current = 0;
      navStateRef.current = "GESTURE_ACTIVE";

      accumulatorRef.current += Math.abs(clampedDelta);
      scrollDirectionRef.current = newDir;
      setScrollDirection(newDir);

      const currentWs = activeWorkspaceRef.current;
      const currentIndex = workspacesData.findIndex((w) => w.id === currentWs);

      if (currentIndex === 0 && newDir === "up") {
        accumulatorRef.current = Math.min(accumulatorRef.current, 60);
        const prog = Math.min(accumulatorRef.current / SCROLL_THRESHOLD, 0.2);
        updateProgressState(prog);
        setIsActiveScroll(true);

        if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
        decayTimerRef.current = setTimeout(() => triggerDecayRef.current(), GRACE_PERIOD_TIMEOUT);
        return;
      }

      if (currentIndex === workspacesData.length - 1 && newDir === "down") {
        accumulatorRef.current = Math.min(accumulatorRef.current, 60);
        const prog = Math.min(accumulatorRef.current / SCROLL_THRESHOLD, 0.2);
        updateProgressState(prog);
        setIsActiveScroll(true);

        if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
        decayTimerRef.current = setTimeout(() => triggerDecayRef.current(), GRACE_PERIOD_TIMEOUT);
        return;
      }

      const progress = Math.min(accumulatorRef.current / SCROLL_THRESHOLD, 1.0);
      updateProgressState(progress);
      setIsActiveScroll(true);

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsActiveScroll(false);
      }, 1000);

      if (progress >= 1.0) {
        const targetIndex = newDir === "down" ? currentIndex + 1 : currentIndex - 1;
        if (targetIndex >= 0 && targetIndex < workspacesData.length) {
          const targetWs = workspacesData[targetIndex].id;
          if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
          navigateToWorkspaceRef.current(targetWs, newDir, true);
        }
      } else {
        if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
        decayTimerRef.current = setTimeout(() => triggerDecayRef.current(), GRACE_PERIOD_TIMEOUT);
      }
    },
    [updateProgressState, triggerDirectionReversal]
  );

  // Attach wheel listener ONCE on mount using stable callback
  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (gestureEndTimerRef.current) clearTimeout(gestureEndTimerRef.current);
      if (fullHoldTimerRef.current) clearTimeout(fullHoldTimerRef.current);
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
      if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
    };
  }, [handleWheel]);

  return (
    <WorkspaceNavigationContext.Provider
      value={{
        activeWorkspace,
        isTransitioning,
        transitionDirection,
        outgoingWorkspace,
        incomingWorkspace,
        scrollProgress,
        scrollDirection,
        isActiveScroll,
        navigateToWorkspace
      }}
    >
      {children}
    </WorkspaceNavigationContext.Provider>
  );
};
