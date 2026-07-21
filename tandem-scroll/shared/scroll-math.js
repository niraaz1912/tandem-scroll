(function exposeScrollMath() {
  function finiteNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, finiteNumber(value)));
  }

  function scrollableDistance(totalSize, viewportSize) {
    return Math.max(
      0,
      finiteNumber(totalSize) - finiteNumber(viewportSize),
    );
  }

  function ratioFromOffset(offset, totalSize, viewportSize) {
    const distance = scrollableDistance(totalSize, viewportSize);
    return distance === 0 ? 0 : clamp(finiteNumber(offset) / distance);
  }

  function offsetFromRatio(ratio, totalSize, viewportSize) {
    return clamp(ratio) * scrollableDistance(totalSize, viewportSize);
  }

  function normalizedPosition(metrics) {
    return {
      x: ratioFromOffset(
        metrics.scrollLeft,
        metrics.scrollWidth,
        metrics.clientWidth,
      ),
      y: ratioFromOffset(
        metrics.scrollTop,
        metrics.scrollHeight,
        metrics.clientHeight,
      ),
    };
  }

  function offsetsFromPosition(position, metrics) {
    return {
      left: offsetFromRatio(
        position.x,
        metrics.scrollWidth,
        metrics.clientWidth,
      ),
      top: offsetFromRatio(
        position.y,
        metrics.scrollHeight,
        metrics.clientHeight,
      ),
    };
  }

  function closeEnough(first, second, epsilon = 0.003) {
    return Math.abs(finiteNumber(first) - finiteNumber(second)) <= epsilon;
  }

  globalThis.TandemScrollMath = Object.freeze({
    clamp,
    closeEnough,
    normalizedPosition,
    offsetFromRatio,
    offsetsFromPosition,
    ratioFromOffset,
    scrollableDistance,
  });
}());
