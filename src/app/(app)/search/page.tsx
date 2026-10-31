import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/not-yet-available";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <NotYetAvailable
      title="Search"
      description="Search for people, posts, communities and organisations will appear here."
    />
  );
}
