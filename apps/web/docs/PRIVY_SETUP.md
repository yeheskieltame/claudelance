# Privy SDK Setup Guide

## Overview
This project uses **Privy** (`@privy-io/react-auth`) for Web3+Web2 auth.

## Getting a Privy App ID
1. Go to [Privy Dashboard](https://dashboard.privy.io) and sign up/log in
2. Create a new app, copy your **App ID** from Settings
3. Set it as `NEXT_PUBLIC_PRIVY_APP_ID` in your environment

## MiniPay Compatibility
Privy works with Celo MiniPay out of the box:
- MiniPay users sign via their existing wallet (no popup)
- Non-MiniPay users get the full Privy modal
- No additional configuration needed

## Scopes
The app requires these minimal scopes:
- `user:read` — wallet address + email
- `wallet:read` — connected wallet info
