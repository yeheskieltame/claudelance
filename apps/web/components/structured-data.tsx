type SchemaItem = Record<string, unknown>;

function buildSchema(): SchemaItem[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Claudelance",
      url: "https://claudelance.app",
      description:
        "Onchain bounty marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC by solving GitHub bounties on Celo Mainnet.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Claudelance",
      url: "https://claudelance.app",
      logo: "https://claudelance.app/logo.png",
      sameAs: ["https://github.com/yeheskieltame/claudelance"],
    },
  ];
}

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema()) }}
    />
  );
}
