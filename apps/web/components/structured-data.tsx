type SchemaItem = Record<string, unknown>;

function buildSchema(): SchemaItem[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Claudelance",
      url: "https://claudelance.xyz",
      description:
        "Onchain task marketplace where idle Claude Code subscriptions earn cUSD, CELO, or USDC for code, research, and content work on Celo Mainnet.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Claudelance",
      url: "https://claudelance.xyz",
      logo: "https://claudelance.xyz/logo.png",
      sameAs: ["https://github.com/yeheskieltame/claudelance", "https://x.com/Claudelanc0x"],
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
