import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import { ArrowUpRight, BarChart3, ChevronRight, CircleDollarSign, Clock3, Copy, Crown, Network, ShieldCheck, Sparkles, Users, Wallet, Zap } from "lucide-react";
import "./styles.css";

const CONTRACT_ADDRESS = import.meta.env.VITE_VANTEX_ADDRESS || "";
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS || "";
const TOKEN_DECIMALS = Number(import.meta.env.VITE_TOKEN_DECIMALS || 6);
const ZERO = "0x0000000000000000000000000000000000000000";

const VANTEX_ABI = [
  "function members(address) view returns (address referrer,uint128 personalBusiness,uint128 legABusiness,uint128 legBBusiness,uint40 salaryStartedAt,uint8 salaryRank,uint8 salaryClaims,uint8 split,bool registered)",
  "function pendingRoi(address) view returns (uint256)",
  "function balancedBusiness(address) view returns (uint256)",
  "function qualifiedLevel(address) view returns (uint8)",
  "function positionsOf(address) view returns (tuple(uint128 principal,uint128 claimed,uint40 startedAt,uint40 endsAt,uint16 dailyRateBps,uint8 plan)[])",
  "function register(address referrer,uint8 leg,uint8 split)",
  "function invest(uint256 amount,uint8 plan)",
  "function compoundRoi(uint8 plan)",
  "function claimRoi()",
  "function claimSalary()"
];
const TOKEN_ABI = ["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)", "function balanceOf(address) view returns (uint256)"];

const plans = [
  { name: "Flexible", label: "$1 — $2,500", rate: "0.50—0.65%", days: "200 day cap", color: "gold", index: 0, copy: "Rate scales automatically with your deposit tier." },
  { name: "Starter", label: "Start steady", rate: "0.60%", days: "90 days", color: "blue", index: 1, copy: "A focused first step with a defined finish." },
  { name: "Growth", label: "Build momentum", rate: "0.65%", days: "150 days", color: "green", index: 2, copy: "A longer runway designed for compounding." },
  { name: "Elite", label: "Maximum term", rate: "0.70%", days: "200 days", color: "purple", index: 3, copy: "The highest brochure rate and longest term." }
];

const levels = [10, 5, 4, 3, 3, 3, 2, 2, 1, 1, 2, 2, 3, 4, 5];
const fmt = (value, maximumFractionDigits = 2) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits, minimumFractionDigits: maximumFractionDigits });
const short = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect wallet";

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("100");
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [referrer, setReferrer] = useState("");
  const [leg, setLeg] = useState(0);
  const [split, setSplit] = useState(0);
  const [data, setData] = useState({ balance: "0", pending: "0", business: "0", level: 0, member: null, positions: [] });
  const isConfigured = ethers.isAddress(CONTRACT_ADDRESS) && ethers.isAddress(TOKEN_ADDRESS);

  const signerContract = async () => new ethers.Contract(CONTRACT_ADDRESS, VANTEX_ABI, await provider.getSigner());
  const load = async (activeProvider = provider, activeAccount = account) => {
    if (!activeProvider || !activeAccount || !isConfigured) return;
    try {
      const reader = new ethers.Contract(CONTRACT_ADDRESS, VANTEX_ABI, activeProvider);
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, activeProvider);
      const [member, pending, business, level, positions, balance] = await Promise.all([
        reader.members(activeAccount), reader.pendingRoi(activeAccount), reader.balancedBusiness(activeAccount),
        reader.qualifiedLevel(activeAccount), reader.positionsOf(activeAccount), token.balanceOf(activeAccount)
      ]);
      setData({ member, pending: ethers.formatUnits(pending, TOKEN_DECIMALS), business: ethers.formatUnits(business, TOKEN_DECIMALS), level: Number(level), positions, balance: ethers.formatUnits(balance, TOKEN_DECIMALS) });
    } catch (error) { setNotice(error.shortMessage || "Could not read contract data on this network."); }
  };

  const connect = async () => {
    if (!window.ethereum) return setNotice("Install a browser wallet such as MetaMask to continue.");
    try {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await nextProvider.send("eth_requestAccounts", []);
      setProvider(nextProvider); setAccount(accounts[0]); setNotice("");
      await load(nextProvider, accounts[0]);
    } catch (error) { setNotice(error.shortMessage || "Wallet connection was cancelled."); }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const changed = (accounts) => { setAccount(accounts[0] || ""); if (accounts[0]) load(provider, accounts[0]); };
    window.ethereum.on?.("accountsChanged", changed);
    return () => window.ethereum.removeListener?.("accountsChanged", changed);
  }, [provider]);

  const transact = async (kind) => {
    if (!account) return connect();
    if (!isConfigured) return setNotice("Add VITE_VANTEX_ADDRESS and VITE_TOKEN_ADDRESS to enable transactions.");
    setBusy(true); setNotice("");
    try {
      const contract = await signerContract();
      let tx;
      if (kind === "register") {
        if (!ethers.isAddress(referrer) || referrer === ZERO) throw new Error("Enter a valid referrer address.");
        tx = await contract.register(referrer, leg, split);
      } else if (kind === "invest") {
        const value = ethers.parseUnits(amount || "0", TOKEN_DECIMALS);
        const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, await provider.getSigner());
        const allowance = await token.allowance(account, CONTRACT_ADDRESS);
        if (allowance < value) { const approval = await token.approve(CONTRACT_ADDRESS, value); await approval.wait(); }
        tx = await contract.invest(value, selectedPlan);
      } else if (kind === "compoundRoi") tx = await contract.compoundRoi(selectedPlan);
      else tx = await contract[kind]();
      setNotice("Transaction submitted. Waiting for confirmation…");
      await tx.wait(); setNotice("Transaction confirmed on-chain."); await load();
    } catch (error) { setNotice(error.shortMessage || error.reason || "Transaction failed."); }
    finally { setBusy(false); }
  };

  const projected = useMemo(() => {
    const plan = plans[selectedPlan];
    const rate = Number(plan.rate.slice(0, 4));
    const days = Number(plan.days) || 200;
    return Number(amount || 0) * rate / 100 * days;
  }, [amount, selectedPlan]);

  return <div className="app">
    <nav className="nav wrap">
      <a className="brand" href="#top"><span className="mark">V</span><span>VANTEX<small>CAPITAL</small></span></a>
      <div className="navlinks"><a href="#plans">Plans</a><a href="#network">Network</a><a href="#dashboard">Dashboard</a></div>
      <button className="wallet-btn" onClick={connect}><Wallet size={17}/>{short(account)}</button>
    </nav>

    <main id="top">
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14}/> Stablecoin-powered · On-chain accounting</div>
          <h1>Build your capital.<br/><em>Grow your network.</em></h1>
          <p>A transparent dashboard for the Vantex Capital plan—investment terms, daily accrual, referral rewards and business milestones in one place.</p>
          <div className="hero-actions"><a className="primary" href="#dashboard">Open dashboard <ArrowUpRight size={18}/></a><a className="text-link" href="#plans">Explore plans <ChevronRight size={18}/></a></div>
          <div className="trust-row"><span><ShieldCheck/>Auditable rules</span><span><Clock3/>Daily accrual</span><span><Network/>15 levels</span></div>
        </div>
        <div className="hero-visual">
          <div className="orb orb-one"/><div className="orb orb-two"/>
          <div className="growth-card glass">
            <span className="micro">PROJECTED PLAN VALUE</span><strong>${fmt(Number(amount) + projected)}</strong>
            <div className="chart"><i/><i/><i/><i/><i/><i/><i/></div>
            <div className="growth-foot"><span>Principal ${fmt(amount)}</span><b>+${fmt(projected)} accrual</b></div>
          </div>
          <div className="float-card"><Crown/><span>ELITE RATE<strong>0.70% daily</strong></span></div>
        </div>
      </section>

      <section className="ticker"><div>TRADE <b>◆</b> INVEST <b>◆</b> GROW <b>◆</b> COMPOUND <b>◆</b> BUILD <b>◆</b> TRADE <b>◆</b> INVEST</div></section>

      <section id="plans" className="section wrap">
        <div className="section-head"><div><div className="eyebrow">Investment packages</div><h2>Choose your pace.</h2></div><p>Four paths, one auditable accrual engine. All positions have a defined maximum term.</p></div>
        <div className="plan-grid">{plans.map((plan) => <article key={plan.name} className={`plan-card ${plan.color} ${selectedPlan === plan.index ? "active" : ""}`} onClick={() => setSelectedPlan(plan.index)}>
          <div className="plan-top"><span>{plan.name}</span>{plan.index === 2 && <b>POPULAR</b>}</div>
          <h3>{plan.rate}</h3><small>daily accrual</small><div className="divider"/>
          <strong>{plan.days}</strong><p>{plan.copy}</p><button>Select plan <ArrowUpRight size={16}/></button>
        </article>)}</div>
        <div className="tier-strip"><span>Flexible tiers</span><b>$1–$100 <i>0.50%</i></b><b>$101–$500 <i>0.55%</i></b><b>$501–$1,000 <i>0.60%</i></b><b>$1,001–$2,500 <i>0.65%</i></b></div>
      </section>

      <section id="network" className="network-section">
        <div className="wrap network-grid">
          <div><div className="eyebrow">ROI on ROI</div><h2>Fifteen levels.<br/>One connected system.</h2><p>Earn a percentage of claimed ROI across qualified network levels. Balanced A/B business unlocks deeper levels.</p>
            <div className="split-card glass"><span>Choose your organization split</span><div><b>A <em>60%</em></b><i>or</i><b>B <em>60%</em></b></div><small>The opposite organization carries 40%.</small></div>
          </div>
          <div className="level-stack">{levels.map((rate, i) => <div key={i}><span>L{i+1}</span><i style={{width:`${rate*8}%`}}/><b>{rate}%</b></div>)}</div>
        </div>
      </section>

      <section className="milestones wrap">
        <div className="section-head"><div><div className="eyebrow">Business salary</div><h2>Momentum becomes income.</h2></div><p>Salary rewards run for six 15-day cycles after a balanced-business milestone is reached.</p></div>
        <div className="salary-row">{[[1000,25],[2000,50],[5000,125],[10000,250],[20000,500]].map(([business, salary], i) => <div key={business}><span>0{i+1}</span><small>${business.toLocaleString()} business</small><strong>${salary}</strong><em>every 15 days × 6</em></div>)}</div>
      </section>

      <section id="dashboard" className="dashboard-section">
        <div className="wrap">
          <div className="dashboard-head"><div><div className="eyebrow">Investor console</div><h2>Your capital cockpit.</h2></div><div className={`status ${account ? "live" : ""}`}><i/>{account ? `Connected ${short(account)}` : "Wallet not connected"}</div></div>
          {!isConfigured && <div className="config-note"><Zap size={18}/><span><b>Preview mode.</b> Set the two contract address environment variables after deployment to enable live reads and transactions.</span></div>}
          {notice && <div className="notice">{notice}</div>}
          {account && data.member && !data.member.registered && <div className="onboard-panel">
            <div><span className="micro">ONE-TIME ONBOARDING</span><h3>Join a Vantex organization</h3><p>Enter your sponsor, select their available A or B leg, and choose how your own future organization will be balanced.</p></div>
            <div className="onboard-form">
              <label>Sponsor address<input value={referrer} onChange={e=>setReferrer(e.target.value)} placeholder="0x…"/></label>
              <label>Sponsor leg<select value={leg} onChange={e=>setLeg(Number(e.target.value))}><option value={0}>Organization A</option><option value={1}>Organization B</option></select></label>
              <label>Your split<select value={split} onChange={e=>setSplit(Number(e.target.value))}><option value={0}>A 60% / B 40%</option><option value={1}>A 40% / B 60%</option></select></label>
              <button disabled={busy} onClick={()=>transact("register")}>{busy ? "Registering…" : "Register on-chain"}<ArrowUpRight size={17}/></button>
            </div>
          </div>}
          <div className="dashboard-grid">
            <div className="stats-panel">
              <div className="stat"><span><CircleDollarSign/>Wallet balance</span><strong>${fmt(data.balance)}</strong><small>USDT available</small></div>
              <div className="stat accent"><span><BarChart3/>Claimable ROI</span><strong>${fmt(data.pending)}</strong><div className="stat-actions"><button disabled={busy || !account} onClick={() => transact("claimRoi")}>Claim rewards</button><button disabled={busy || !account || Number(data.pending) < 1} onClick={() => transact("compoundRoi")}>Compound into {plans[selectedPlan].name}</button></div></div>
              <div className="stat"><span><Users/>Balanced business</span><strong>${fmt(data.business)}</strong><small>Qualified through level {data.level}</small></div>
              <div className="stat"><span><Crown/>Salary rank</span><strong>{data.member ? Number(data.member.salaryRank) : 0}<i>/5</i></strong><button disabled={busy || !account} onClick={() => transact("claimSalary")}>Claim salary</button></div>
            </div>
            <div className="invest-panel">
              <div className="invest-title"><span>New position</span><b>{plans[selectedPlan].name} plan</b></div>
              <label>Deposit amount <span>USDT</span></label>
              <div className="amount-input"><span>$</span><input type="number" min="1" max="2500" value={amount} onChange={e => setAmount(e.target.value)}/><b>USDT</b></div>
              <div className="quick">{[100,500,1000,2500].map(v => <button key={v} onClick={() => setAmount(String(v))}>${v.toLocaleString()}</button>)}</div>
              <div className="summary"><div><span>Daily rate</span><b>{plans[selectedPlan].rate}</b></div><div><span>Term</span><b>{plans[selectedPlan].days}</b></div><div><span>Projected accrual</span><b className="gold">+${fmt(projected)}</b></div></div>
              <button className="invest-button" disabled={busy || (data.member && !data.member.registered)} onClick={() => transact("invest")}>{busy ? "Processing…" : account ? "Approve & invest" : "Connect wallet to invest"}<ArrowUpRight size={18}/></button>
              <p className="fineprint">Projections are mathematical outputs of the contract terms, not a guarantee of profit. Review the contract and risks before transacting.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="wrap"><div className="brand"><span className="mark">V</span><span>VANTEX<small>CAPITAL</small></span></div><p>On-chain rules. Clear terms. Your decision.</p><span>© 2026 Vantex Capital</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
