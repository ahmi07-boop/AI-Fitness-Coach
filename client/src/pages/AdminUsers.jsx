import { useEffect, useMemo, useState } from "react";
import { getAdminUsers, updateAdminUser, getAdminUserAvatar } from "../services/adminApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  ArrowLeft,
  Ban,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserMinus,
  Users,
  X,
  Zap,
} from "lucide-react";


const filters = ["All", "Active", "Inactive", "Banned"];

function AdminUsers() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActions, setShowActions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    getAdminUsers()
      .then((response) => {
        if (!mounted) return;
        const data = response.data?.data?.users || [];
        setUsers(data.map((item) => ({
          ...item,
          id: String(item._id || item.id),
          status: item.accountStatus === "banned" ? "Banned" : item.accountStatus === "inactive" ? "Inactive" : "Active",
          score: item.progressStats?.averageFitnessScore || 0,
          lastLogin: item.lastLogin ? new Date(item.lastLogin).toLocaleString() : "Never",
          plan: item.plan?.title || item.plan?.goal || "No plan",
          streak: 0,
          progress: item.progressStats?.averageCompletion || 0,
          joined: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—",
          workouts: item.progressStats?.workouts || 0,
          calories: item.plan?.calories ? String(item.plan.calories) : "—",
          summary: item.progressStats?.entries ? `Tracked ${item.progressStats.entries} progress entries with ${item.progressStats.averageCompletion}% average habit completion.` : "No progress data yet.",
        })));
      })
      .catch((error) => { if (mounted) setLoadError(error.response?.data?.message || "Unable to load users."); });
    return () => { mounted = false; };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesFilter =
        activeFilter === "All" ||
        user.status === activeFilter;

      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        String(user.plan || "").toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [users, search, activeFilter]);

  const counts = useMemo(() => {
    return {
      All: users.length,
      Active: users.filter(
        (user) => user.status === "Active"
      ).length,
      Inactive: users.filter(
        (user) => user.status === "Inactive"
      ).length,
      Banned: users.filter(
        (user) => user.status === "Banned"
      ).length,
    };
  }, [users]);

  const updateStatus = async (id, status) => {
    const previous = users;
    setUsers((currentUsers) => currentUsers.map((user) => user.id === id ? { ...user, status } : user));
    setShowActions(null);
    try {
      await updateAdminUser(id, {
        accountStatus: status === "Banned" ? "banned" : status === "Inactive" ? "inactive" : "active",
      });
      setSelectedUser((current) => current?.id === id ? { ...current, status } : current);
    } catch (error) {
      setUsers(previous);
      setLoadError(error.response?.data?.message || "Unable to update user status.");
    }
  };

  useEffect(() => {
    let active = true;
    if (!selectedUser?.id) { setSelectedAvatarUrl(""); return () => { active = false; }; }
    getAdminUserAvatar(selectedUser.id).then((response) => {
      if (!active) return;
      const url = URL.createObjectURL(response.data);
      setSelectedAvatarUrl(url);
    }).catch(() => { if (active) setSelectedAvatarUrl(""); });
    return () => { active = false; };
  }, [selectedUser?.id]);

  const getInitials = (name) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="admin-users-page">
      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside className="admin-users-sidebar">
        <div className="admin-users-sidebar-glow" />

        <div className="admin-users-brand">
          <div className="admin-users-brand-icon">
            <Activity size={21} />
          </div>

          <div>
            <strong>FitCoach AI</strong>
            <span>Admin Console</span>
          </div>
        </div>

        <div className="admin-users-system">
          <div className="admin-users-system-icon">
            <Bot size={17} />
            <span />
          </div>

          <div>
            <strong>AI System</strong>
            <small>
              <i />
              Operational
            </small>
          </div>
        </div>

        <nav className="admin-users-nav">
          <span className="admin-users-nav-title">
            MAIN MENU
          </span>

          <AdminUsersNavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            onClick={() => navigate("/admin")}
          />

          <AdminUsersNavItem
            icon={<Users size={18} />}
            label="Users"
            active
            badge="—"
          />

          <AdminUsersNavItem
            icon={<Bot size={18} />}
            label="AI Outputs"
            badge="NEW"
            ai
            onClick={() => navigate("/admin/ai")}
          />

          <AdminUsersNavItem
            icon={<ClipboardList size={18} />}
            label="Plans"
           onClick={() => navigate("/admin/plans")} />

          <span className="admin-users-nav-title second">
            MODERATION
          </span>

          <AdminUsersNavItem
            icon={<Image size={18} />}
            label="Image Moderation"
            badge="—"
            warning
            onClick={() => navigate("/admin/moderation")}
          />

          <AdminUsersNavItem
            icon={<MessageSquare size={18} />}
            label="Chat Moderation"
            badge="—"
            warning
            onClick={() => navigate("/admin/moderation?tab=chat")}
          />

          <AdminUsersNavItem
            icon={<FileText size={18} />}
            label="Logs"
            onClick={() => navigate("/admin/logs")}
          />
        </nav>

        <div className="admin-users-sidebar-bottom">

          <div className="admin-users-admin-profile">
            <div className="admin-users-admin-avatar">
              A
            </div>

            <div>
              <strong>{authUser?.name || "Admin"}</strong>
              <span>{authUser?.role === "admin" ? "Administrator" : "Admin"}</span>
            </div>

            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      {/* =========================================
          MAIN
      ========================================= */}

      <main className="admin-users-main">
        {/* HEADER */}

        <header className="admin-users-header">
          <div>
            <button
              className="admin-users-back"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </button>

            <div className="admin-users-breadcrumb">
              <span>Admin Console</span>
              <ChevronRight size={13} />
              <strong>Users</strong>
            </div>

            <div className="admin-users-title-row">
              <div>
                <div className="admin-users-eyebrow">
                  <Users size={13} />
                  USER MANAGEMENT
                </div>

                <h1>User Management</h1>

                <p>
                  Monitor accounts, fitness progress and
                  platform activity.
                </p>
              </div>

              <div className="admin-users-live">
                <span />
                LIVE DATA
              </div>
            </div>
          </div>

          <div className="admin-users-header-actions">
            
            <div className="admin-users-secure">
              <ShieldCheck size={16} />
              Secure
            </div>
          </div>
        </header>

        {/* AI BANNER */}

        <section className="admin-users-ai-banner">
          <div className="admin-users-ai-banner-glow" />

          <div className="admin-users-ai-left">
            <div className="admin-users-ai-avatar">
              <div />
              <Bot size={22} />
            </div>

            <div>
              <div className="admin-users-ai-label">
                <Sparkles size={12} />
                AI USER INTELLIGENCE
                <span>LIVE</span>
              </div>

              <strong>
                User activity monitoring is operational
              </strong>

              <p>
                Fitness scores, plan activity and account
                signals are available for review.
              </p>
            </div>
          </div>

          <div className="admin-users-ai-stats">
            <div>
              <span>Active</span>
              <strong>{counts.Active}</strong>
            </div>

            <div>
              <span>Avg. Score</span>
              <strong>
                {Math.round(
                  users.reduce(
                    (sum, user) => sum + user.score,
                    0
                  ) / users.length
                )}
              </strong>
            </div>

            <div>
              <span>Streak</span>
              <strong>18d</strong>
            </div>
          </div>
        </section>

        {/* CONTENT CARD */}

        <section className="admin-users-content-card">
          {/* TOOLBAR */}

          <div className="admin-users-toolbar">
            <div>
              <span className="admin-users-section-label">
                PLATFORM USERS
              </span>

              <h2>
                All Users
                <span>{users.length}</span>
              </h2>
            </div>

            <div className="admin-users-search">
              <Search size={17} />

              <input
                type="text"
                value={search}
                placeholder="Search name, email or plan..."
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}

              <kbd>/</kbd>
            </div>
          </div>

          {/* FILTERS */}

          <div className="admin-users-filter-row">
            <div className="admin-users-filters">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={
                    activeFilter === filter
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveFilter(filter)
                  }
                >
                  {filter}

                  <span>
                    {counts[filter]}
                  </span>
                </button>
              ))}
            </div>

            <div className="admin-users-results">
              {filteredUsers.length}{" "}
              {filteredUsers.length === 1
                ? "user"
                : "users"}{" "}
              found
            </div>
          </div>

          {/* TABLE */}

          {loadError && <div className="admin-users-ai-banner" style={{ marginBottom: 14 }}><strong>{loadError}</strong></div>}

          <div className="admin-users-table-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>STATUS</th>
                  <th>FITNESS SCORE</th>
                  <th>LAST LOGIN</th>
                  <th>PLAN</th>
                  <th>ACTIVITY</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    {/* USER */}

                    <td>
                      <div className="admin-users-user-cell">
                        <div className="admin-users-avatar">
                          {getInitials(user.name)}

                          {user.status ===
                            "Active" && (
                            <span />
                          )}
                        </div>

                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* STATUS */}

                    <td>
                      <UserStatus
                        status={user.status}
                      />
                    </td>

                    {/* SCORE */}

                    <td>
                      <div className="admin-users-score-cell">
                        <div className="admin-users-score-top">
                          <strong>
                            {user.score}
                          </strong>

                          <span>/100</span>
                        </div>

                        <div className="admin-users-score-bar">
                          <div
                            style={{
                              width: `${user.score}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* LAST LOGIN */}

                    <td>
                      <div className="admin-users-login">
                        <Clock3 size={14} />
                        {user.lastLogin}
                      </div>
                    </td>

                    {/* PLAN */}

                    <td>
                      <span className="admin-users-plan">
                        <Target size={13} />
                        {user.plan}
                      </span>
                    </td>

                    {/* ACTIVITY */}

                    <td>
                      <div className="admin-users-activity">
                        <span>
                          <Zap size={13} />
                          {user.streak} day streak
                        </span>

                        <small>
                          {user.progress}% complete
                        </small>
                      </div>
                    </td>

                    {/* ACTIONS */}

                    <td>
                      <div className="admin-users-actions">
                        <button
                          className="admin-users-view-button"
                          onClick={() =>
                            setSelectedUser(user)
                          }
                        >
                          <Eye size={15} />
                          View
                        </button>

                        <button
                          className="admin-users-more"
                          onClick={() =>
                            setShowActions(
                              showActions === user.id
                                ? null
                                : user.id
                            )
                          }
                          aria-label="User actions"
                        >
                          <MoreHorizontal
                            size={17}
                          />
                        </button>

                        {showActions ===
                          user.id && (
                          <div className="admin-users-action-menu">
                            <button
                              onClick={() => {
                                setSelectedUser(
                                  user
                                );
                                setShowActions(null);
                              }}
                            >
                              <Eye size={15} />
                              View details
                            </button>

                            {user.status !==
                              "Inactive" && (
                              <button
                                onClick={() =>
                                  updateStatus(
                                    user.id,
                                    "Inactive"
                                  )
                                }
                              >
                                <UserMinus
                                  size={15}
                                />
                                Deactivate
                              </button>
                            )}

                            {user.status === "Inactive" && (
                              <button
                                onClick={() => updateStatus(user.id, "Active")}
                              >
                                <UserCheck size={15} />
                                Reactivate
                              </button>
                            )}

                            {user.status !==
                              "Banned" && (
                              <button
                                className="danger"
                                onClick={() =>
                                  updateStatus(
                                    user.id,
                                    "Banned"
                                  )
                                }
                              >
                                <Ban size={15} />
                                Ban user
                              </button>
                            )}

                            {user.status ===
                              "Banned" && (
                              <button
                                onClick={() =>
                                  updateStatus(
                                    user.id,
                                    "Active"
                                  )
                                }
                              >
                                <UserCheck
                                  size={15}
                                />
                                Reactivate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="admin-users-empty">
                <div>
                  <Search size={24} />
                </div>

                <strong>No users found</strong>

                <p>
                  Try changing your search or filter.
                </p>

                <button
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* TABLE FOOTER */}

          <div className="admin-users-table-footer">
            <span>
              Showing{" "}
              <strong>
                {filteredUsers.length}
              </strong>{" "}
              of <strong>{users.length}</strong> users
            </span>

            <div className="admin-users-pagination">
              <button disabled>
                <ChevronLeft size={15} />
              </button>

              <button className="active">1</button>

              <button>2</button>

              <button>3</button>

              <span>...</span>

              <button>12</button>

              <button>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* BOTTOM INSIGHT */}

        <section className="admin-users-insight">
          <div className="admin-users-insight-icon">
            <Sparkles size={18} />
          </div>

          <div>
            <span>AI GENERATED INSIGHT</span>

            <strong>
              User engagement remains healthy
            </strong>

            <p>
              Active users currently represent{" "}
              <b>
                {Math.round(
                  (counts.Active / users.length) *
                    100
                )}
                %
              </b>{" "}
              of the displayed accounts. Users with
              stronger streaks are showing higher
              fitness scores and plan completion.
            </p>
          </div>

          <div className="admin-users-insight-status">
            <CheckCircle2 size={15} />
            Healthy
          </div>
        </section>

        <footer className="admin-users-footer">
          <div>
            <strong>
              <Activity size={13} />
              FitCoach AI
            </strong>

            <span>Admin Console</span>
          </div>

          <div>
            <span>Live MongoDB data</span>
            <i />
            <span>No backend connected</span>
            <i />
            <span>v1.0</span>
          </div>
        </footer>
      </main>

      {/* =========================================
          DETAIL DRAWER
      ========================================= */}

      {selectedUser && (
        <div
          className="admin-users-drawer-overlay"
          onClick={() => setSelectedUser(null)}
        >
          <aside
            className="admin-users-drawer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-users-drawer-header">
              <div>
                <span>USER PROFILE</span>
                <h2>User Details</h2>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-users-drawer-profile">
              <div className="admin-users-drawer-avatar">
                {selectedAvatarUrl ? <img src={selectedAvatarUrl} alt={`${selectedUser.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : getInitials(selectedUser.name)}
                <span />
              </div>

              <h3>{selectedUser.name}</h3>

              <p>{selectedUser.email}</p>

              <UserStatus
                status={selectedUser.status}
              />
            </div>

            <div className="admin-users-drawer-ai">
              <div>
                <Sparkles size={15} />
              </div>

              <section>
                <span>AI USER SUMMARY</span>
                <p>
                  {selectedUser.summary}
                </p>
              </section>
            </div>

            <div className="admin-users-detail-grid">
              <DetailMetric
                icon={<Clock3 size={16} />}
                label="Last Login"
                value={selectedUser.lastLogin}
              />

              <DetailMetric
                icon={<Target size={16} />}
                label="Current Plan"
                value={selectedUser.plan}
              />

              <DetailMetric
                icon={<Activity size={16} />}
                label="Fitness Score"
                value={`${selectedUser.score}/100`}
              />

              <DetailMetric
                icon={<Zap size={16} />}
                label="Current Streak"
                value={`${selectedUser.streak} days`}
              />
            </div>

            <div className="admin-users-progress-card">
              <div>
                <span>PLAN PROGRESS</span>
                <strong>
                  {selectedUser.progress}%
                </strong>
              </div>

              <div className="admin-users-progress-bar">
                <div
                  style={{
                    width: `${selectedUser.progress}%`,
                  }}
                />
              </div>

              <p>
                User has completed{" "}
                {selectedUser.progress}% of their
                current fitness plan.
              </p>
            </div>

            <div className="admin-users-activity-detail">
              <div>
                <span>Joined</span>
                <strong>
                  {selectedUser.joined}
                </strong>
              </div>

              <div>
                <span>Workouts</span>
                <strong>
                  {selectedUser.workouts}
                </strong>
              </div>

              <div>
                <span>Daily Calories</span>
                <strong>
                  {selectedUser.calories}
                </strong>
              </div>
            </div>

            <div className="admin-users-drawer-actions">
              {selectedUser.status !==
                "Inactive" &&
                selectedUser.status !==
                  "Banned" && (
                  <button
                    onClick={() =>
                      updateStatus(
                        selectedUser.id,
                        "Inactive"
                      )
                    }
                  >
                    <UserMinus size={16} />
                    Deactivate
                  </button>
                )}

              {selectedUser.status !==
                "Banned" && (
                <button
                  className="danger"
                  onClick={() =>
                    updateStatus(
                      selectedUser.id,
                      "Banned"
                    )
                  }
                >
                  <Ban size={16} />
                  Ban User
                </button>
              )}

              {(selectedUser.status === "Inactive" || selectedUser.status === "Banned") && (
                <button
                  className="reactivate"
                  onClick={() => updateStatus(selectedUser.id, "Active")}
                >
                  <UserCheck size={16} />
                  Reactivate
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* =========================================
   SIDEBAR NAV
========================================= */

function AdminUsersNavItem({
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
      className={`admin-users-nav-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="admin-users-nav-icon">
        {icon}
      </span>

      <span>{label}</span>

      {badge && (
        <small
          className={`${ai ? "ai" : ""} ${
            warning ? "warning" : ""
          }`}
        >
          {badge}
        </small>
      )}

      {active && (
        <i className="admin-users-active-line" />
      )}
    </button>
  );
}

/* =========================================
   STATUS
========================================= */

function UserStatus({ status }) {
  const statusClass =
    status.toLowerCase();

  return (
    <span
      className={`admin-users-status ${statusClass}`}
    >
      <i />
      {status}
    </span>
  );
}

/* =========================================
   DRAWER METRIC
========================================= */

function DetailMetric({
  icon,
  label,
  value,
}) {
  return (
    <div className="admin-users-detail-metric">
      <div>{icon}</div>

      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

export default AdminUsers;