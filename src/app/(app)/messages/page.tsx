import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/not-yet-available";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <NotYetAvailable
      title="Messages"
      description="One-to-one messages with your friends will appear here."
    />
  );
}
