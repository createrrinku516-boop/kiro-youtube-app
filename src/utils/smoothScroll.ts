// @ts-nocheck
// Apple-style Dynamic Smooth Scroll with Inertia (Lerp-based)
export const initSmoothScroll = () => {
  if (typeof window === 'undefined') return;

  // Only apply smooth scroll to desktop browsers with mouse wheels (skip mobile touch)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) return;

  let targetScrollY = window.scrollY;
  let currentScrollY = window.scrollY;
  let isMoving = false;
  let animationFrameId = null;

  const ease = 0.08; // Smoothness factor (0.08 is perfect: slow, fluid, and dynamic)

  const updateScroll = () => {
    currentScrollY += (targetScrollY - currentScrollY) * ease;
    
    if (Math.abs(targetScrollY - currentScrollY) < 0.5) {
      currentScrollY = targetScrollY;
      window.scrollTo(0, currentScrollY);
      isMoving = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      return;
    }

    window.scrollTo(0, currentScrollY);
    animationFrameId = requestAnimationFrame(updateScroll);
  };

  const handleWheel = (e) => {
    // Support nested scrollable panels (e.g. Sidebar, comments, dialogs) by climbing DOM tree
    let target = e.target;
    while (target && target !== document.body && target !== document.documentElement) {
      const style = window.getComputedStyle(target);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight) {
        // Let native scroll handle it
        return;
      }
      target = target.parentElement;
    }

    e.preventDefault();

    // Scale delta for slow + smooth transition
    const delta = e.deltaY;
    targetScrollY += delta * 0.9;
    
    // Bounds clamping
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targetScrollY = Math.max(0, Math.min(targetScrollY, maxScroll));

    if (!isMoving) {
      isMoving = true;
      animationFrameId = requestAnimationFrame(updateScroll);
    }
  };

  window.addEventListener('wheel', handleWheel, { passive: false });

  // If user scrolls using scrollbar or keyboard, sync our variables
  const handleScroll = () => {
    if (!isMoving) {
      targetScrollY = window.scrollY;
      currentScrollY = window.scrollY;
    }
  };
  window.addEventListener('scroll', handleScroll);

  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('scroll', handleScroll);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  };
};
