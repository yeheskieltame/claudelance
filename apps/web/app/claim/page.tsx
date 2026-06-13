import { redirect } from "next/navigation";

// Claiming earnings now lives in the profile hub (/profile). Keep this path as
// a permanent redirect so old links and the prior nav entry still resolve.
export default function ClaimPage() {
  redirect("/profile");
}
