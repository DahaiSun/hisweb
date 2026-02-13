"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 6;

type DragScrollProps = {
  className?: string;
  children: ReactNode;
  initialPosition?: "start" | "end";
};

export function DragScroll({ className, children, initialPosition = "start" }: DragScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const applyInitialScroll = () => {
      node.scrollLeft = initialPosition === "end" ? node.scrollWidth : 0;
    };

    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(applyInitialScroll);
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [initialPosition]);

  const finishDrag = () => {
    const node = containerRef.current;
    if (node) {
      node.classList.remove("is-dragging");
      if (pointerIdRef.current !== null && node.hasPointerCapture(pointerIdRef.current)) {
        node.releasePointerCapture(pointerIdRef.current);
      }
    }
    draggingRef.current = false;
    pointerIdRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const node = containerRef.current;
        if (!node) return;

        draggingRef.current = true;
        pointerIdRef.current = event.pointerId;
        startXRef.current = event.clientX;
        startScrollLeftRef.current = node.scrollLeft;
        movedRef.current = false;

        node.setPointerCapture(event.pointerId);
        node.classList.add("is-dragging");
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        const node = containerRef.current;
        if (!node) return;

        const deltaX = event.clientX - startXRef.current;
        if (!movedRef.current && Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;

        movedRef.current = true;
        node.scrollLeft = startScrollLeftRef.current - deltaX;
        event.preventDefault();
      }}
      onPointerUp={() => {
        if (!draggingRef.current) return;
        suppressClickRef.current = movedRef.current;
        finishDrag();
      }}
      onPointerCancel={() => {
        if (!draggingRef.current) return;
        suppressClickRef.current = movedRef.current;
        finishDrag();
      }}
      onLostPointerCapture={() => {
        if (!draggingRef.current) return;
        suppressClickRef.current = movedRef.current;
        finishDrag();
      }}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
