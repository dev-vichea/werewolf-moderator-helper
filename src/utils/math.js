/**
 * Mathematical utilities for responsive circular/elliptical layout
 */

/**
 * Compute cumulative arc length of ellipse for perfectly even card spacing along the table perimeter
 * @param {number} total Number of players
 * @param {number} a Semi-major axis (radiusX)
 * @param {number} b Semi-minor axis (radiusY)
 * @returns {number[]} Array of angles in radians
 */
export function getEvenlySpacedEllipseAngles(total, a, b) {
  const samples = 720;
  const cumDist = [0];
  let prevX = a * Math.cos(-Math.PI / 2);
  let prevY = b * Math.sin(-Math.PI / 2);
  for (let i = 1; i <= samples; i++) {
    const th = (i / samples) * 2 * Math.PI - Math.PI / 2;
    const x = a * Math.cos(th);
    const y = b * Math.sin(th);
    cumDist.push(cumDist[i - 1] + Math.hypot(x - prevX, y - prevY));
    prevX = x;
    prevY = y;
  }
  const totalPerimeter = cumDist[samples];
  const angles = [];
  for (let i = 0; i < total; i++) {
    const targetDist = (i / total) * totalPerimeter;
    let low = 0, high = samples;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumDist[mid] < targetDist) low = mid + 1;
      else high = mid;
    }
    const th = ((low / samples) * 2 * Math.PI) - Math.PI / 2;
    angles.push(th);
  }
  return angles;
}
