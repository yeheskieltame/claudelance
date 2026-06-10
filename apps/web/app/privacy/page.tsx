import { Header } from "@/components/header";

const SUPPORT_EMAIL = "mailto:support@claudelance.xyz";
const REPO_ISSUES = "https://github.com/yeheskieltame/claudelance/issues";
const PRIVY_POLICY = "https://www.privy.io/privacy-policy";
const LAST_UPDATED = "22 May 2026";

export const metadata = {
  title: "Privacy Policy | Claudelance",
  description:
    "How Claudelance handles your data: no accounts, no tracking scripts, non-custodial by design.",
};

export default function PrivacyPage() {
  return (
    <main className="relative isolate min-h-svh overflow-x-clip">
      <Header />
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-7 text-muted-foreground sm:text-base">
          Claudelance is built to need as little of your data as possible. We do
          not run user accounts, we do not ask for passwords, and we do not sell
          your data. This policy explains the little we do touch.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          1. No accounts, no tracking
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          Browsing Claudelance requires no login or account. We do not embed
          third-party analytics, advertising, or behavioural tracking scripts,
          and we do not sell, rent, or share personal data.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          2. Onchain data is public
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          When you interact with the Claudelance smart contracts, your wallet
          address and the details of your bounties, claims, and pull-request
          submissions are recorded on the public Celo blockchain. This data is
          public, permanent, and outside our control &mdash; it lives on the
          blockchain, not in a Claudelance database, and anyone can read it.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          3. Data stored on your device
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          To improve your experience the app stores small amounts of data in
          your browser&apos;s local storage, on your own device: your theme
          (light or dark) preference, and an optional local mapping between a
          GitHub username and a wallet address that you enter. This data stays
          in your browser and is not transmitted to a Claudelance server.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          4. Wallet connection
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          Inside MiniPay or a compatible wallet, the app reads your public
          wallet address to display balances and let you sign transactions. We
          never receive or store your private keys or seed phrase, and we cannot
          move your funds.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          5. Optional sign-in
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          If you choose to sign in with GitHub, email, or an external wallet,
          that authentication is handled by our provider Privy, which processes
          the information you provide under its own{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={PRIVY_POLICY}
            target="_blank"
            rel="noreferrer"
          >
            privacy policy
          </a>
          . Sign-in is optional and not required to use the core marketplace.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          6. Infrastructure and third parties
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          The app is hosted on Vercel, which may process standard technical
          request data such as your IP address and browser type in server logs
          for security and reliability. Reading blockchain data relies on public
          Celo RPC endpoints (forno.celo.org), and bounty links point to GitHub.
          These providers handle data under their own policies.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          7. Cookies
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          We do not use cookies for tracking or advertising. Preferences such as
          your theme are kept in local storage, not in tracking cookies.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          8. Your choices
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          You can clear the data stored on your device at any time by clearing
          your browser&apos;s storage for this site. Onchain data cannot be
          deleted, because the blockchain is immutable.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          9. Changes
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          We may update this policy; the &quot;last updated&quot; date above
          reflects the latest version.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold tracking-tight">
          10. Contact
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          Privacy questions? Email us at{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={SUPPORT_EMAIL}
          >
            support@claudelance.xyz
          </a>
          {" "}or open an issue on our{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={REPO_ISSUES}
            target="_blank"
            rel="noreferrer"
          >
            GitHub repository
          </a>
          . See also our{" "}
          <a className="text-foreground underline-offset-2 hover:underline" href="/terms">
            Terms of Service
          </a>
          .
        </p>
      </section>
    </main>
  );
}
