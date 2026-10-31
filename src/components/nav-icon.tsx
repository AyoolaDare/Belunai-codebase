import type { NavItem } from "@/lib/navigation";

const paths: Record<NavItem["icon"], string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.35-4.35",
  messages: "M4 5h16v11H8l-4 4z",
  notifications:
    "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 3a2 2 0 0 0 4 0",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
};

export function NavIcon({ name }: { name: NavItem["icon"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
