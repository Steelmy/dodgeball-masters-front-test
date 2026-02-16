import * as THREE from 'three';

/**
 * Math Utilities
 * Helper functions for game calculations
 */

export const MathUtils = {
  /**
   * Clamp a value between min and max
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Linear interpolation
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  },

  /**
   * Calculate distance between two 3D points
   */
  distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  /**
   * Calculate distance on XZ plane (ignoring Y)
   */
  distanceXZ(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  },

  /**
   * Get direction vector from point A to point B (normalized)
   */
  directionTo(from, to) {
    const direction = new THREE.Vector3(
      to.x - from.x,
      to.y - from.y,
      to.z - from.z
    );
    return direction.normalize();
  },

  /**
   * Get direction vector on XZ plane (Y = 0)
   */
  directionToXZ(from, to) {
    const direction = new THREE.Vector3(
      to.x - from.x,
      0,
      to.z - from.z
    );
    return direction.normalize();
  },

  /**
   * Check if point B is within cone from point A facing direction
   * @param {THREE.Vector3} origin - Cone origin
   * @param {THREE.Vector3} direction - Cone direction (normalized)
   * @param {THREE.Vector3} point - Point to check
   * @param {number} angle - Half-angle of cone in radians
   * @param {number} range - Maximum range
   */
  isInCone(origin, direction, point, angle, range) {
    const toPoint = new THREE.Vector3().subVectors(point, origin);
    const distance = toPoint.length();

    if (distance > range) return false;
    if (distance === 0) return true;

    toPoint.normalize();
    const dot = direction.dot(toPoint);
    const coneAngle = Math.acos(MathUtils.clamp(dot, -1, 1));

    return coneAngle <= angle;
  },

  /**
   * Get angle between two vectors
   */
  angleBetween(a, b) {
    const dot = a.dot(b);
    return Math.acos(MathUtils.clamp(dot, -1, 1));
  },

  /**
   * Random float between min and max
   */
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  },

  /**
   * Random integer between min and max (inclusive)
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Pick random element from array
   */
  randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  },

  /**
   * Smooth damp (for smooth camera/object following)
   */
  smoothDamp(current, target, velocity, smoothTime, maxSpeed, deltaTime) {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    let change = current - target;
    const originalTo = target;

    const maxChange = maxSpeed * smoothTime;
    change = MathUtils.clamp(change, -maxChange, maxChange);
    target = current - change;

    const temp = (velocity + omega * change) * deltaTime;
    velocity = (velocity - omega * temp) * exp;
    let output = target + (change + temp) * exp;

    if (originalTo - current > 0 === output > originalTo) {
      output = originalTo;
      velocity = (output - originalTo) / deltaTime;
    }

    return { value: output, velocity };
  },

  /**
   * Convert degrees to radians
   */
  degToRad(degrees) {
    return degrees * (Math.PI / 180);
  },

  /**
   * Convert radians to degrees
   */
  radToDeg(radians) {
    return radians * (180 / Math.PI);
  },

  /**
   * Calculate distance from a point to a line segment
   * @param {THREE.Vector3} point - The point
   * @param {THREE.Vector3} start - Segment start point
   * @param {THREE.Vector3} end - Segment end point
   */
  distanceToSegment(point, start, end) {
    const ab = new THREE.Vector3().subVectors(end, start);
    const ap = new THREE.Vector3().subVectors(point, start);

    const lenSq = ab.lengthSq();
    if (lenSq === 0) return ap.length(); // start and end are the same

    // Project point onto line, clamped between 0 and 1
    const t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq));

    // Closest point on segment
    const closest = new THREE.Vector3().copy(start).addScaledVector(ab, t);

    return point.distanceTo(closest);
  },
};
