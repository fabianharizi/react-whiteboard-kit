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
// `dblclick` event: selecting an element mounts the SelectionBox overlay on top
// of it, so the two clicks of a double-click land on different DOM nodes owned
// by different usePointer instances. A per-instance (or native) double-click
// can't survive that hand-off — the record has to be shared.
const DOUBLE_MS = 400;
const DOUBLE_SLOP = 6;          // screen px — a double-click may drift slightly

// ...but shared across the WHITEBOARD, not the module. That's what a session is:
// the state every usePointer on one canvas has to agree about, scoped so two
// whiteboards on a page can't see each other's. <Whiteboard> makes one and hands
// it to every tool hook and to SelectionBox.
//
// The state is CLOSED OVER rather than exposed as fields, for two reasons. The
// rules that read it (what pairs as a double-click, what counts as idle) belong
// with the state, not scattered across callers. And a session is handed around
// as a parameter — mutating a passed-in object's fields is what
// react-hooks/immutability rightly rejects, while calling a method that mutates
// its own closure is ordinary. Nothing here renders, so none of it is state.
export function createPointerSession() {
  // When and where the last click landed.
  let lastClick = { time: 0, x: 0, y: 0 };

  // How many pointer gestures are in flight on this canvas.
  let gestures = 0;

  return {
    // Does this click pair with the previous one? Consumes the pair when it
    // does, so a third click opens a fresh one rather than chaining.
    pairClick(x, y, now) {
      const isDouble = now - lastClick.time < DOUBLE_MS
        && Math.hypot(x - lastClick.x, y - lastClick.y) < DOUBLE_SLOP;
      lastClick = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, x, y };
      return isDouble;
    },

    beginGesture() { gestures += 1 },
    endGesture() { gestures -= 1 },

    // No gesture in flight. A gesture is an uncommitted transaction — a drag
    // snapshots geometry at pointerdown and writes "snapshot + total delta" on
    // every move — so undo asks before running (see useCommands).
    isIdle() { return gestures === 0 },
  };
}

// For a usePointer used outside a <Whiteboard>. Keeps a stray instance working
// rather than crashing; anything inside the engine passes its instance session.
const UNOWNED_SESSION = createPointerSession();

export default function usePointer(ref, callback, session = UNOWNED_SESSION) {
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

  // Whether this instance currently holds a counted gesture. A gesture has five
  // possible exits (pointerup, the missed-pointerup safety net, cancel, lost
  // capture, and the effect cleanup that runs on unmount or when `active` flips
  // off), several of which can fire for the same gesture — so the count is
  // guarded here rather than trusting any one of them to be the last word.
  const counted = useRef(false);

  const beginGesture = () => {
    if (counted.current) return;
    counted.current = true;
    session.beginGesture();
  };

  const endGesture = () => {
    if (!counted.current) return;
    counted.current = false;
    session.endGesture();
  };

  // Cursor type handling

  const setCursor = (type) => {ref.current.style.cursor = type ?? latestCallback.current.cursor ?? 'default'}

  // Gets starting position when pointer is down
  const handleDown = (e) => {
    if (!e.isPrimary || e.button !== 0 || !latestCallback.current.active) return;
    
    e.stopPropagation();
    ref.current.setPointerCapture(e.pointerId)
    sawDown.current = true;
    beginGesture();

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
      endGesture();
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

    // Before onUp, not after: the gesture is over at this point, and a tool's
    // onUp legitimately writes history (a draw commits here). Ending first also
    // means a throwing callback can't leak the count.
    endGesture();

    latestCallback.current.onUp?.(
      pointer.current = {
        ...pointer.current,
        isDown: false
    }, setCursor, e)
  };

  // Capture can be lost for reasons other than pointerup (element detach, browser
  // intervention). Reset so a subsequent hover can't resume a phantom drag.
  const handleLostCapture = () => {
    endGesture();
    pointer.current = { ...pointer.current, isDown: false };
  };

  // Sets isDown to false when pointer is up
  const handleCancel = (e) => {
    if (!e.isPrimary || !latestCallback.current.active) return;
    
    sawDown.current = false;
    endGesture();
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
    const isDouble = session.pairClick(e.clientX, e.clientY, performance.now());

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
      // Unmount, or `active` flipping off mid-gesture. Either way the gesture
      // this instance was holding is over and its count must not leak.
      endGesture();
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