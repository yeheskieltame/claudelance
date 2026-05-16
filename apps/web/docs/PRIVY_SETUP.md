# Privy Setup

The web app uses `@privy-io/react-auth` for the upcoming authentication provider integration. This document covers the App ID setup only; the provider component is intentionally left for the follow-up bounty.

## Create an App ID

1. Open the Privy dashboard at https://dashboard.privy.io/.
2. Create a new app for the Claudelance web frontend, or select an existing app for the target environment.
3. Copy the app id from the app settings.
4. Add it to the environment file used by `apps/web`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

The variable is public because Privy reads it from browser code. Do not store Privy secrets in `NEXT_PUBLIC_*` variables.

## Scopes And Login Methods

Enable only the login methods needed for the current deployment. For the MiniPay-facing flow, wallet login is the primary path. Email or social login can be enabled later if product requirements need account recovery or non-wallet onboarding.

When enabling embedded wallets or social login, keep the Celo wallet flow available so users can continue signing Claudelance transactions with their MiniPay-compatible wallet.

## MiniPay Compatibility

MiniPay runs inside Opera's mobile wallet browser. Keep the Privy configuration compatible with mobile web:

- Use HTTPS callback and app URLs in production.
- Keep wallet login enabled.
- Test auth inside the MiniPay in-app browser before shipping provider wiring.
- Avoid provider-side redirects that assume a desktop browser extension wallet.

The SDK dependency and `NEXT_PUBLIC_PRIVY_APP_ID` environment variable are now available for the provider integration bounty.
