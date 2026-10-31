import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/not-yet-available";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <NotYetAvailable
      title="Notifications"
      description="Notifications about follows, friend requests, comments and messages will appear here."
    />
  );
}
