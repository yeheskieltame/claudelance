import { LegalPage, LegalSection } from "@/components/legal-page";

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
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          Claudelance is built to need as little of your data as possible. We do not run user
          accounts, we do not ask for passwords, and we do not sell your data. This policy explains
          the little we do touch.
        </p>
      }
    >
      <LegalSection id="no-tracking" n={1} title="No accounts, no tracking">
        <p>
          Browsing Claudelance requires no login or account. We do not embed third-party analytics,
          advertising, or behavioural tracking scripts, and we do not sell, rent, or share personal
          data.
        </p>
      </LegalSection>

      <LegalSection id="onchain" n={2} title="Onchain data is public">
        <p>
          When you interact with the Claudelance smart contracts, your wallet address and the details
          of your bounties, claims, and pull-request submissions are recorded on the public Celo
          blockchain. This data is public, permanent, and outside our control &mdash; it lives on the
          blockchain, not in a Claudelance database, and anyone can read it.
        </p>
      </LegalSection>

      <LegalSection id="device-data" n={3} title="Data stored on your device">
        <p>
          To improve your experience the app stores small amounts of data in your browser&apos;s local
          storage, on your own device: your theme (light or dark) preference, and an optional local
          mapping between a GitHub username and a wallet address that you enter. This data stays in
          your browser and is not transmitted to a Claudelance server.
        </p>
      </LegalSection>

      <LegalSection id="wallet" n={4} title="Wallet connection">
        <p>
          Inside MiniPay or a compatible wallet, the app reads your public wallet address to display
          balances and let you sign transactions. We never receive or store your private keys or seed
          phrase, and we cannot move your funds.
        </p>
      </LegalSection>

      <LegalSection id="sign-in" n={5} title="Optional sign-in">
        <p>
          If you choose to sign in with GitHub, email, or an external wallet, that authentication is
          handled by our provider Privy, which processes the information you provide under its own{" "}
          <a href={PRIVY_POLICY} target="_blank" rel="noreferrer">
            privacy policy
          </a>
          . Sign-in is optional and not required to use the core marketplace.
        </p>
      </LegalSection>

      <LegalSection id="infra" n={6} title="Infrastructure and third parties">
        <p>
          The app is hosted on Vercel, which may process standard technical request data such as your
          IP address and browser type in server logs for security and reliability. Reading blockchain
          data relies on public Celo RPC endpoints (forno.celo.org), and bounty links point to GitHub.
          These providers handle data under their own policies.
        </p>
      </LegalSection>

      <LegalSection id="cookies" n={7} title="Cookies">
        <p>
          We do not use cookies for tracking or advertising. Preferences such as your theme are kept
          in local storage, not in tracking cookies.
        </p>
      </LegalSection>

      <LegalSection id="choices" n={8} title="Your choices">
        <p>
          You can clear the data stored on your device at any time by clearing your browser&apos;s
          storage for this site. Onchain data cannot be deleted, because the blockchain is immutable.
        </p>
      </LegalSection>

      <LegalSection id="changes" n={9} title="Changes">
        <p>
          We may update this policy; the &quot;last updated&quot; date above reflects the latest
          version.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={10} title="Contact">
        <p>
          Privacy questions? Email us at <a href={SUPPORT_EMAIL}>support@claudelance.xyz</a> or open an
          issue on our{" "}
          <a href={REPO_ISSUES} target="_blank" rel="noreferrer">
            GitHub repository
          </a>
          . See also our <a href="/terms">Terms of Service</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
