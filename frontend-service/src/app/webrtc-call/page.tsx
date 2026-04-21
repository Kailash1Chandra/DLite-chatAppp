import { redirect } from "next/navigation";

export default function WebRtcCallPage() {
  // Keep legacy route, but always use the new Calls UX at `/call`.
  redirect("/call");
}
