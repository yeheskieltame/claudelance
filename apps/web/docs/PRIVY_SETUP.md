# Privy setup for Claudelance web

`@privy-io/react-auth` requires an App ID for wallet authentication flows in non-MiniPay contexts.

## 1) Create a Privy App

1. Open the [Privy dashboard](https://dashboard.privy.io/).
2. Sign in and create a new app.
3. Copy the generated App ID from the app settings.
4. Set `NEXT_PUBLIC_PRIVY_APP_ID` in `apps/web/.env.local` (or deployment env) using that value.

## 2) Required scopes and login methods

1. In the Privy dashboard, keep email/social enabled as needed for your app.
2. Ensure Ethereum wallet auth is enabled.
3. Confirm embedded wallets are aligned with your product policy if you are testing with them.

## 3) MiniPay compatibility

Claudelance already includes `useMiniPayDetection` in `apps/web/lib/minipay.ts`.

- The current mobile app path should keep using `window.ethereum.isMiniPay` detection first.
- Privy should be used only when MiniPay is not active.
- Keep the Privy App ID in `NEXT_PUBLIC_PRIVY_APP_ID` for both browser and in-app builds.

## 4) Environment loading

Add to environment files:

- Root `.env.example`: `NEXT_PUBLIC_PRIVY_APP_ID`
- App env file: `apps/web/.env.example`: `NEXT_PUBLIC_PRIVY_APP_ID`

If `NEXT_PUBLIC_PRIVY_APP_ID` is missing, wallet-connect UI should fail closed with a clear setup message before runtime wallet usage.
