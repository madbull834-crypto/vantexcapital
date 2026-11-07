# Vantex Capital

Full-stack EVM implementation of the supplied Vantex Capital brochure: a Solidity stablecoin contract plus a responsive React dashboard.

## Included rules

- Four amount-bound packages: $1–$100 at 0.50%, $101–$500 at 0.55%, $501–$1,000 at 0.60%, and $1,001–$2,500 at 0.65% daily profit. Each releases capital at the same daily rate (1.00%–1.30% combined daily payout) and has a 200-day safety cap.
- ROI-on-ROI commissions apply to the profit component of a member's claim, not to released capital.
- Fifteen-level ROI referral percentages: `10, 5, 4, 3, 3, 3, 2, 2, 1, 1, 2, 2, 3, 4, 5`.
- Binary A/B registration with selectable 60/40 or 40/60 volume normalization.
- Qualified depth at $100, $300, $800, and $1,500 of balanced business.
- Salary ranks at $1k/$2k/$5k/$10k/$20k business, paid $25/$50/$125/$250/$500 every 15 days for six cycles.

## BSC Testnet contracts

- Vantex: `0x9D648EF1c739db29a2a5186acE062Ad877dA0918`
- Mock USDT: `0xbAf33f644C8aE8763369A7EB8814D0B69467614C`
- Network: BSC Testnet (`97`)

The frontend requests BSC Testnet when a wallet connects. No local blockchain deployment is required.

## Run the frontend

```bash
npm ci
cp .env.example .env
npm run compile
npm test
npm run dev
```

Build the production bundle in `dist/`:

```bash
npm run build
```

To deploy a replacement BSC Testnet instance, add a funded test-wallet `DEPLOYER_PRIVATE_KEY` to `.env` and run `npm run deploy:testnet`. Leave `PAYMENT_TOKEN` unset to deploy a new MockUSDT, or set it to an existing BSC Testnet token. Never commit `.env`.

## Important assumptions and risk notes

The source brochure does not specify a blockchain, token, package duration, withdrawal policy, or how 60/40 organization volume is calculated. This test deployment uses BSC Testnet, a 6-decimal mock stablecoin, caps package positions at 200 days, and normalizes balanced volume against the selected split. It does not promise solvency or profit; rewards require sufficient token funding. Commission and financial-product rules vary by jurisdiction. Obtain a security audit and legal review before any production deployment.
