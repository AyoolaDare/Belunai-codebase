"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavItems, isActivePath } from "@/lib/navigation";
import { NavIcon } from "@/components/nav-icon";

/**
 * Primary navigation: a bottom bar on phones, a sidebar from 768px up.
 * One landmark serves both layouts so assistive technology sees it once.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] border-t border-border bg-surface md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-r md:border-t-0"
    >
      <Link
        href="/home"
        className="hidden px-6 py-6 text-xl font-bold tracking-tight text-primary md:block"
      >
        BELUNAI
      </Link>
      <ul className="flex justify-around md:flex-col md:gap-1 md:px-3">
        {appNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-base ${
                  active
                    ? "font-semibold text-primary md:bg-primary/10"
                    : "text-muted hover:text-foreground md:hover:bg-foreground/5"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
