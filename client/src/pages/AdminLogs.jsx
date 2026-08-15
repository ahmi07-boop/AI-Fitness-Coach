import { useEffect, useMemo, useState } from "react";
import { getAdminLogs, getAIUsageLogs, getErrorLogs } from "../services/adminApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";


const tabs = [
  { id: "system", label: "System Logs", icon: FileText },
  { id: "ai", label: "AI Usage", icon: Bot },
  { id: "errors", label: "Errors", icon: AlertTriangle },
];

function AdminLogs() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState("system");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [systemData, setSystemData] = useState([]);
  const [aiData, setAIData] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([getAdminLogs(), getAIUsageLogs(), getErrorLogs()])
      .then(([systemResponse, aiResponse, errorResponse]) => {
        const logs = systemResponse.data?.data?.logs || [];
        setSystemData(logs.map((item) => ({ id: String(item._id), time: new Date(item.createdAt).toLocaleString(), event: item.event, user: item.targetUser?.name || item.admin?.name || "System", status: item.status })));
        const ai = aiResponse.data?.data?.logs || [];
        setAIData(ai.map((item) => ({ id: String(item._id), model: item.model || "OpenAI", requests: 1, tokens: item.totalTokens || 0, latency: `${item.latencyMs || 0}ms`, usage: item.operation })));
        const err = errorResponse.data?.data?.logs || [];
        setErrorData(err.map((item) => ({ id: String(item._id), time: new Date(item.createdAt).toLocaleString(), endpoint: item.metadata?.endpoint || "server", error: item.event, status: item.status })));
      })
      .catch((error) => setLoadError(error.response?.data?.message || "Unable to load logs."));
  }, []);

  const filteredSystem = useMemo(() => systemData.filter((item) => {
    const haystack = `${item.event} ${item.user} ${item.status} ${item.time}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (status === "All" || item.status === status);
  }), [search, status, systemData]);

  const filteredAI = useMemo(() => aiData.filter((item) => {
    const haystack = `${item.model} ${item.requests} ${item.tokens} ${item.usage}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [search, aiData]);

  const filteredErrors = useMemo(() => errorData.filter((item) => {
    const haystack = `${item.endpoint} ${item.error} ${item.status} ${item.time}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (status === "All" || item.status === status);
  }), [search, status, errorData]);

  const resetFilters = () => {
    setSearch("");
    setStatus("All");
  };

  return (
    <div className="admin-users-page admin-logs-page">
      <aside className="admin-users-sidebar">
        <div className="admin-users-sidebar-glow" />
        <div className="admin-users-brand">
          <div className="admin-users-brand-icon"><Activity size={21} /></div>
          <div><strong>FitCoach AI</strong><span>Admin Console</span></div>
        </div>
        <div className="admin-users-system">
          <div className="admin-users-system-icon"><Bot size={17} /><span /></div>
          <div><strong>AI System</strong><small><i />Operational</small></div>
        </div>
        <nav className="admin-users-nav">
          <span className="admin-users-nav-title">MAIN MENU</span>
          <AdminNav icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => navigate("/admin")} />
          <AdminNav icon={<Users size={18} />} label="Users" badge="—" onClick={() => navigate("/admin/users")} />
          <AdminNav icon={<Bot size={18} />} label="AI Outputs" badge="NEW" ai onClick={() => navigate("/admin/ai")} />
          <AdminNav icon={<ClipboardList size={18} />} label="Plans" onClick={() => navigate("/admin/plans")} />
          <span className="admin-users-nav-title second">MODERATION</span>
          <AdminNav icon={<Image size={18} />} label="Image Moderation" badge="—" warning onClick={() => navigate("/admin/moderation")} />
          <AdminNav icon={<MessageSquare size={18} />} label="Chat Moderation" badge="—" warning onClick={() => navigate("/admin/moderation")} />
          <AdminNav icon={<FileText size={18} />} label="Logs" active />
        </nav>
        <div className="admin-users-sidebar-bottom">
          <div className="admin-users-admin-profile">
            <div className="admin-users-admin-avatar">{authUser?.name?.trim()?.charAt(0)?.toUpperCase() || "A"}</div>
            <div><strong>{authUser?.name || "Admin"}</strong><span>{authUser?.role === "admin" ? "Administrator" : "Admin"}</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      {loadError && <div className="admin-users-ai-banner" style={{ margin: 16 }}><strong>{loadError}</strong></div>}
      <main className="admin-users-main">
        <header className="admin-users-header">
          <div>
            <button className="admin-users-back" onClick={() => navigate("/admin")} type="button"><ArrowLeft size={15} /> Back to Dashboard</button>
            <div className="admin-users-breadcrumb"><span>Admin Console</span><ChevronRight size={13} /><strong>System & AI Logs</strong></div>
            <div className="admin-users-title-row">
              <div>
                <div className="admin-users-eyebrow"><FileText size={13} /> SYSTEM &amp; AI LOGS</div>
                <h1>System &amp; AI Logs</h1>
                <p>Track platform events, AI usage, token consumption and application errors.</p>
              </div>
              <div className="admin-users-live"><span /> LIVE LOGGING</div>
            </div>
          </div>
          <div className="admin-users-header-actions"><div className="admin-users-secure"><ShieldCheck size={16} /> Secure</div></div>
        </header>

        <section className="admin-users-ai-banner admin-logs-banner">
          <div className="admin-users-ai-banner-glow" />
          <div className="admin-users-ai-left">
            <div className="admin-users-ai-avatar"><div /><Bot size={22} /></div>
            <div>
              <div className="admin-users-ai-label"><Sparkles size={12} /> OBSERVABILITY CENTER <span>ACTIVE</span></div>
              <strong>Every important platform event is available for review</strong>
              <p>Monitor system activity, AI requests and application health from one admin workspace.</p>
            </div>
          </div>
          <div className="admin-users-ai-stats">
            <div><span>Events</span><strong>{systemData.length}</strong></div>
            <div><span>AI Requests</span><strong>{aiData.length.toLocaleString()}</strong></div>
            <div><span>Errors</span><strong>{errorData.length}</strong></div>
          </div>
        </section>

        <section className="admin-logs-summary-grid">
          <SummaryCard icon={<Activity size={18} />} label="System Events" value={systemData.length.toLocaleString()} meta="Loaded" />
          <SummaryCard icon={<Zap size={18} />} label="AI Requests" value={aiData.length.toLocaleString()} meta="Loaded" />
          <SummaryCard icon={<Bot size={18} />} label="Tokens Used" value={aiData.reduce((sum, item) => sum + Number(item.tokens || 0), 0).toLocaleString()} meta="Loaded" />
          <SummaryCard icon={<AlertTriangle size={18} />} label="Errors" value={errorData.length.toLocaleString()} meta="Loaded" danger />
        </section>

        <section className="admin-users-content-card admin-logs-card">
          <div className="admin-logs-toolbar">
            <div className="admin-logs-tabs">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => { setTab(id); resetFilters(); }}>
                  <Icon size={15} /> {label}
                  <span>{id === "system" ? systemData.length : id === "ai" ? aiData.length : errorData.length}</span>
                </button>
              ))}
            </div>
            <div className="admin-logs-filter-row">
              <label className="admin-logs-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search logs..." /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter logs">
                <option value="All">All statuses</option>
                {tab === "system" && <><option value="Success">Success</option><option value="Updated">Updated</option><option value="Flagged">Flagged</option></>}
                {tab === "errors" && <><option value="500">500</option><option value="429">429</option><option value="400">400</option><option value="422">422</option><option value="401">401</option></>}
              </select>
              {(search || status !== "All") && <button className="admin-logs-reset" type="button" onClick={resetFilters}>Reset</button>}
            </div>
          </div>

          {tab === "system" && (
            <div className="admin-logs-table-wrap">
              <table className="admin-users-table admin-logs-table">
                <thead><tr><th>Time</th><th>Event</th><th>User</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredSystem.map((item) => <tr key={item.id}><td><span className="admin-log-time"><Clock3 size={13} /> {item.time}</span></td><td><strong>{item.event}</strong></td><td>{item.user}</td><td><LogStatus value={item.status} /></td></tr>)}
                </tbody>
              </table>
              {!filteredSystem.length && <EmptyState />}
            </div>
          )}

          {tab === "ai" && (
            <div className="admin-logs-table-wrap">
              <table className="admin-users-table admin-logs-table ai-usage-table">
                <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Average Latency</th><th>Estimated Usage</th></tr></thead>
                <tbody>
                  {filteredAI.map((item) => <tr key={item.id}><td><div className="admin-log-model"><span><Bot size={13} /></span><strong>{item.model}</strong></div></td><td>{item.requests.toLocaleString()}</td><td>{item.tokens.toLocaleString()}</td><td><span className="admin-log-latency"><Clock3 size={13} /> {item.latency}</span></td><td><strong className="admin-log-cost">{item.usage}</strong></td></tr>)}
                </tbody>
              </table>
              {!filteredAI.length && <EmptyState />}
            </div>
          )}

          {tab === "errors" && (
            <div className="admin-logs-table-wrap">
              <table className="admin-users-table admin-logs-table errors-table">
                <thead><tr><th>Time</th><th>Endpoint</th><th>Error</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredErrors.map((item) => <tr key={item.id}><td><span className="admin-log-time"><Clock3 size={13} /> {item.time}</span></td><td><code>{item.endpoint}</code></td><td><strong className="admin-log-error-text">{item.error}</strong></td><td><span className="admin-error-code">{item.status}</span></td></tr>)}
                </tbody>
              </table>
              {!filteredErrors.length && <EmptyState />}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value, meta, danger = false }) {
  return <div className={`admin-logs-summary-card ${danger ? "danger" : ""}`}><div className="admin-logs-summary-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></div>;
}

function LogStatus({ value }) {
  const kind = value.toLowerCase();
  return <span className={`admin-log-status ${kind}`}><i />{value}</span>;
}

function EmptyState() {
  return <div className="admin-logs-empty"><CheckCircle2 size={24} /><strong>No matching logs</strong><span>Try a different search or filter.</span></div>;
}

function AdminNav({ icon, label, badge, ai, warning, active, onClick }) {
  return <button type="button" className={`admin-users-nav-item ${active ? "active" : ""} ${ai ? "ai" : ""} ${warning ? "warning" : ""}`} onClick={onClick}><span className="admin-users-nav-icon">{icon}</span><span className="admin-users-nav-label">{label}</span>{badge && <span className="admin-users-nav-badge">{badge}</span>}</button>;
}

export default AdminLogs;
