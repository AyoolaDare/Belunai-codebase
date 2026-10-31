export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "search" | "messages" | "notifications" | "profile";
};

export const appNavItems: readonly NavItem[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

/** True when `pathname` is `href` itself or a nested route below it. */
export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith("/") ? href : `${href}/`);
}
