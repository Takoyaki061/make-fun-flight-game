// Keyboard and mouse input. The stick is W/S or Up/Down for pitch (climb /
// descend) and A/D or Left/Right for bank; the throttle lives on Shift (more)
// and Control (less), on the mouse wheel, and on keys 1..9 as presets. The
// mouse steers by position and sets pitch by height. Actions are
// edge-triggered and taken once per frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let throttle = 0.55;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let mouseActive = false;
  let wheelDelta = 0;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    const key = event.key.toLowerCase();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') actions |= ACTION_CONFIRM;
    else if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    else if (key === 'r') actions |= ACTION_RESTART;
    else if (key === 'm') actions |= ACTION_MUTE;
    else if (/^[1-9]$/.test(key)) throttle = Number(key) / 10;
  }

  function keyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouseY = (event.clientY - rect.top) / Math.max(1, rect.height);
    mouseActive = true;
  }

  function mouseDown(event) {
    event.preventDefault();
    mouseMove(event);
    actions |= ACTION_CONFIRM;
  }

  function wheel(event) {
    event.preventDefault();
    wheelDelta += event.deltaY > 0 ? -0.06 : 0.06;
  }

  function blur() {
    keys.clear();
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  canvas.addEventListener('wheel', wheel, { passive: false });

  function has(...names) {
    return names.some((name) => keys.has(name));
  }

  return {
    /** Steering -1..1 from keys, or from the mouse when it moved recently. */
    steer() {
      if (has('a', 'arrowleft')) return -1;
      if (has('d', 'arrowright')) return 1;
      if (mouseActive) return Math.max(-1, Math.min(1, (mouseX - 0.5) * 2.4));
      return 0;
    },
    /** Pitch -1 (climb) .. 1 (descend) from keys, or from the mouse height. */
    pitch() {
      if (has('w', 'arrowup')) return -1;
      if (has('s', 'arrowdown')) return 1;
      if (mouseActive) return Math.max(-1, Math.min(1, (mouseY - 0.5) * 2.2));
      return 0;
    },
    /** Throttle 0..1: Shift raises, Control lowers, wheel trims. Held between calls. */
    throttle(dt) {
      if (has('shift')) throttle = Math.min(1, throttle + dt * 0.6);
      if (has('control', 'c')) throttle = Math.max(0, throttle - dt * 0.6);
      if (wheelDelta !== 0) {
        throttle = Math.max(0, Math.min(1, throttle + wheelDelta));
        wheelDelta = 0;
      }
      return throttle;
    },
    setThrottle(value) { throttle = Math.max(0, Math.min(1, value)); },
    resetThrottle() { throttle = 0.55; mouseActive = false; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
