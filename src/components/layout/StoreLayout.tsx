import { ReactNode, useLayoutEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface StoreLayoutProps {
  children: ReactNode;
}

const StoreLayout = ({ children }: StoreLayoutProps) => {
  const [headerHeight, setHeaderHeight] = useState(120);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.getElementById("site-header");
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      const safe = Number.isFinite(h) && h > 0 ? h : 0;
      setHeaderHeight(safe);
      // Expose as CSS var so sticky elements can offset without hardcoding.
      document.documentElement.style.setProperty("--header-h", `${safe}px`);
    };

    update();
    window.addEventListener("resize", update);

    // If available, keep the spacer accurate when fonts/layout change.
    let ro: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* Header is `fixed`, so add a spacer below it for all pages. */}
      <div aria-hidden style={{ height: headerHeight }} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};

export default StoreLayout;
