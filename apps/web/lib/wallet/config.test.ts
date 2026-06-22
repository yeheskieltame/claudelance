import assert from "node:assert/strict";
import test from "node:test";

import { celoMainnet } from "../chain";
import {
  connectorResolutionOrder,
  isMiniPay,
  pickInjectedConnector,
  resolveConnector,
  wagmiConfig,
} from "./config";

test("B39 connector resolution keeps MiniPay before WalletConnect fallback", () => {
  assert.deepEqual(connectorResolutionOrder, ["minipay", "walletconnect"]);
  assert.equal(isMiniPay({ isMiniPay: true }), true);
  assert.equal(isMiniPay({ isMiniPay: false }), false);
  assert.equal(resolveConnector({ isMiniPay: true }), "minipay");
  assert.equal(resolveConnector({ request: async () => [] }), "walletconnect");
});

test("wagmi config targets Celo mainnet only", () => {
  assert.deepEqual(
    wagmiConfig.chains.map((chain) => chain.id),
    [celoMainnet.id],
  );
});

test("pickInjectedConnector resolves the injected connector in both environments", () => {
  // Inside the MiniPay webview the connector reports id "minipay"; outside,
  // wagmi degrades it to the default "injected" target.
  assert.equal(pickInjectedConnector([{ id: "minipay" }])?.id, "minipay");
  assert.equal(pickInjectedConnector([{ id: "injected" }])?.id, "injected");
  assert.equal(pickInjectedConnector([{ id: "other" }])?.id, "other");
  assert.equal(pickInjectedConnector([]), undefined);
});
