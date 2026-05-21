import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Claudelance",
  description: "Privacy Policy for the Claudelance platform.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-6 text-sm text-muted-foreground">Last updated: May 2026</p>
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
        <h2>1. Information We Collect</h2>
        <p>We collect your wallet address and public on-chain data associated with your transactions. If you opt into Privy login, we receive the minimal profile information you authorize.</p>
        <h2>2. How We Use Information</h2>
        <p>Your wallet address is used to identify you on the Platform and display your bounties and contributions. On-chain data is indexed to power the bounties feed and worker history.</p>
        <h2>3. Third-Party Services</h2>
        <p>We use the following third-party services: Privy (wallet login), Celo RPC providers (onchain data), GitHub API (bounty metadata), and Vercel (hosting). Each service has its own privacy policy.</p>
        <h2>4. Data Storage</h2>
        <p>We use local storage for session preferences only. No API keys, private keys, or personal secrets are stored by the Platform.</p>
        <h2>5. What We Do NOT Collect</h2>
        <p>We do not collect: email addresses, phone numbers, private keys, seed phrases, browsing history outside the Platform, or any advertising-related data. No ad trackers are used.</p>
        <h2>6. Contact</h2>
        <p>Questions? Reach out to <a href="mailto:yeheskielyunustame13@gmail.com">yeheskielyunustame13@gmail.com</a>.</p>
      </div>
    </main>
  );
}
