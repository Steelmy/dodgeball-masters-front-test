import { EventEmitter } from "../utils/EventEmitter.js";

/**
 * InputManager
 * Handles keyboard and mouse input
 */

export class InputManager extends EventEmitter {
  constructor() {
    super();

    this.keys = new Map();
    this.mouse = {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      deltaX: 0,
      deltaY: 0,
      leftButton: false,
      rightButton: false,
    };

    this.isPointerLocked = false;
    this.mouseSensitivity = 0.002;

    // Default key bindings
    this.bindings = {
      forward: "KeyW",
      backward: "KeyS",
      left: "KeyA",
      right: "KeyD",
      jump: "Space",
      pause: "Escape", // Added pause binding
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Keyboard events
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Mouse events
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);

    // Pointer lock events
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onPointerLockError = this.onPointerLockError.bind(this);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);

    // Prevent context menu on right click
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  onKeyDown(event) {
    if (event.repeat) return;

    const key = event.code;
    this.keys.set(key, true);
    this.emit("keydown", { key, event });
  }

  onKeyUp(event) {
    const key = event.code;
    this.keys.set(key, false);
    this.emit("keyup", { key, event });
  }

  onMouseMove(event) {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    this.mouse.normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.normalizedY = -(event.clientY / window.innerHeight) * 2 + 1;

    // Capture movement delta for pointer lock (Accumulate, don't overwrite)
    this.mouse.deltaX += event.movementX || 0;
    this.mouse.deltaY += event.movementY || 0;

    this.emit("mousemove", this.mouse);
  }

  onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement !== null;
    this.emit("pointerlockchange", this.isPointerLocked);
  }

  onPointerLockError() {
    console.warn("Pointer lock failed/error");
    this.emit("pointerlockerror");
  }

  onMouseDown(event) {
    if (event.button === 0) {
      this.mouse.leftButton = true;
      this.emit("leftclick", this.mouse);
    } else if (event.button === 2) {
      this.mouse.rightButton = true;
      this.emit("rightclick", this.mouse);
    }
  }

  onMouseUp(event) {
    if (event.button === 0) {
      this.mouse.leftButton = false;
    } else if (event.button === 2) {
      this.mouse.rightButton = false;
    }
  }

  /**
   * Check if a key is currently pressed
   */
  isKeyPressed(keyCode) {
    return this.keys.get(keyCode) || false;
  }

  /**
   * Get movement input as a vector (-1 to 1)
   */
  getMovementInput() {
    let x = 0;
    let z = 0;

    if (
      this.isKeyPressed(this.bindings.forward) ||
      this.isKeyPressed("ArrowUp")
    )
      z -= 1;
    if (
      this.isKeyPressed(this.bindings.backward) ||
      this.isKeyPressed("ArrowDown")
    )
      z += 1;
    if (this.isKeyPressed(this.bindings.left) || this.isKeyPressed("ArrowLeft"))
      x -= 1;
    if (
      this.isKeyPressed(this.bindings.right) ||
      this.isKeyPressed("ArrowRight")
    )
      x += 1;

    // Normalize diagonal movement
    if (x !== 0 && z !== 0) {
      const length = Math.sqrt(x * x + z * z);
      x /= length;
      z /= length;
    }

    return { x, z };
  }

  /**
   * Check if jump is pressed (Space)
   */
  isJumpPressed() {
    return this.isKeyPressed(this.bindings.jump);
  }

  /**
   * Check if deflect action is pressed (Right Click)
   */
  isDeflectPressed() {
    return this.mouse.rightButton;
  }

  /**
   * Get mouse position
   */
  getMousePosition() {
    return { ...this.mouse };
  }

  /**
   * Get mouse movement delta and reset it
   */
  getMouseDelta() {
    const delta = {
      x: this.mouse.deltaX * this.mouseSensitivity,
      y: this.mouse.deltaY * this.mouseSensitivity,
    };
    // Reset delta after reading
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
    return delta;
  }

  /**
   * Get raw mouse movement delta (for drag mechanic)
   * Does NOT reset delta - call getMouseDelta() after to consume
   */
  getRawMouseDelta() {
    return {
      x: this.mouse.deltaX,
      y: this.mouse.deltaY,
    };
  }

  /**
   * Request pointer lock on an element
   */
  requestPointerLock(element) {
    if (element && element.requestPointerLock) {
      element.requestPointerLock();
    }
  }

  /**
   * Exit pointer lock
   */
  exitPointerLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /**
   * Check if pointer is locked
   */
  isLocked() {
    return this.isPointerLocked;
  }

  setBinding(action, keyCode) {
    if (this.bindings[action]) {
      this.bindings[action] = keyCode;
    }
  }

  getBinding(action) {
    return this.bindings[action];
  }

  resetBindings() {
    this.bindings = {
      forward: "KeyW",
      backward: "KeyS",
      left: "KeyA",
      right: "KeyD",
      jump: "Space",
      pause: "Escape",
    };
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.clear();
  }
}
