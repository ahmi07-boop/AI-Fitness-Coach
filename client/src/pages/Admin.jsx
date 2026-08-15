import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getAdminSummary } from "../services/adminApi";

import {
  Activity,
  Bot,
  ChevronRight,
  ClipboardList,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Admin() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const safePlanCompletionDaily = Array.isArray(summary?.planCompletionDaily) ? summary.planCompletionDaily : [];
  const safeActiveUsersDaily = Array.isArray(summary?.activeUsersDaily) ? summary.activeUsersDaily : [];
  const safeUserGrowth = Array.isArray(summary?.userGrowth) ? summary.userGrowth : [];
  const safeAiUsageDaily = Array.isArray(summary?.aiUsageDaily) ? summary.aiUsageDaily : [];
  const safeActivity = Array.isArray(summary?.activity) ? summary.activity : [];

  const validatedUserGrowth = safeUserGrowth.filter((item) => item && typeof item.month === "string" && Number.isFinite(Number(item.users))).map((item) => ({ month: item.month, users: Math.max(0, Number(item.users)) }));
  const validatedActiveUsersDaily = safeActiveUsersDaily.filter((item) => item && typeof item.day === "string" && Number.isFinite(Number(item.users))).map((item) => ({ day: item.day, users: Math.max(0, Number(item.users)) }));
  const validatedPlanCompletionDaily = safePlanCompletionDaily.filter((item) => item && typeof item.day === "string" && Number.isFinite(Number(item.completion))).map((item) => ({ day: item.day, completion: Math.min(100, Math.max(0, Number(item.completion))) }));
  const validatedAiUsageDaily = safeAiUsageDaily.filter((item) => item && typeof item.day === "string" && Number.isFinite(Number(item.requests))).map((item) => ({ day: item.day, requests: Math.max(0, Number(item.requests)) }));

  useEffect(() => {
    let mounted = true;
    const loadSummary = () => getAdminSummary()
      .then((response) => { if (mounted) { setSummary(response.data?.data || null); setSummaryError(""); } })
      .catch((error) => { if (mounted) setSummaryError(error.response?.data?.message || "Unable to load live admin metrics."); });
    loadSummary();
    const refreshId = window.setInterval(loadSummary, 30000);
    return () => { mounted = false; window.clearInterval(refreshId); };
  }, []);

  return (
    <div className="admin-layout">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="admin-sidebar">

        <div className="admin-sidebar-glow" />

        {/* BRAND */}

        <div className="admin-brand">

          <div className="admin-brand-icon">
            <Activity size={21} />
          </div>

          <div className="admin-brand-text">
            <strong>FitCoach AI</strong>
            <span>Admin Console</span>
          </div>

        </div>

        {/* AI STATUS */}

        <div className="admin-ai-status">

          <div className="admin-ai-status-icon">
            <Bot size={17} />
            <span />
          </div>

          <div className="admin-ai-status-content">
            <strong>AI System</strong>

            <span>
              <i />
              All systems operational
            </span>
          </div>

          <div className="admin-ai-status-pulse" />

        </div>

        {/* NAVIGATION */}

        <div className="admin-nav-section">

          <span className="admin-nav-title">
            MAIN MENU
          </span>

          <AdminNavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active
          />

          <AdminNavItem
            icon={<Users size={18} />}
            label="Users"
            badge={summary ? summary.users.toLocaleString() : "—"}
            onClick={() => navigate("/admin/users")}
          />

          <AdminNavItem
            icon={<Bot size={18} />}
            label="AI Outputs"
            badge={summary ? String(summary.aiRequests ?? 0) : "0"}
            ai
            onClick={() => navigate("/admin/ai")}
          />

          <AdminNavItem
            icon={<ClipboardList size={18} />}
            label="Plans"
           onClick={() => navigate("/admin/plans")} />

        </div>

        <div className="admin-nav-section">

          <span className="admin-nav-title">
            MODERATION
          </span>

          <AdminNavItem
            icon={<Image size={18} />}
            label="Image Moderation"
            badge={summary ? summary.flaggedImages.toLocaleString() : "—"}
            warning
            onClick={() => navigate("/admin/moderation?tab=images")}
          />

          <AdminNavItem
            icon={<MessageSquare size={18} />}
            label="Chat Moderation"
            badge={summary ? summary.flaggedChats.toLocaleString() : "—"}
            warning
            onClick={() => navigate("/admin/moderation?tab=chat")}
          />

          <AdminNavItem
            icon={<FileText size={18} />}
            label="Logs"
            onClick={() => navigate("/admin/logs")}
          />

        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="admin-sidebar-bottom">

          <div className="admin-profile">

            <div className="admin-profile-avatar">
              A
            </div>

            <div className="admin-profile-info">
              <strong>{authUser?.name || "Admin"}</strong>
              <span>{authUser?.role === "admin" ? "Administrator" : "Admin"}</span>
            </div>

            <MoreHorizontal size={17} />

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="admin-main">

        {/* TOP HEADER */}

        <header className="admin-header">

          <div className="admin-header-left">

            <div className="admin-breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>Dashboard</strong>
            </div>

            <div className="admin-title-row">

              <div>

                <h1>
                  Platform Overview
                </h1>

                <p>
                  Monitor users, AI activity and
                  platform performance.
                </p>

              </div>

              <div className="admin-live-badge">
                <span />
                LIVE
              </div>

            </div>

          </div>

          <div className="admin-header-actions">

            
            <button
              className="admin-security-button"
              type="button"
            >
              <ShieldCheck size={16} />
              <span>Secure</span>
            </button>

          </div>

        </header>

        {summaryError && <div className="admin-users-ai-banner" style={{ marginBottom: 18 }}><strong>{summaryError}</strong></div>}

        {/* =================================================
            AI SYSTEM BANNER
        ================================================= */}

        <section className="admin-ai-banner">

          <div className="admin-ai-banner-background" />

          <div className="admin-ai-banner-left">

            <div className="admin-ai-pulse">

              <div className="admin-ai-pulse-ring" />

              <Bot size={21} />

            </div>

            <div>

              <div className="admin-ai-label">

                <Sparkles size={13} />

                AI PLATFORM

                <span>
                  LIVE
                </span>

              </div>

              <strong>
                FitCoach AI systems are operating normally
              </strong>

              <p>
                AI coaching, body analysis and
                fitness recommendations are online.
              </p>

            </div>

          </div>

          <div className="admin-ai-metrics">

            <AdminAIMetric
              label="AI Requests"
              value={(summary?.aiRequests ?? summary?.chatbotRequests)?.toLocaleString?.() || "0"}
            />

            <AdminAIMetric
              label="Avg. Response"
              value={`${summary?.avgResponseMs ?? 0}ms`}
            />

            <AdminAIMetric
              label="Uptime"
              value={formatUptime(summary?.uptimeSeconds)}
            />

          </div>

        </section>

        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="admin-stat-grid">

          <AdminStatCard
            icon={<Users size={20} />}
            label="Total Users"
            value={summary?.users?.toLocaleString() || "—"}
            change="Live"
            description="vs last month"
          />

          <AdminStatCard
            icon={<UserCheck size={20} />}
            label="Active Users Today"
            value={summary?.activeToday?.toLocaleString() || "—"}
            change="Live"
            description="vs yesterday"
          />

          <AdminStatCard
            icon={<ClipboardList size={20} />}
            label="Plan Completion"
            value={summary ? `${summary.planCompletion}%` : "—"}
            change="Live"
            description="vs last month"
          />

          <AdminStatCard
            icon={<MessageSquare size={20} />}
            label="Chatbot Requests"
            value={(summary?.aiRequests ?? summary?.chatbotRequests)?.toLocaleString?.() || "0"}
            change="Live"
            description="this month"
            ai
          />

          <AdminStatCard
            icon={<Activity size={20} />}
            label="Average Fitness Score"
            value={summary?.averageFitnessScore || "—"}
            change="Live"
            description="platform average"
          />

        </section>

        {/* =================================================
            USER GROWTH
        ================================================= */}

        <section className="admin-chart-card admin-large-chart">

          <ChartHeader
            eyebrow="USER ANALYTICS"
            title="User Growth"
            description="Total registered users across the platform."
            value={summary?.users?.toLocaleString() || "—"}
            change="Live"
          />

          <div className="admin-chart-container">

            <ResponsiveContainer
              width="100%"
              height={330}
            >
              <AreaChart data={validatedUserGrowth}>

                <defs>

                  <linearGradient
                    id="userGrowthGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#42e89a"
                      stopOpacity={0.28}
                    />

                    <stop
                      offset="100%"
                      stopColor="#42e89a"
                      stopOpacity={0}
                    />
                  </linearGradient>

                </defs>

                <CartesianGrid
                  stroke="#1e2a34"
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#71808d",
                    fontSize: 12,
                  }}
                  dy={10}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#71808d",
                    fontSize: 12,
                  }}
                  tickFormatter={(value) =>
                    `${value / 1000}K`
                  }
                />

                <Tooltip
                  contentStyle={{
                    background: "#101821",
                    border:
                      "1px solid #2a3946",
                    borderRadius: "12px",
                    color: "#ffffff",
                    boxShadow:
                      "0 15px 40px rgba(0,0,0,.35)",
                  }}
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    "Users",
                  ]}
                  labelStyle={{
                    color: "#8d9aa6",
                    marginBottom: "5px",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#42e89a"
                  strokeWidth={3}
                  fill="url(#userGrowthGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 3,
                    stroke: "#07100c",
                    fill: "#42e89a",
                  }}
                />

              </AreaChart>
            </ResponsiveContainer>

          </div>

        </section>

        {/* =================================================
            SECONDARY CHARTS
        ================================================= */}

        <div className="admin-chart-grid">

          {/* ACTIVE USERS */}

          <section className="admin-chart-card">

            <ChartHeader
              eyebrow="ACTIVITY"
              title="Active Users"
              description="Daily active users this week."
              miniValue={summary?.activeToday?.toLocaleString() || "0"}
              miniIcon={<UserPlus size={15} />}
            />

            <div className="admin-chart-container small">

              <ResponsiveContainer
                width="100%"
                height={270}
              >
                <BarChart
                  data={validatedActiveUsersDaily}
                  barCategoryGap="25%"
                >

                  <CartesianGrid
                    stroke="#1e2a34"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#71808d",
                      fontSize: 12,
                    }}
                    dy={8}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#71808d",
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    cursor={{
                      fill: "rgba(66,232,154,.04)",
                    }}
                    contentStyle={{
                      background: "#101821",
                      border:
                        "1px solid #2a3946",
                      borderRadius: "12px",
                    }}
                  />

                  <Bar
                    dataKey="users"
                    fill="#42e89a"
                    radius={[
                      6,
                      6,
                      2,
                      2,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>

            </div>

          </section>

          {/* PLAN COMPLETION */}

          <section className="admin-chart-card">

            <ChartHeader
              eyebrow="PLANS"
              title="Plan Completion"
              description="Percentage of plans completed."
              miniValue={summary ? `${summary.planCompletion}%` : "0%"}
              miniIcon={<ClipboardList size={15} />}
            />

            <div className="admin-chart-container small">

              <ResponsiveContainer
                width="100%"
                height={270}
              >
                <LineChart data={validatedPlanCompletionDaily}>

                  <CartesianGrid
                    stroke="#1e2a34"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#71808d",
                      fontSize: 12,
                    }}
                    dy={8}
                  />

                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#71808d",
                      fontSize: 11,
                    }}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#101821",
                      border:
                        "1px solid #2a3946",
                      borderRadius: "12px",
                    }}
                    formatter={(value) => [
                      `${value}%`,
                      "Completion",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="completion"
                    stroke="#42e89a"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#42e89a",
                      strokeWidth: 2,
                      stroke: "#09130e",
                    }}
                    activeDot={{
                      r: 6,
                    }}
                  />

                </LineChart>
              </ResponsiveContainer>

            </div>

          </section>

        </div>

        {/* =================================================
            AI USAGE
        ================================================= */}

        <section className="admin-chart-card admin-ai-chart-card">

          <div className="admin-ai-chart-glow" />

          <ChartHeader
            eyebrow="ARTIFICIAL INTELLIGENCE"
            title="AI Usage"
            description="Chatbot and AI-powered feature requests."
            value={(summary?.aiRequests ?? summary?.chatbotRequests)?.toLocaleString?.() || "0"}
            change="Live"
            ai
          />

          <div className="admin-chart-container">

            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <AreaChart data={validatedAiUsageDaily}>

                <defs>

                  <linearGradient
                    id="aiUsageGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#42e89a"
                      stopOpacity={0.25}
                    />

                    <stop
                      offset="100%"
                      stopColor="#42e89a"
                      stopOpacity={0}
                    />

                  </linearGradient>

                </defs>

                <CartesianGrid
                  stroke="#1e2a34"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#71808d",
                    fontSize: 12,
                  }}
                  dy={8}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#71808d",
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  contentStyle={{
                    background: "#101821",
                    border:
                      "1px solid #2a3946",
                    borderRadius: "12px",
                  }}
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    "AI Requests",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#42e89a"
                  strokeWidth={3}
                  fill="url(#aiUsageGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 3,
                    stroke: "#09130e",
                    fill: "#42e89a",
                  }}
                />

              </AreaChart>
            </ResponsiveContainer>

          </div>

          <div className="admin-ai-generated">

            <div className="admin-ai-generated-icon">
              <Sparkles size={14} />
            </div>

            <div>
              <strong>AI Generated Analytics</strong>
              <span>
                Live usage data is loaded from MongoDB.
              </span>
            </div>

            <span className="admin-ai-dot" />

          </div>

        </section>

        {/* =================================================
            LOWER PANELS
        ================================================= */}

        <div className="admin-bottom-grid">

          
          {/* SYSTEM ACTIVITY */}

          <section className="admin-table-card admin-activity-card">

            <div className="admin-ai-chart-glow admin-activity-glow" />

            <div className="admin-table-header">

              <div>
                <span>SYSTEM ACTIVITY</span>

                <h2>
                  Platform Activity
                </h2>
              </div>

              <div className="admin-system-live">
                <span />
                Live
              </div>

            </div>

            <div className="admin-activity-list">

              {safeActivity.length ? safeActivity.map((item) => (
                <AdminActivity key={item.id} icon={<ActivityIcon type={item.type} />} title={item.title} detail={item.detail} time={formatActivityTime(item.createdAt)} status={item.status} />
              )) : (
                <div className="admin-activity-empty">No platform activity has been recorded yet.</div>
              )}

            </div>

          </section>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="admin-footer">

          <div>
            <div className="admin-footer-brand">
              <div>
                <Activity size={13} />
              </div>

              FitCoach AI
            </div>

            <span>
              Admin Console
            </span>
          </div>

          <div className="admin-footer-right">

            <span>
              Live dashboard
            </span>

            <i />

            <span>
              Connected to live analytics
            </span>

            <i />

            <span>
              v1.0
            </span>

          </div>

        </footer>

      </main>

    </div>
  );
}

/* =========================================================
   NAVIGATION ITEM
========================================================= */

function AdminNavItem({
  icon,
  label,
  active = false,
  badge,
  ai = false,
  warning = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`admin-nav-item ${
        active ? "active" : ""
      }`}
    >

      <span className="admin-nav-icon">
        {icon}
      </span>

      <span className="admin-nav-label">
        {label}
      </span>

      {badge && (
        <span
          className={`admin-nav-badge ${
            ai
              ? "ai"
              : warning
              ? "warning"
              : ""
          }`}
        >
          {badge}
        </span>
      )}

      {active && (
        <span className="admin-nav-active-line" />
      )}

    </button>
  );
}

/* =========================================================
   AI METRIC
========================================================= */

function AdminAIMetric({
  label,
  value,
}) {
  return (
    <div className="admin-ai-metric">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function AdminStatCard({
  icon,
  label,
  value,
  change,
  description,
  ai = false,
}) {
  return (
    <div
      className={`admin-stat-card ${
        ai ? "ai-stat" : ""
      }`}
    >

      <div className="admin-stat-top">

        <div className="admin-stat-icon">
          {icon}
        </div>

        <MoreHorizontal
          size={16}
          className="admin-stat-menu"
        />

      </div>

      <span className="admin-stat-label">
        {label}
      </span>

      <div className="admin-stat-value">
        {value}
      </div>

      <div className="admin-stat-change">

        <span className="admin-positive">
          <TrendingUp size={12} />
          {change}
        </span>

        <span>
          {description}
        </span>

      </div>

      {ai && (
        <div className="admin-stat-ai-label">
          <Sparkles size={11} />
          AI METRIC
        </div>
      )}

    </div>
  );
}

/* =========================================================
   CHART HEADER
========================================================= */

function ChartHeader({
  eyebrow,
  title,
  description,
  value,
  change,
  miniValue,
  miniIcon,
  ai = false,
}) {
  return (
    <div className="admin-chart-header">

      <div>

        <div className="admin-chart-eyebrow">

          {ai && (
            <Sparkles size={12} />
          )}

          {eyebrow}

          {ai && (
            <span>
              AI
            </span>
          )}

        </div>

        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>

      </div>

      <div className="admin-chart-header-right">

        {value && (
          <div className="admin-chart-value">

            <strong>
              {value}
            </strong>

            {change && (
              <span>
                <TrendingUp size={12} />
                {change}
              </span>
            )}

          </div>
        )}

        {miniValue && (
          <div className="admin-mini-stat">
            {miniIcon}
            {miniValue}
          </div>
        )}

      </div>

    </div>
  );
}

/* =========================================================
   SYSTEM ACTIVITY
========================================================= */

function ActivityIcon({ type }) {
  if (type === "ai") return <Sparkles size={15} />;
  if (type === "user") return <Users size={15} />;
  if (type === "chat") return <MessageSquare size={15} />;
  if (type === "moderation") return <Shield size={15} />;
  return <Activity size={15} />;
}

function formatActivityTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AdminActivity({ icon, title, detail, time, status }) {
  return (
    <div className="admin-activity-row">
      <div className="admin-activity-icon">{icon}</div>
      <div className="admin-activity-info">
        <strong>{title}</strong>
        <span>{detail}{status ? ` · ${status}` : ""}</span>
      </div>
      <time>{time}</time>
    </div>
  );
}

export default Admin;
