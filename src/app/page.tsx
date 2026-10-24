import { redirect } from "next/navigation";

// The proxy normally handles "/" before this renders; this is a fallback.
export default function Home() {
  redirect("/interviews");
}
