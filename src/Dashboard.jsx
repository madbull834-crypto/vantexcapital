import React, { useMemo, useState } from "react";
import { ethers } from "ethers";
import "./dashboard.css";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowUpRight, BadgeDollarSign,
  BarChart3, BriefcaseBusiness, ChevronDown, CircleDollarSign, Crown,
  LayoutDashboard, Network, Plus, RefreshCw, ShieldCheck, TrendingUp,
  Users, Wallet
} from "lucide-react";

const planNames = ["Package 1", "Package 2", "Package 3", "Package 4"];
const money = (value, digits = 2) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});
const short = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect wallet";

export default function Dashboard({
  account, connect, data, notice, busy, isConfigured, plans, selectedPlan,
  setSelectedPlan, amount, setAmount, projected, transact, tokenDecimals,
  referrer, setReferrer, leg, setLeg, split, setSplit, onHome
}) {
  const [section, setSection] = useState("overview");
  const positions = useMemo(() => data.positions.map((position, index) => {
    const principal = Number(ethers.formatUnits(position.principal, tokenDecimals));
    const claimed = Number(ethers.formatUnits(position.claimed, tokenDecimals));
    const endsAt = Number(position.endsAt) * 1000;
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 86_400_000));
    return { index, principal, claimed, remaining, plan: planNames[Number(position.plan)], rate: Number(position.dailyRateBps) / 100, active: remaining > 0 };
  }), [data.positions, tokenDecimals]);

  const totalPrincipal = positions.reduce((sum, position) => sum + position.principal, 0);
  const totalClaimed = positions.reduce((sum, position) => sum + position.claimed, 0);
  const member = data.member;
  const aBusiness = member ? Number(ethers.formatUnits(member.legABusiness, tokenDecimals)) : 0;
  const bBusiness = member ? Number(ethers.formatUnits(member.legBBusiness, tokenDecimals)) : 0;
  const totalBusiness = aBusiness + bBusiness;
  const aPercent = totalBusiness ? (aBusiness / totalBusiness) * 100 : 0;
  const bPercent = totalBusiness ? 100 - aPercent : 0;

  const navigation = [
    ["overview", LayoutDashboard, "Overview"],
    ["portfolio", BriefcaseBusiness, "Portfolio"],
    ["network", Network, "My network"],
    ["rewards", BadgeDollarSign, "Rewards"]
  ];

  return <div className="portal">
    <aside className="portal-sidebar">
      <button className="portal-brand" onClick={onHome}><span>V</span><div>VANTEX<small>CAPITAL</small></div></button>
      <nav>{navigation.map(([key, Icon, label]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot">
        <div className="chain-card"><ShieldCheck size={18}/><div><b>BSC Testnet</b><span>Chain ID 97</span></div><i/></div>
        <button className="back-site" onClick={onHome}><ArrowLeft size={16}/> Back to website</button>
      </div>
    </aside>

    <main className="portal-main">
      <header className="portal-topbar">
        <div><span className="portal-kicker">INVESTOR WORKSPACE</span><h1>{section === "overview" ? "Good to see you." : navigation.find(item => item[0] === section)?.[2]}</h1></div>
        <div className="portal-actions"><button className="refresh" onClick={() => window.location.reload()}><RefreshCw size={17}/></button><button className="portal-wallet" onClick={connect}><Wallet size={17}/>{short(account)}<ChevronDown size={14}/></button></div>
      </header>

      {!isConfigured && <div className="portal-alert"><Activity size={18}/><span><b>Preview mode:</b> configure the contract addresses to enable live transactions.</span></div>}
      {notice && <div className="portal-alert notice-alert">{notice}</div>}

      {account && member && !member.registered && <section className="portal-onboarding">
        <div><span>ONE-TIME SETUP</span><h2>Join your sponsor’s organization</h2><p>Registration fixes your sponsor leg and your own business split permanently on-chain.</p></div>
        <div className="portal-onboarding-form">
          <label>Sponsor wallet<input value={referrer} onChange={event => setReferrer(event.target.value)} placeholder="0x…"/></label>
          <label>Placement<select value={leg} onChange={event => setLeg(Number(event.target.value))}><option value={0}>Organization A</option><option value={1}>Organization B</option></select></label>
          <label>Your split<select value={split} onChange={event => setSplit(Number(event.target.value))}><option value={0}>A 60% · B 40%</option><option value={1}>A 40% · B 60%</option></select></label>
          <button disabled={busy} onClick={() => transact("register")}>{busy ? "Registering…" : "Complete registration"}<ArrowUpRight size={16}/></button>
        </div>
      </section>}

      <section className="balance-hero">
        <div><span className="metric-label"><CircleDollarSign size={15}/> TOTAL POSITION VALUE</span><strong>${money(totalPrincipal + Number(data.pending))}</strong><p><b>${money(totalPrincipal)}</b> invested principal <i/> <em>${money(data.pending)} available</em></p></div>
        <div className="balance-actions"><button className="claim" disabled={busy || !account || Number(data.pending) <= 0} onClick={() => transact("claimRoi")}><ArrowDownToLine size={17}/> Claim ${money(data.pending)}</button><button disabled={busy || !account || Number(data.pending) < 1} onClick={() => transact("compoundRoi")}><TrendingUp size={17}/> Compound ROI</button></div>
        <div className="balance-art"><i/><i/><i/><i/><i/><i/></div>
      </section>

      <section className="portal-metrics">
        <article className="wallet-balance-card"><div className="metric-icon blue"><Wallet/></div><span>Wallet balance</span><strong>${money(data.balance)}</strong><small>Available test mUSDT</small><button className="faucet-button" disabled={busy} onClick={() => transact("mint")}><Plus size={13}/>{busy ? "Processing…" : account ? "Mint 10,000 test mUSDT" : "Connect wallet to mint"}</button></article>
        <article><div className="metric-icon amber"><BriefcaseBusiness/></div><span>Active positions</span><strong>{positions.filter(position => position.active).length}</strong><small>{positions.length} total positions</small></article>
        <article><div className="metric-icon green"><Users/></div><span>Balanced business</span><strong>${money(data.business, 0)}</strong><small>Qualified through level {data.level}</small></article>
        <article><div className="metric-icon violet"><Crown/></div><span>Salary rank</span><strong>{member ? Number(member.salaryRank) : 0}<i>/5</i></strong><small>{member ? Number(member.salaryClaims) : 0} cycles claimed</small></article>
      </section>

      <div className="portal-content-grid">
        <section className="portal-card portfolio-card">
          <div className="card-heading"><div><span>PORTFOLIO</span><h2>Your positions</h2></div><button onClick={() => setSection("portfolio")}>View all <ArrowUpRight size={14}/></button></div>
          <div className="position-table">
            <div className="position-row header"><span>Package</span><span>Principal</span><span>Daily total</span><span>Time left</span><span>Status</span></div>
            {positions.length ? positions.slice(0, 5).map(position => <div className="position-row" key={position.index}>
              <span><i className={`plan-dot p${planNames.indexOf(position.plan)}`}/><b>{position.plan}</b><small>Position #{String(position.index + 1).padStart(2, "0")}</small></span>
              <span><b>${money(position.principal)}</b></span><span><b>{position.rate.toFixed(2)}%</b></span><span><b>{position.remaining} days</b></span><span><em className={position.active ? "active" : "ended"}>{position.active ? "Active" : "Ended"}</em></span>
            </div>) : <div className="empty-positions"><BriefcaseBusiness size={30}/><b>No positions yet</b><span>Select a plan to create your first on-chain position.</span></div>}
          </div>
          <div className="portfolio-foot"><span>Total claimed ROI</span><b>${money(totalClaimed)}</b></div>
        </section>

        <section className="portal-card new-position-card">
          <div className="card-heading"><div><span>INVEST</span><h2>New position</h2></div><div className="plus-icon"><Plus size={18}/></div></div>
          <label>Choose package</label><div className="portal-plan-picker">{plans.map(plan => <button key={plan.index} className={selectedPlan === plan.index ? "active" : ""} onClick={() => setSelectedPlan(plan.index)}><b>{plan.name}</b><span>{plan.label} · {plan.totalRate} total</span></button>)}</div>
          <label>Amount <span>USDT</span></label><div className="portal-amount"><span>$</span><input type="number" min="1" max="2500" value={amount} onChange={event => setAmount(event.target.value)}/><b>USDT</b></div>
          <div className="portal-quick">{[100, 500, 1000, 2500].map(value => <button key={value} onClick={() => setAmount(String(value))}>${value.toLocaleString()}</button>)}</div>
          <div className="portal-summary"><span>Daily profit <b>{plans[selectedPlan].rate}</b></span><span>Daily capital release <b>{plans[selectedPlan].rate}</b></span><span>Daily total <b>{plans[selectedPlan].totalRate}</b></span><span>Duration <b>{plans[selectedPlan].days}</b></span><span>Projected total payout <b>+${money(projected)}</b></span></div>
          <button className="portal-invest" disabled={busy || (member && !member.registered)} onClick={() => transact("invest")}>{busy ? "Processing transaction…" : account ? "Approve & create position" : "Connect wallet to continue"}<ArrowUpRight size={17}/></button>
        </section>
      </div>

      <div className="portal-lower-grid">
        <section className="portal-card network-card">
          <div className="card-heading"><div><span>ORGANIZATION</span><h2>Business balance</h2></div><button onClick={() => setSection("network")}>Network details <ArrowUpRight size={14}/></button></div>
          <div className="business-numbers"><div><i className="a"/><span>Organization A</span><b>${money(aBusiness, 0)}</b><small>{money(aPercent, 0)}% of volume</small></div><div><i className="b"/><span>Organization B</span><b>${money(bBusiness, 0)}</b><small>{money(bPercent, 0)}% of volume</small></div></div>
          <div className="business-bar"><i style={{width: `${aPercent}%`}}/><b style={{width: `${bPercent}%`}}/></div>
          <div className="qualification"><span>Current qualification</span><b>Referral level {data.level} of 15</b></div>
        </section>
        <section className="portal-card salary-card">
          <div className="salary-icon"><Crown/></div><div><span>SALARY PROGRAM</span><h2>Rank {member ? Number(member.salaryRank) : 0}</h2><p>Six reward cycles unlock every 15 days after reaching a balanced-business milestone.</p></div>
          <button disabled={busy || !account} onClick={() => transact("claimSalary")}>Claim available salary <ArrowUpRight size={15}/></button>
        </section>
      </div>
    </main>
  </div>;
}
