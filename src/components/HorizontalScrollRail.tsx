import { RefObject, useEffect, useState } from 'react';

interface HorizontalScrollRailProps {
  containerRef: RefObject<HTMLElement>;
  className?: string;
}

export function HorizontalScrollRail({ containerRef, className }: HorizontalScrollRailProps) {
  const [metrics, setMetrics] = useState({ scrollWidth: 0, clientWidth: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncMetrics = () => {
      setMetrics({
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
      });
    };

    const syncFromContainer = () => {
      const rail = document.getElementById(`scroll-rail-${container.dataset.scrollRailId || ''}`);
      if (rail && rail.scrollLeft !== container.scrollLeft) {
        rail.scrollLeft = container.scrollLeft;
      }
    };

    syncMetrics();
    syncFromContainer();

    const resizeObserver = new ResizeObserver(() => {
      syncMetrics();
      syncFromContainer();
    });

    resizeObserver.observe(container);
    container.addEventListener('scroll', syncFromContainer, { passive: true });
    window.addEventListener('resize', syncMetrics);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', syncFromContainer);
      window.removeEventListener('resize', syncMetrics);
    };
  }, [containerRef]);

  const container = containerRef.current;
  if (!container || metrics.scrollWidth <= metrics.clientWidth) {
    return null;
  }

  const railId = `scroll-rail-${container.dataset.scrollRailId || ''}`;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-gold-500/60">
        <span>Rolagem Horizontal do Kanban</span>
        <span>Arraste a barra para navegar</span>
      </div>
      <div
        id={railId}
        className="scrollbar-visible overflow-x-auto overflow-y-hidden rounded-full border border-border bg-card/80 p-1"
        onScroll={(event) => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
      >
        <div style={{ width: metrics.scrollWidth, height: 10 }} />
      </div>
    </div>
  );
}
