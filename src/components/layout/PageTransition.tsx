"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NProgress from "nprogress";

// Ported from Unboxing Treasures' components/PageTransition.tsx --
// same NProgress pattern, just recolored to Six Spur's brand orange
// (#E77A2D) instead of UT's green.

const nprogressStyles = `
#nprogress { pointer-events: none; }
#nprogress .bar {
  background: #E77A2D;
  position: fixed;
  z-index: 9999;
  top: 0; left: 0;
  width: 100%; height: 3px;
}
#nprogress .peg {
  display: block;
  position: absolute;
  right: 0; width: 100px; height: 100%;
  box-shadow: 0 0 10px #E77A2D, 0 0 5px #E77A2D;
  opacity: 1;
  transform: rotate(3deg) translate(0px, -4px);
}
`;

NProgress.configure({ showSpinner: false, minimum: 0.15, speed: 300 });

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Start NProgress immediately on any internal link click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("#")) return;
      NProgress.start();
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Complete NProgress when new page renders
  useEffect(() => {
    NProgress.done();
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: nprogressStyles }} />
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 220ms ease-in" }}>
        {children}
      </div>
    </>
  );
}
