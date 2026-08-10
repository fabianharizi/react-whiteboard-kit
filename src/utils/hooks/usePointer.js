import { useRef, useEffect } from "react";

// This hook wires pointerdown/move/up listeners on ref.current and delivers them to the consumer's callbacks while active is true. Reset on deactivation.

// Callback object  {
//                    active,
//                    cursor,
//                    onDown: (p, setCursor, event) => {...},
//                    onMove: (p, setCursor, event) => {...},
//                    onUp: (p, setCursor, event) => {...},
//                    onClick / onDblClick / onCancel
//                  }
//
// `p` is a flattened snapshot in SCREEN coords — that's what every tool wants,
// and it's deliberately the whole story for all of them but one. The raw
// `event` is passed as a third argument for the cases the snapshot can't cover:
// the pen tool needs `getCoalescedEvents()`, the sub-frame samples the browser
// batched into a single pointermove, without which fast strokes come out
// faceted. Reach for the snapshot first; the event is the escape hatch.

// Double-click is SYNTHESIZED from two clicks rather than taken from the native
// `dblclick` event, and the bookkeeping is module-scoped on purpose: selecting
// an element mounts the SelectionBox overlay on top of it, so the two clicks of
// a double-click land on different DOM nodes owned by different usePointer
// instances. A per-instance (or native) double-click can't survive that
// hand-off; an app-wide "when/where was the last click" can.
const DOUBLE_MS = 400;
const DOUBLE_SLOP = 6;          // screen px — a double-click may drift slightly
let lastClick = { time: 0, x: 0, y: 0 };

export default function usePointer(ref, callback) {
  const pointer = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    hasDragged: false,
    target: null
  });

  const latestCallback = useRef(callback);
  useEffect(() => { latestCallback.current = callback; });

  // True once this instance has seen the pointerdown of the current gesture. Guards
  // onClick against the stray `click` that fires when a tool activates mid-gesture
  // (e.g. a draw tool commits and switches to select, whose click listener then
  // catches the draw's trailing click with a stale target).
  const sawDown = useRef(false);

  // Cursor type handling

  const setCursor = (type) => {ref.current.style.cursor = type ?? latestCallback.current.cursor ?? 'default'}

  // Gets starting position when pointer is down
  const handleDown = (e) => {
    if (!e.isPrimary || e.button !== 0 || !latestCallback.current.active) return;
    
    e.stopPropagation();
    ref.current.setPointerCapture(e.pointerId)
    sawDown.current = true;

    latestCallback.current.onDown?.(
      pointer.current = {
        ...pointer.current,
        isDown: true,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        hasDragged: false,
        target: e.target,
        shiftKey: e.shiftKey,
    }, setCursor, e);
  };

  // Gets current position when pointer is dragging
  const handleMove = (e) => {
    if (!e.isPrimary || !latestCallback.current.active) return;

    // Missed pointerup safety net: if we still think we're dragging but no button
    // is held, capture was lost and the up never reached us. Finalize the gesture
    // instead of resuming a phantom drag on hover.
    if (pointer.current.isDown && e.buttons === 0) {
      latestCallback.current.onUp?.(
        pointer.current = { ...pointer.current, isDown: false },
        setCursor,
        e
      );
      return;
    }

    // `target` is deliberately NOT updated here: while a pointer is captured every
    // move is retargeted to `ref`, so this would overwrite the real pointerdown
    // target (which onClick relies on) with the element.
    latestCallback.current.onMove?.(
      pointer.current = {
        ...pointer.current,
        x: e.clientX,
        y: e.clientY,
        hasDragged: pointer.current.isDown && Math.hypot(e.clientX - pointer.current.startX, e.clientY - pointer.current.startY) > 4,
        shiftKey: e.shiftKey,
    }, setCursor, e)
  };

  // Sets isDown to false when pointer is up
  const handleUp = (e) => {
    if (!e.isPrimary || !latestCallback.current.active) return;

    if (ref.current.hasPointerCapture?.(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);

    // Only finalize a gesture this instance started. A pointerup can arrive
    // without a matching pointerdown here — the press began on another element
    // (a UI button slid off), under another tool (switched away mid-press), or
    // with a non-left button that handleDown filtered — and firing onUp then
    // would hand the tool a stale pointer snapshot (phantom commits).
    if (!pointer.current.isDown) return;

    latestCallback.current.onUp?.(
      pointer.current = {
        ...pointer.current,
        isDown: false
    }, setCursor, e)
  };

  // Capture can be lost for reasons other than pointerup (element detach, browser
  // intervention). Reset so a subsequent hover can't resume a phantom drag.
  const handleLostCapture = () => {
    pointer.current = { ...pointer.current, isDown: false };
  };

  // Sets isDown to false when pointer is up
  const handleCancel = (e) => {
    if (!e.isPrimary || !latestCallback.current.active) return;
    
    sawDown.current = false;
    latestCallback.current.onCancel?.(
      pointer.current = {
        ...pointer.current,
        isDown: false
    }, setCursor)
  };

  // Gets starting position when pointer is clicked
  const handleClick = (e) => {
    if (!latestCallback.current.active) return;

    // Stop before the hasDragged short-circuit: the click that fires at the end of
    // a handle drag must not bubble to the board (it would deselect the element).
    e.stopPropagation();

    // Only act on a click whose pointerdown this instance actually saw; ignore a
    // stray click inherited from a gesture that started under another tool.
    const sawGesture = sawDown.current;
    sawDown.current = false;
    if (!sawGesture || pointer.current.hasDragged) return;

    // Second click of a pair, close enough in time and space? Consume the pair
    // (so a third click opens a fresh one) and report a double-click.
    const now = performance.now();
    const isDouble = now - lastClick.time < DOUBLE_MS
      && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < DOUBLE_SLOP;
    lastClick = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, x: e.clientX, y: e.clientY };

    // Deliberately leaves isDown alone (false since the pointerup): a click is
    // not a gesture in progress, and re-marking it down would re-arm the
    // missed-pointerup safety net into a spurious onUp on the next hover move.
    const p = pointer.current = {
      ...pointer.current,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    };

    // Falls back to onClick when this instance doesn't handle double-clicks, so
    // a double-click on plain canvas still behaves like an ordinary click.
    if (isDouble && latestCallback.current.onDblClick) latestCallback.current.onDblClick(p, setCursor);
    else latestCallback.current.onClick?.(p, setCursor);
  };


  useEffect(() => {
    if (!latestCallback.current.active) return;

    const element = ref.current;

    setCursor();

    element.addEventListener('pointerdown', handleDown);
    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerup', handleUp);
    element.addEventListener('pointercancel', handleCancel);
    element.addEventListener('lostpointercapture', handleLostCapture);
    element.addEventListener('click', handleClick);

    return () => {
      pointer.current.isDown = false;
      sawDown.current = false;
      element.style.cursor = 'default';
      element.removeEventListener('pointerdown', handleDown);
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerup', handleUp);
      element.removeEventListener('pointercancel', handleCancel);
      element.removeEventListener('lostpointercapture', handleLostCapture);
      element.removeEventListener('click', handleClick);
    };

  }, [callback.active])
}