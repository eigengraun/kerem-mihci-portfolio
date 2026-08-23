"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { dockConfig, DockItemConfig } from "@/data/dock";
import { useDesktopStore } from "@/store/desktopStore";
import { useSessionStore } from "@/store/sessionStore";
import { DockIcon } from "./DockIcon";
import { DockSeparator } from "./DockSeparator";

// Geometry Constants
const BASE_SIZE = 46;
const MAX_SIZE = 74;
const INFLUENCE_RADIUS = 155;
const PROXIMITY_ZONE_TOP = 40;

// Low-Amplitude Main Shelf Constants (Compact capsule design)
const IDLE_SHELF_HEIGHT = 60;
const MAX_SHELF_HEIGHT = 68; // Restrained to +8px max expansion
const IDLE_SHELF_PADDING_X = 10;
const MAX_SHELF_PADDING_X = 14;
const IDLE_SHELF_RADIUS = 16;
const MAX_SHELF_RADIUS = 18;

// Localized Glass Lift Constants
const LOCAL_GLASS_WIDTH = 210;
const LOCAL_GLASS_HEIGHT = 82;

// Analytical Spring Constant (Natural frequency ~20 rad/s for snappy, critically damped macOS response)
const SPRING_OMEGA = 20;

export const Dock: React.FC = () => {
  const { activeWorkspace, theme } = useDesktopStore();
  const { isDraggingProject } = useSessionStore();

  const [socialsOpen, setSocialsOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const items: DockItemConfig[] = dockConfig[activeWorkspace] || dockConfig.design;
  const isLight = theme === "light";

  // References to DOM elements for direct zero-rerender spring manipulation
  const containerRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLElement>(null);
  const localGlassRef = useRef<HTMLDivElement>(null);
  const itemWrappersRef = useRef<Record<string, HTMLElement | null>>({});
  const itemTilesRef = useRef<Record<string, HTMLElement | null>>({});
  const tooltipsRef = useRef<Record<string, HTMLElement | null>>({});

  // Animation state
  const currentSizesRef = useRef<Record<string, number>>({});
  const targetSizesRef = useRef<Record<string, number>>({});
  const velocitiesRef = useRef<Record<string, number>>({});
  const currentGlassXRef = useRef<number>(0);
  const targetGlassXRef = useRef<number>(0);
  const glassVelRef = useRef<number>(0);
  const activeTooltipIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isPointerInZoneRef = useRef<boolean>(false);
  const lastPointerXRef = useRef<number | null>(null);
  const stepAnimationRef = useRef<() => void>(() => {});

  // Register item DOM elements
  const registerItem = useCallback(
    (
      id: string,
      wrapper: HTMLElement | null,
      tile: HTMLElement | null,
      tooltip: HTMLElement | null
    ) => {
      if (wrapper) {
        itemWrappersRef.current[id] = wrapper;
        itemTilesRef.current[id] = tile;
        tooltipsRef.current[id] = tooltip;

        if (currentSizesRef.current[id] === undefined) {
          currentSizesRef.current[id] = BASE_SIZE;
          targetSizesRef.current[id] = BASE_SIZE;
          velocitiesRef.current[id] = 0;
        }

        // Apply base styling immediately (perfectly centered at rest)
        wrapper.style.width = `${currentSizesRef.current[id]}px`;
        wrapper.style.height = `${currentSizesRef.current[id]}px`;
        wrapper.style.transform = "none";
      } else {
        delete itemWrappersRef.current[id];
        delete itemTilesRef.current[id];
        delete tooltipsRef.current[id];
        delete currentSizesRef.current[id];
        delete targetSizesRef.current[id];
        delete velocitiesRef.current[id];
      }
    },
    []
  );

  // Core Analytical Spring Animation Loop (60-120 FPS Direct DOM updates, 0 React rerenders)
  const stepAnimation = useCallback(() => {
    const now = performance.now();
    const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.033);
    lastTimeRef.current = now;

    let hasPendingMovement = false;
    let maxCurrentSize = BASE_SIZE;

    const expTerm = Math.exp(-SPRING_OMEGA * dt);

    // 1. Update individual item dimensions and upward lift
    items.forEach((item) => {
      const id = item.id;
      const current = currentSizesRef.current[id] ?? BASE_SIZE;
      const target = targetSizesRef.current[id] ?? BASE_SIZE;
      const v = velocitiesRef.current[id] ?? 0;

      // Exact Analytical Critically Damped Second-Order Spring Solver
      const x0 = current - target;
      let nextSize = target + (x0 + (v + SPRING_OMEGA * x0) * dt) * expTerm;
      let nextV = (v - (v + SPRING_OMEGA * x0) * SPRING_OMEGA * dt) * expTerm;

      // Settlement check
      if (Math.abs(nextSize - target) < 0.05 && Math.abs(nextV) < 0.05) {
        nextSize = target;
        nextV = 0;
      } else {
        hasPendingMovement = true;
      }

      currentSizesRef.current[id] = nextSize;
      velocitiesRef.current[id] = nextV;
      if (nextSize > maxCurrentSize) {
        maxCurrentSize = nextSize;
      }

      // Update item wrapper dimensions and upward lift
      // Centered flex layout + translateY(-lift) ensures icons are centered at idle and grow 100% upward when magnified
      const wrapper = itemWrappersRef.current[id];
      if (wrapper) {
        const sizeDelta = nextSize - BASE_SIZE;
        const lift = sizeDelta * 0.5;

        wrapper.style.width = `${nextSize}px`;
        wrapper.style.height = `${nextSize}px`;
        wrapper.style.transform = lift > 0.05 ? `translateY(-${lift.toFixed(2)}px)` : "none";
      }

      // Proportional corner radius on inner icon tile
      const tile = itemTilesRef.current[id];
      if (tile && item.iconType !== "trash") {
        const radius = Math.round((nextSize / BASE_SIZE) * 11);
        tile.style.borderRadius = `${radius}px`;
      }
    });

    const intensity = Math.max(0, Math.min(1, (maxCurrentSize - BASE_SIZE) / (MAX_SIZE - BASE_SIZE)));

    // 2. Localized Glass Lift Animation (Follows magnification peak horizontally with soft radial mask)
    const localGlass = localGlassRef.current;
    if (localGlass) {
      const currentGX = currentGlassXRef.current;
      const targetGX = targetGlassXRef.current;
      const vG = glassVelRef.current;

      const gx0 = currentGX - targetGX;
      let nextGX = targetGX + (gx0 + (vG + SPRING_OMEGA * gx0) * dt) * expTerm;
      let nextGV = (vG - (vG + SPRING_OMEGA * gx0) * SPRING_OMEGA * dt) * expTerm;

      if (Math.abs(nextGX - targetGX) < 0.1 && Math.abs(nextGV) < 0.1) {
        nextGX = targetGX;
        nextGV = 0;
      } else {
        hasPendingMovement = true;
      }

      currentGlassXRef.current = nextGX;
      glassVelRef.current = nextGV;

      localGlass.style.left = `${nextGX}px`;
      localGlass.style.opacity = `${(intensity * 0.35).toFixed(3)}`;
    }

    // 3. Compact Main Dock Shelf (Low-amplitude upward expansion)
    const shelf = shelfRef.current;
    if (shelf) {
      const currentHeight = IDLE_SHELF_HEIGHT + intensity * (MAX_SHELF_HEIGHT - IDLE_SHELF_HEIGHT);
      const currentPaddingX = IDLE_SHELF_PADDING_X + intensity * (MAX_SHELF_PADDING_X - IDLE_SHELF_PADDING_X);
      const currentRadius = IDLE_SHELF_RADIUS + intensity * (MAX_SHELF_RADIUS - IDLE_SHELF_RADIUS);

      shelf.style.height = `${currentHeight}px`;
      shelf.style.paddingLeft = `${currentPaddingX}px`;
      shelf.style.paddingRight = `${currentPaddingX}px`;
      shelf.style.borderRadius = `${currentRadius}px`;
    }

    if (hasPendingMovement) {
      rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
    } else {
      rafIdRef.current = null;
    }
  }, [items]);

  useEffect(() => {
    stepAnimationRef.current = stepAnimation;
  }, [stepAnimation]);

  // Recalculate targets given a pointer X & Y
  const updateTargetsFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const shelf = shelfRef.current;
      const container = containerRef.current;
      if (!shelf || !container) return;

      const shelfRect = shelf.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Vertical Proximity Factor (smooth decay above shelf in buffer zone)
      let vFactor = 1.0;
      if (clientY < shelfRect.top) {
        const distAbove = shelfRect.top - clientY;
        if (distAbove > PROXIMITY_ZONE_TOP) {
          vFactor = 0;
        } else {
          vFactor = Math.max(0, 1 - (distAbove / PROXIMITY_ZONE_TOP) * 0.40);
        }
      } else if (clientY > shelfRect.bottom + 20) {
        vFactor = 0;
      }

      let closestId: string | null = null;
      let closestDist = Infinity;

      // Center of localized glass relative to container
      const relativePointerX = clientX - containerRect.left;
      targetGlassXRef.current = Math.max(
        LOCAL_GLASS_WIDTH / 2,
        Math.min(containerRect.width - LOCAL_GLASS_WIDTH / 2, relativePointerX)
      );

      items.forEach((item) => {
        const wrapper = itemWrappersRef.current[item.id];
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distX = Math.abs(clientX - centerX);

        if (distX < closestDist) {
          closestDist = distX;
          closestId = item.id;
        }

        // Continuous Cosine Magnification Mapping
        if (distX < INFLUENCE_RADIUS && vFactor > 0) {
          const cosVal = Math.cos((distX / INFLUENCE_RADIUS) * (Math.PI / 2));
          targetSizesRef.current[item.id] = BASE_SIZE + (MAX_SIZE - BASE_SIZE) * cosVal * vFactor;
        } else {
          targetSizesRef.current[item.id] = BASE_SIZE;
        }
      });

      // Tooltip visibility (only nearest item within direct hover range, hidden when socials popup is open)
      const shouldShowTooltip =
        !socialsOpen && closestDist <= 38 && vFactor >= 0.4 && clientY <= shelfRect.bottom + 10;
      const targetTooltipId = shouldShowTooltip ? closestId : null;

      if (activeTooltipIdRef.current !== targetTooltipId) {
        if (activeTooltipIdRef.current) {
          const prevEl = tooltipsRef.current[activeTooltipIdRef.current];
          if (prevEl) {
            prevEl.style.opacity = "0";
            prevEl.style.transform = "translateX(-50%) translateY(4px)";
          }
        }
        if (targetTooltipId) {
          const nextEl = tooltipsRef.current[targetTooltipId];
          if (nextEl) {
            nextEl.style.opacity = "1";
            nextEl.style.transform = "translateX(-50%) translateY(0)";
          }
        }
        activeTooltipIdRef.current = targetTooltipId;
      }

      // Start spring loop if dormant
      if (!rafIdRef.current) {
        lastTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
      }
    },
    [items, socialsOpen]
  );

  // Pointer Movement in Proximity Zone
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingProject || prefersReducedMotion) return;
    isPointerInZoneRef.current = true;
    lastPointerXRef.current = e.clientX;

    // FREEZE MAGNIFICATION when Socials popup is open: ignore pointer movement
    if (socialsOpen) return;

    updateTargetsFromPointer(e.clientX, e.clientY);
  };

  // Pointer Leaves Proximity Zone
  const handlePointerLeave = () => {
    isPointerInZoneRef.current = false;
    lastPointerXRef.current = null;

    // Do NOT collapse if Socials popup is open (remains frozen)
    if (socialsOpen) return;

    items.forEach((item) => {
      targetSizesRef.current[item.id] = BASE_SIZE;
    });

    // Hide tooltips
    if (activeTooltipIdRef.current) {
      const prevEl = tooltipsRef.current[activeTooltipIdRef.current];
      if (prevEl) {
        prevEl.style.opacity = "0";
        prevEl.style.transform = "translateX(-50%) translateY(4px)";
      }
      activeTooltipIdRef.current = null;
    }

    // Trigger smooth settle back to idle
    if (!rafIdRef.current) {
      lastTimeRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
    }
  };

  // Handle Socials Toggle and Freeze State
  const handleToggleSocials = useCallback(() => {
    setSocialsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        // HIDE ALL TOOLTIPS immediately on popup open
        if (activeTooltipIdRef.current) {
          const prevEl = tooltipsRef.current[activeTooltipIdRef.current];
          if (prevEl) {
            prevEl.style.opacity = "0";
            prevEl.style.transform = "translateX(-50%) translateY(4px)";
          }
          activeTooltipIdRef.current = null;
        }

        // Find socials icon element to center the frozen local glass if pointer was not recorded
        const socialsItem = items.find((i) => i.actionType === "toggleSocials");
        if (socialsItem && containerRef.current) {
          const wrapper = itemWrappersRef.current[socialsItem.id];
          if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            targetGlassXRef.current = rect.left + rect.width / 2 - containerRect.left;
          }
        }
      } else {
        // On close, smoothly reconnect to live pointer if inside zone, else settle to idle
        if (!isPointerInZoneRef.current) {
          items.forEach((item) => {
            targetSizesRef.current[item.id] = BASE_SIZE;
          });
        }
        if (!rafIdRef.current) {
          lastTimeRef.current = performance.now();
          rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
        }
      }
      return nextState;
    });
  }, [items]);

  const handleCloseSocials = useCallback(() => {
    setSocialsOpen(false);
    if (!isPointerInZoneRef.current) {
      items.forEach((item) => {
        targetSizesRef.current[item.id] = BASE_SIZE;
      });
    }
    if (!rafIdRef.current) {
      lastTimeRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
    }
  }, [items]);

  // Click outside listener for Socials popup
  useEffect(() => {
    if (!socialsOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      handleCloseSocials();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseSocials();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [socialsOpen, handleCloseSocials]);

  // Settle immediately when dragging desktop project icons
  useEffect(() => {
    if (isDraggingProject) {
      items.forEach((item) => {
        targetSizesRef.current[item.id] = BASE_SIZE;
      });
      if (activeTooltipIdRef.current) {
        const prevEl = tooltipsRef.current[activeTooltipIdRef.current];
        if (prevEl) {
          prevEl.style.opacity = "0";
          prevEl.style.transform = "translateX(-50%) translateY(4px)";
        }
        activeTooltipIdRef.current = null;
      }
      if (!rafIdRef.current) {
        lastTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(() => stepAnimationRef.current());
      }
    }
  }, [isDraggingProject, items, stepAnimation]);

  // Clean up animation loop on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-prevent-workspace-wheel="true"
      data-workspace-scroll-lock="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="fixed bottom-[20px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center select-none pt-[35px] -mt-[35px] pointer-events-auto"
      style={{ width: "max-content" }}
    >
      {/* 1. Localized Glass Lift behind Magnified Icon Cluster */}
      <div
        ref={localGlassRef}
        style={{
          opacity: 0,
          width: `${LOCAL_GLASS_WIDTH}px`,
          height: `${LOCAL_GLASS_HEIGHT}px`,
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "0px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 60%, black 25%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 60%, black 25%, transparent 80%)",
          pointerEvents: "none"
        }}
        className={`absolute z-0 rounded-[28px] pointer-events-none will-change-[left,opacity,transform] ${
          isLight
            ? "bg-[#423B34]/35 backdrop-blur-[16px] border border-white/20 shadow-[0_4px_24px_rgba(65,45,25,0.14)]"
            : "bg-white/[0.10] backdrop-blur-[20px] border border-white/14 shadow-[0_8px_32px_rgba(0,0,0,0.30)]"
        }`}
      />

      {/* 2. Compact Main Glass Shelf (Vertically Centered Items at Idle) */}
      <nav
        ref={shelfRef}
        aria-label="Application Dock"
        style={{
          height: `${IDLE_SHELF_HEIGHT}px`,
          paddingLeft: `${IDLE_SHELF_PADDING_X}px`,
          paddingRight: `${IDLE_SHELF_PADDING_X}px`,
          borderRadius: `${IDLE_SHELF_RADIUS}px`
        }}
        className={`dock-shelf relative z-10 flex items-center gap-[5px] select-none overflow-visible w-fit will-change-[height,padding,border-radius] ${
          isLight
            ? "bg-[#423B34]/52 backdrop-blur-[22px] backdrop-saturate-[135%] border border-white/18 shadow-[0_12px_32px_rgba(65,45,25,0.18)]"
            : "bg-[#0A0A0C]/70 backdrop-blur-[24px] backdrop-saturate-[125%] border border-white/10 shadow-[0_14px_36px_rgba(0,0,0,0.36)]"
        }`}
      >
        {items.map((item, idx) => (
          <React.Fragment key={item.id}>
            <DockIcon
              item={item}
              index={idx}
              registerItem={registerItem}
              isLight={isLight}
              socialsOpen={socialsOpen}
              onToggleSocials={handleToggleSocials}
              onCloseSocials={handleCloseSocials}
              prefersReducedMotion={prefersReducedMotion}
            />
            {item.isSeparatorAfter && <DockSeparator />}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
};
