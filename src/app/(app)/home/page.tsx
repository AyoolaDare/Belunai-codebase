import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/not-yet-available";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <NotYetAvailable
      title="Home"
      description="Your For You, Following and Friends feeds will appear here once publishing and feeds are built."
    />
  );
}
