import React, { useRef, useState, useCallback, useEffect } from 'react';

interface TouchJoystickProps {
  onMove: (x: number, y: number) => void;
  size?: number;
}

export const TouchJoystick: React.FC<TouchJoystickProps> = React.memo(({ onMove, size = 90 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const radius = size / 2;
  const maxDistance = Math.max(18, radius - 16);

  const handleStart = (clientX: number, clientY: number, identifier: number | null) => {
    if (!containerRef.current) return;
    touchIdRef.current = identifier;
    setActive(true);
    handleMove(clientX, clientY);
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist <= 0.001) {
      setKnobPos({ x: 0, y: 0 });
      onMove(0, 0);
      return;
    }

    const clampedDist = Math.min(dist, maxDistance);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: knobX, y: knobY });

    // Normalized outputs (-1 to 1)
    const normX = knobX / maxDistance;
    const normY = knobY / maxDistance;
    onMove(normX, normY);
  }, [maxDistance, onMove]);

  const handleEnd = useCallback(() => {
    touchIdRef.current = null;
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  // Touch event handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      handleStart(touch.clientX, touch.clientY, touch.identifier);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          handleEnd();
          break;
        }
      }
    }
  };

  // Mouse event handlers for desktop testing
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY, null);

    const onMouseMove = (ev: MouseEvent) => {
      handleMove(ev.clientX, ev.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isCompact = size <= 95;

  return (
    <div className="flex flex-col items-center select-none pointer-events-auto">
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onMouseDown}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          touchAction: 'none',
        }}
        className={`relative rounded-full flex items-center justify-center transition-all duration-150 ${
          active
            ? 'bg-amber-950/40 border-2 border-amber-400/80 shadow-[0_0_14px_rgba(245,195,48,0.28)]'
            : 'bg-stone-900/45 border border-amber-500/30'
        }`}
      >
        {/* Subtle cardinal guide crosshair */}
        <div className="absolute w-[78%] h-px bg-amber-400/20 pointer-events-none" />
        <div className="absolute h-[78%] w-px bg-amber-400/20 pointer-events-none" />

        {/* Outer subtle ring */}
        <div className="absolute inset-2 rounded-full border border-dashed border-amber-400/20 pointer-events-none" />

        {/* Joystick Thumb Knob */}
        <div
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            touchAction: 'none',
          }}
          className={`${isCompact ? 'w-9 h-9' : 'w-10 h-10'} rounded-full flex items-center justify-center transition-transform duration-75 pointer-events-none shadow-lg ${
            active
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 scale-105 ring-2 ring-amber-300'
              : 'bg-gradient-to-br from-stone-700 to-stone-900 border border-amber-400/40 text-amber-300'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-amber-200/90 shadow-sm" />
        </div>
      </div>
    </div>
  );
});
