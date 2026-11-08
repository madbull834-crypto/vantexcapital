import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import "./dashboard.css";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowUpRight, BadgeDollarSign,
  BarChart3, BriefcaseBusiness, ChevronDown, CircleDollarSign, Crown,
  LayoutDashboard, Network, Plus, RefreshCw, Search, ShieldCheck, TrendingUp,
  Users, Wallet
} from "lucide-react";

const planNames = ["Package 1", "Package 2", "Package 3", "Package 4"];
const money = (value, digits = 2) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});
const short = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect wallet";

function PortfolioPage({ positions, pending, totalPrincipal, totalClaimed, onAddPosition }) {
  const activePositions = positions.filter(position => position.active);
  const estimatedDaily = activePositions.reduce((sum, position) => sum + (position.principal * position.rate / 100), 0);
  const nextMaturity = [...activePositions].sort((a, b) => a.remaining - b.remaining)[0];
  const allocation = planNames.map((plan, index) => {
    const value = positions.filter(position => position.plan === plan).reduce((sum, position) => sum + position.principal, 0);
    return { plan, index, value, percentage: totalPrincipal ? value / totalPrincipal * 100 : 0 };
  }).filter(item => item.value > 0);

  return <div className="portfolio-page">
    <section className="portfolio-page-hero">
      <div><span className="portal-kicker">PORTFOLIO OVERVIEW</span><h2>Your capital, clearly organized.</h2><p>Monitor every on-chain position, package allocation, daily payout rate and maturity window from one place.</p></div>
      <button onClick={onAddPosition}><Plus size={17}/> Create new position</button>
    </section>

    <section className="portfolio-summary-grid">
      <article><span>Total principal</span><strong>${money(totalPrincipal)}</strong><small>Across {positions.length} position{positions.length === 1 ? "" : "s"}</small></article>
      <article><span>Claimable now</span><strong className="positive">${money(pending)}</strong><small>Available on-chain payout</small></article>
      <article><span>Estimated daily total</span><strong>${money(estimatedDaily)}</strong><small>At current package rates</small></article>
      <article><span>Total claimed</span><strong>${money(totalClaimed)}</strong><small>Lifetime claimed payout</small></article>
    </section>

    <div className="portfolio-insights-grid">
      <section className="portal-card portfolio-allocation">
        <div className="card-heading"><div><span>ALLOCATION</span><h2>Capital by package</h2></div><BriefcaseBusiness size={20}/></div>
        {allocation.length ? <div className="allocation-list">{allocation.map(item => <div key={item.plan}>
          <div className="allocation-label"><span><i className={`allocation-dot p${item.index}`}/>{item.plan}</span><b>${money(item.value)} <em>{money(item.percentage, 0)}%</em></b></div>
          <div className="allocation-track"><i className={`p${item.index}`} style={{ width: `${item.percentage}%` }}/></div>
        </div>)}</div> : <div className="portfolio-mini-empty"><span>No allocation yet</span><small>Create a position to populate your portfolio.</small></div>}
      </section>

      <section className="portal-card portfolio-insight-card">
        <div className="card-heading"><div><span>POSITION HEALTH</span><h2>Current outlook</h2></div><TrendingUp size={20}/></div>
        <div className="outlook-list">
          <div><span>Active positions</span><b>{activePositions.length} of {positions.length}</b></div>
          <div><span>Average daily rate</span><b>{activePositions.length ? (activePositions.reduce((sum, position) => sum + position.rate, 0) / activePositions.length).toFixed(2) : "0.00"}%</b></div>
          <div><span>Next maturity</span><b>{nextMaturity ? `${nextMaturity.remaining} days` : "—"}</b></div>
        </div>
        <div className="outlook-note"><ShieldCheck size={16}/><span>All figures are read from your connected wallet’s on-chain positions.</span></div>
      </section>
    </div>

    <section className="portal-card portfolio-ledger">
      <div className="card-heading"><div><span>POSITION LEDGER</span><h2>All positions</h2></div><span className="ledger-count">{positions.length} total</span></div>
      <div className="position-table">
        <div className="position-row header"><span>Package</span><span>Principal</span><span>Daily total</span><span>Time left</span><span>Status</span></div>
        {positions.length ? positions.map(position => <div className="position-row" key={position.index}>
          <span><i className={`plan-dot p${planNames.indexOf(position.plan)}`}/><b>{position.plan}</b><small>Position #{String(position.index + 1).padStart(2, "0")}</small></span>
          <span><b>${money(position.principal)}</b></span><span><b>{position.rate.toFixed(2)}%</b></span><span><b>{position.remaining} days</b></span><span><em className={position.active ? "active" : "ended"}>{position.active ? "Active" : "Ended"}</em></span>
        </div>) : <div className="portfolio-ledger-empty"><BriefcaseBusiness size={34}/><b>Your portfolio is ready for its first position.</b><span>Select a package and create an on-chain position to begin.</span><button onClick={onAddPosition}>Explore packages <ArrowUpRight size={15}/></button></div>}
      </div>
    </section>
  </div>;
}

function NetworkPage({ account, connect, network, loading, error, depth, setDepth, refresh, tokenDecimals, aBusiness, bBusiness, qualifiedLevel }) {
  const [query, setQuery] = useState("");
  const descendants = network.nodes.filter(node => node.depth > 0);
  const activeMembers = descendants.filter(node => Number(node.member.personalBusiness) > 0);
  const directMembers = descendants.filter(node => node.depth === 1);
  const teamA = descendants.filter(node => node.team === "A");
  const teamB = descendants.filter(node => node.team === "B");
  const deepestLevel = descendants.reduce((value, node) => Math.max(value, node.depth), 0);
  const levels = Array.from({ length: Math.max(deepestLevel, 1) }, (_, index) => {
    const level = index + 1;
    return { level, count: descendants.filter(node => node.depth === level).length };
  });
  const maxLevelCount = Math.max(...levels.map(level => level.count), 1);
  const visibleMembers = descendants.filter(node => !query || node.address.toLowerCase().includes(query.toLowerCase()));
  const directA = directMembers.find(node => node.team === "A");
  const directB = directMembers.find(node => node.team === "B");
  const memberBusiness = node => Number(ethers.formatUnits(node.member.personalBusiness, tokenDecimals));
  const memberTeamBusiness = node => Number(ethers.formatUnits(node.member.legABusiness + node.member.legBBusiness, tokenDecimals));

  if (!account) return <section className="network-connect-state">
    <div className="network-connect-icon"><Network size={30}/></div><span className="portal-kicker">LIVE NETWORK</span><h2>Connect your wallet to view your team.</h2><p>Your network is read directly from the Vantex contract on BSC Testnet.</p><button onClick={connect}><Wallet size={16}/> Connect wallet</button>
  </section>;

  return <div className="network-page">
    <section className="network-page-hero">
      <div><span className="portal-kicker">ON-CHAIN TEAM EXPLORER</span><h2>Your network, from sponsor to every loaded level.</h2><p>Live member placement and business data reconstructed from your connected wallet’s referral tree.</p></div>
      <div className="network-hero-actions"><button onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spinning" : ""}/> Refresh</button><span>Loaded through level {network.loadedDepth}</span></div>
    </section>

    {error && <div className="portal-alert"><Activity size={17}/><span>{error}</span></div>}

    <section className="network-summary-grid">
      <article><div className="metric-icon blue"><Users/></div><span>Total team</span><strong>{descendants.length}</strong><small>Members currently loaded</small></article>
      <article><div className="metric-icon amber"><Network/></div><span>Direct members</span><strong>{directMembers.length}</strong><small>Personally placed team</small></article>
      <article><div className="metric-icon green"><TrendingUp/></div><span>Active investors</span><strong>{activeMembers.length}</strong><small>Members with personal business</small></article>
      <article><div className="metric-icon violet"><BadgeDollarSign/></div><span>Qualified depth</span><strong>{qualifiedLevel}<i>/15</i></strong><small>Deepest member loaded: L{deepestLevel}</small></article>
    </section>

    <div className="network-team-grid">
      <section className="portal-card team-branch-card team-a">
        <div className="team-branch-head"><div><i>A</i><span>TEAM A<strong>{teamA.length} members</strong></span></div><b>${money(aBusiness, 0)}</b></div>
        <div className="team-branch-meta"><span>Direct member</span><b>{directA ? short(directA.address) : "Open position"}</b></div>
        <div className="team-branch-progress"><i style={{ width: `${aBusiness + bBusiness ? aBusiness / (aBusiness + bBusiness) * 100 : 0}%` }}/></div>
      </section>
      <section className="portal-card team-branch-card team-b">
        <div className="team-branch-head"><div><i>B</i><span>TEAM B<strong>{teamB.length} members</strong></span></div><b>${money(bBusiness, 0)}</b></div>
        <div className="team-branch-meta"><span>Direct member</span><b>{directB ? short(directB.address) : "Open position"}</b></div>
        <div className="team-branch-progress"><i style={{ width: `${aBusiness + bBusiness ? bBusiness / (aBusiness + bBusiness) * 100 : 0}%` }}/></div>
      </section>
    </div>

    <div className="network-detail-grid">
      <section className="portal-card network-levels-card">
        <div className="card-heading"><div><span>DEPTH MAP</span><h2>Members by level</h2></div><span className="ledger-count">L1–L{Math.max(deepestLevel, 1)}</span></div>
        <div className="network-levels">{levels.map(item => <div key={item.level}><span>L{item.level}</span><div><i style={{ width: `${item.count / maxLevelCount * 100}%` }}/></div><b>{item.count}</b></div>)}</div>
        {depth < 15 && <button className="load-network" disabled={loading || network.nodes.length >= 500} onClick={() => setDepth(value => Math.min(15, value + 2))}>{loading ? "Loading network…" : `Load through level ${Math.min(15, depth + 2)}`}<ArrowDownToLine size={14}/></button>}
        {network.truncated && <p className="network-limit-note">More members exist below the loaded depth. Load deeper to continue exploring.</p>}
      </section>

      <section className="portal-card network-balance-card">
        <div className="card-heading"><div><span>TEAM BALANCE</span><h2>Business distribution</h2></div><BarChart3 size={20}/></div>
        <div className="network-balance-total"><span>Combined team business</span><strong>${money(aBusiness + bBusiness, 0)}</strong></div>
        <div className="network-balance-ring" style={{ "--team-a": `${aBusiness + bBusiness ? aBusiness / (aBusiness + bBusiness) * 100 : 50}%` }}><div><b>{money(aBusiness + bBusiness ? aBusiness / (aBusiness + bBusiness) * 100 : 0, 0)}%</b><span>Team A</span></div></div>
        <div className="network-balance-legend"><span><i className="a"/>Team A <b>${money(aBusiness, 0)}</b></span><span><i className="b"/>Team B <b>${money(bBusiness, 0)}</b></span></div>
      </section>
    </div>

    <section className="portal-card network-roster">
      <div className="network-roster-head"><div><span>MEMBER ROSTER</span><h2>Loaded team members</h2></div><label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search wallet address"/></label></div>
      <div className="network-table">
        <div className="network-table-row header"><span>Member</span><span>Team</span><span>Level</span><span>Personal business</span><span>Team business</span><span>Status</span></div>
        {visibleMembers.length ? visibleMembers.map(node => {
          const personal = memberBusiness(node);
          const teamBusiness = memberTeamBusiness(node);
          return <div className="network-table-row" key={node.address}>
            <span><i className={`member-avatar team-${node.team.toLowerCase()}`}>{node.team}</i><b>{short(node.address)}</b><small>{node.address}</small></span>
            <span><em className={`team-pill ${node.team.toLowerCase()}`}>Team {node.team}</em></span><span><b>L{node.depth}</b></span><span><b>${money(personal, 0)}</b></span><span><b>${money(teamBusiness, 0)}</b></span><span><em className={personal > 0 ? "member-active" : "member-registered"}>{personal > 0 ? "Active" : "Registered"}</em></span>
          </div>;
        }) : <div className="network-roster-empty"><Users size={28}/><b>{loading ? "Loading your network…" : query ? "No wallet matches your search." : "No team members yet."}</b><span>{query ? "Try a different address." : "New sponsored members will appear here automatically."}</span></div>}
      </div>
    </section>
  </div>;
}

export default function Dashboard({
  account, connect, data, notice, busy, isConfigured, plans, selectedPlan,
  setSelectedPlan, amount, setAmount, projected, transact, tokenDecimals,
  referrer, setReferrer, loadNetwork, onHome
}) {
  const [section, setSection] = useState("overview");
  const [networkDepth, setNetworkDepth] = useState(4);
  const [networkState, setNetworkState] = useState({ nodes: [], truncated: false, loadedDepth: 0, loading: false, error: "" });
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

  const refreshNetwork = () => {
    if (!account) return;
    setNetworkState(value => ({ ...value, loading: true, error: "" }));
    loadNetwork(networkDepth).then(result => setNetworkState({ ...result, loading: false, error: "" })).catch(error => setNetworkState(value => ({ ...value, loading: false, error: error.shortMessage || error.message || "Could not load the network." })));
  };

  useEffect(() => {
    if (section !== "network" || !account) return;
    let cancelled = false;
    setNetworkState(value => ({ ...value, loading: true, error: "" }));
    loadNetwork(networkDepth).then(result => {
      if (!cancelled) setNetworkState({ ...result, loading: false, error: "" });
    }).catch(error => {
      if (!cancelled) setNetworkState(value => ({ ...value, loading: false, error: error.shortMessage || error.message || "Could not load the network." }));
    });
    return () => { cancelled = true; };
  }, [section, account, networkDepth, loadNetwork]);

  const navigation = [
    ["overview", LayoutDashboard, "Overview"],
    ["portfolio", BriefcaseBusiness, "Portfolio"],
    ["network", Network, "My network"],
    ["rewards", BadgeDollarSign, "Rewards"]
  ];

  return <div className="portal">
    <aside className="portal-sidebar">
      <button className="portal-brand" onClick={onHome} aria-label="Return to Vantex home"><span>V</span><div>VANTEX<small>CAPITAL</small></div></button>
      <nav>{navigation.map(([key, Icon, label]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot">
        <div className="chain-card"><ShieldCheck size={18}/><div><b>BSC Testnet</b><span>Chain ID 97</span></div><i/></div>
        <button className="back-site" onClick={onHome}><ArrowLeft size={16}/> Back to website</button>
      </div>
    </aside>

    <main className="portal-main">
      <header className="portal-topbar">
        <div><span className="portal-kicker">INVESTOR WORKSPACE</span><h1>{section === "overview" ? "Good to see you." : navigation.find(item => item[0] === section)?.[2]}</h1></div>
        <div className="portal-actions"><button className="refresh" aria-label="Refresh dashboard" onClick={() => window.location.reload()}><RefreshCw size={17}/></button><button className="portal-wallet" onClick={connect}><Wallet size={17}/>{short(account)}<ChevronDown size={14}/></button></div>
      </header>

      {!isConfigured && <div className="portal-alert"><Activity size={18}/><span><b>Preview mode:</b> configure the contract addresses to enable live transactions.</span></div>}
      {notice && <div className="portal-alert notice-alert">{notice}</div>}

      {account && member && !member.registered && <section className="portal-onboarding">
        <div><span>ONE-TIME SETUP</span><h2>Confirm your sponsor</h2><p>The platform automatically selects the sponsor’s available position.</p></div>
        <div className="portal-onboarding-form simplified">
          <label>Sponsor wallet<input value={referrer} onChange={event => setReferrer(event.target.value)} placeholder="0x…"/></label>
          <button disabled={busy} onClick={() => transact("register")}>{busy ? "Registering…" : "Confirm sponsor"}<ArrowUpRight size={16}/></button>
        </div>
      </section>}

      {section === "portfolio" ? <PortfolioPage
        positions={positions}
        pending={Number(data.pending)}
        totalPrincipal={totalPrincipal}
        totalClaimed={totalClaimed}
        onAddPosition={() => setSection("overview")}
      /> : section === "network" ? <NetworkPage
        account={account}
        connect={connect}
        network={networkState}
        loading={networkState.loading}
        error={networkState.error}
        depth={networkDepth}
        setDepth={setNetworkDepth}
        refresh={refreshNetwork}
        tokenDecimals={tokenDecimals}
        aBusiness={aBusiness}
        bBusiness={bBusiness}
        qualifiedLevel={data.level}
      /> : <>

      <section className="balance-hero">
        <div><span className="metric-label"><CircleDollarSign size={15}/> TOTAL POSITION VALUE</span><strong>${money(totalPrincipal + Number(data.pending))}</strong><p><b>${money(totalPrincipal)}</b> invested principal <i/> <em>${money(data.pending)} available</em></p></div>
        <div className="balance-actions"><button className="test-faucet" disabled={busy} onClick={() => transact("mintTestToken")}><BadgeDollarSign size={17}/> Get 1,000 test mUSDT</button><button className="claim" disabled={busy || !account || Number(data.pending) <= 0} onClick={() => transact("claimRoi")}><ArrowDownToLine size={17}/> Claim ${money(data.pending)}</button><button disabled={busy || !account || Number(data.pending) < 1} onClick={() => transact("compoundRoi")}><TrendingUp size={17}/> Compound ROI</button></div>
        <div className="balance-art"><i/><i/><i/><i/><i/><i/></div>
      </section>

      <section className="portal-metrics">
        <article><div className="metric-icon blue"><Wallet/></div><span>Wallet balance</span><strong>${money(data.balance)}</strong><small>Available test mUSDT</small></article>
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
          <button className="portal-invest" disabled={busy} onClick={() => transact("invest")}>{busy ? "Processing transaction…" : account ? member && !member.registered ? "Register & create position" : "Approve & create position" : "Connect wallet to continue"}<ArrowUpRight size={17}/></button>
        </section>
      </div>

      <div className="portal-lower-grid">
        <section className="portal-card network-card">
          <div className="card-heading"><div><span>NETWORK</span><h2>Team business</h2></div><button onClick={() => setSection("network")}>Network details <ArrowUpRight size={14}/></button></div>
          <div className="business-numbers"><div><i className="a"/><span>Team A</span><b>${money(aBusiness, 0)}</b><small>{money(aPercent, 0)}% of volume</small></div><div><i className="b"/><span>Team B</span><b>${money(bBusiness, 0)}</b><small>{money(bPercent, 0)}% of volume</small></div></div>
          <div className="business-bar"><i style={{width: `${aPercent}%`}}/><b style={{width: `${bPercent}%`}}/></div>
          <div className="qualification"><span>Current qualification</span><b>Referral level {data.level} of 15</b></div>
        </section>
        <section className="portal-card salary-card">
          <div className="salary-icon"><Crown/></div><div><span>SALARY PROGRAM</span><h2>Rank {member ? Number(member.salaryRank) : 0}</h2><p>Six reward cycles unlock every 15 days after reaching a balanced-business milestone.</p></div>
          <button disabled={busy || !account} onClick={() => transact("claimSalary")}>Claim available salary <ArrowUpRight size={15}/></button>
        </section>
      </div>
      </>}
    </main>
  </div>;
}
