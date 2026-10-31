import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/not-yet-available";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <NotYetAvailable
      title="Profile"
      description="Your profile, interests and account settings will appear here once sign-in is available."
    />
  );
}
