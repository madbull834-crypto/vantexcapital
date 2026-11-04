# Vantex Capital

Full-stack EVM implementation of the supplied Vantex Capital brochure: a Solidity stablecoin contract plus a responsive React dashboard.

## Included rules

- Flexible deposits from $1–$2,500 with 0.50%–0.65% daily rate tiers and a 200-day safety cap.
- Starter (90 days / 0.60%), Growth (150 days / 0.65%), and Elite (200 days / 0.70%) positions.
- Fifteen-level ROI referral percentages: `10, 5, 4, 3, 3, 3, 2, 2, 1, 1, 2, 2, 3, 4, 5`.
- Binary A/B registration with selectable 60/40 or 40/60 volume normalization.
- Qualified depth at $100, $300, $800, and $1,500 of balanced business.
- Salary ranks at $1k/$2k/$5k/$10k/$20k business, paid $25/$50/$125/$250/$500 every 15 days for six cycles.

## Run locally

```bash
npm install
npm run compile
npm test
npm run dev
```

Deploy locally with a Hardhat node, copy the returned contract addresses into `.env`, and restart Vite:

```bash
npx hardhat node
npm run deploy:local
cp .env.example .env
```

For a real network set `PAYMENT_TOKEN` to the deployed stablecoin address before running `scripts/deploy.js`. The deployer becomes the contract owner.

## Important assumptions and risk notes

The source brochure does not specify a blockchain, token, flexible-plan duration, withdrawal policy, or how 60/40 organization volume is calculated. This implementation uses an EVM-compatible chain, a configurable 6-decimal stablecoin, caps flexible positions at 200 days, and normalizes balanced volume against the selected split. It does not promise solvency or profit; rewards require sufficient token funding. Commission and financial-product rules vary by jurisdiction. Obtain a security audit and legal review before any production deployment.
