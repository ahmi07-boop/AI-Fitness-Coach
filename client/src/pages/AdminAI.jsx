import { useEffect, useMemo, useState } from "react";
import { getAIOutputs, getPromptTemplates, updateAIOutputStatus, updatePromptTemplate } from "../services/adminApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Flag,
  Zap,
} from "lucide-react";

const filters = ["All", "Approved", "Flagged", "Pending"];

function AdminAI() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [outputs, setOutputs] = useState([]);
  const [filter, setFilter] = useState("All");
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [promptText, setPromptText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [promptTemplates, setPromptTemplates] = useState([]);

  useEffect(() => {
    Promise.all([getAIOutputs(), getPromptTemplates()])
      .then(([outputsResponse, templatesResponse]) => {
        const items = outputsResponse.data?.data?.outputs || [];
        setOutputs(items.map((item) => ({
          ...item,
          id: String(item.id),
          user: item.user?.name || item.user?.email || `User ${String(item.user?._id || item.user || "—")}`,
          email: item.user?.email || "",
          created: item.createdAt ? new Date(item.createdAt).toLocaleString() : "—",
          timestamp: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—",
          tokens: Number.isFinite(Number(item.tokens)) ? Number(item.tokens).toLocaleString() : "—",
          moderation: item.status,
          promptSummary: `Generated ${item.type.toLowerCase()} using the user's saved fitness context.`,
          output: item.type === "Chatbot" ? item.output?.messages || [] : item.output?.summary || item.output?.title || "Generated plan",
        })));
        const savedTemplates = templatesResponse.data?.data?.templates || [];
        if (savedTemplates.length) setPromptTemplates(savedTemplates);
      })
      .catch((error) => setLoadError(error.response?.data?.message || "Unable to load AI monitoring data."));
  }, []);

  const filteredOutputs = useMemo(
    () =>
      outputs.filter(
        (output) => filter === "All" || output.status === filter
      ),
    [outputs, filter]
  );

  const updateStatus = async (id, status) => {
    const output = outputs.find((item) => item.id === id);
    const previous = outputs;
    setOutputs((current) => current.map((item) => item.id === id ? { ...item, status, moderation: status === "Pending" ? "Pending Review" : status } : item));
    try {
      await updateAIOutputStatus(id, { type: output?.type, status });
      setSelectedOutput((current) => current?.id === id ? { ...current, status, moderation: status } : current);
    } catch (error) {
      setOutputs(previous);
      setLoadError(error.response?.data?.message || "Unable to moderate AI output.");
    }
  };

  const getStatusClass = (status) => status.toLowerCase();

  return (
    <div className="admin-users-page admin-ai-page">
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
            <small><i />Operational</small>
          </div>
        </div>

        <nav className="admin-users-nav">
          <span className="admin-users-nav-title">MAIN MENU</span>
          <AdminNav icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => navigate("/admin")} />
          <AdminNav icon={<Users size={18} />} label="Users" badge="—" onClick={() => navigate("/admin/users")} />
          <AdminNav icon={<Bot size={18} />} label="AI Outputs" badge="NEW" ai active />
          <AdminNav icon={<ClipboardList size={18} />} label="Plans"  onClick={() => navigate("/admin/plans")} />

          <span className="admin-users-nav-title second">MODERATION</span>
          <AdminNav icon={<Image size={18} />} label="Image Moderation" badge="—" warning onClick={() => navigate("/admin/moderation")} />
          <AdminNav icon={<MessageSquare size={18} />} label="Chat Moderation" badge="—" warning onClick={() => navigate("/admin/moderation?tab=chat")} />
          <AdminNav icon={<FileText size={18} />} label="Logs" onClick={() => navigate("/admin/logs")} />
        </nav>

        <div className="admin-users-sidebar-bottom">
          <div className="admin-users-admin-profile">
            <div className="admin-users-admin-avatar">{authUser?.name?.trim()?.charAt(0)?.toUpperCase() || "A"}</div>
            <div>
              <strong>{authUser?.name || "Admin"}</strong>
              <span>{authUser?.role === "admin" ? "Administrator" : "Admin"}</span>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      {loadError && <div className="admin-users-ai-banner" style={{ margin: 16 }}><strong>{loadError}</strong></div>}
      <main className="admin-users-main">
        <header className="admin-users-header">
          <div>
            <button className="admin-users-back" onClick={() => navigate("/admin")} type="button">
              <ArrowLeft size={15} /> Back to Dashboard
            </button>

            <div className="admin-users-breadcrumb">
              <span>Admin Console</span>
              <ChevronRight size={13} />
              <strong>AI Outputs</strong>
            </div>

            <div className="admin-users-title-row">
              <div>
                <div className="admin-users-eyebrow">
                  <Bot size={13} /> AI OUTPUT MONITORING
                </div>
                <h1>AI Output Monitoring</h1>
                <p>Review generated plans, moderate AI responses and manage prompt templates.</p>
              </div>
              <div className="admin-users-live"><span /> LIVE MONITORING</div>
            </div>
          </div>

          <div className="admin-users-header-actions">
            <div className="admin-users-secure"><ShieldCheck size={16} /> Secure</div>
          </div>
        </header>

        <section className="admin-users-ai-banner admin-ai-monitor-banner">
          <div className="admin-users-ai-banner-glow" />
          <div className="admin-users-ai-left">
            <div className="admin-users-ai-avatar"><div /><Bot size={22} /></div>
            <div>
              <div className="admin-users-ai-label"><Sparkles size={12} /> AI OUTPUT INTELLIGENCE <span>LIVE</span></div>
              <strong>AI generation quality is under active review</strong>
              <p>Inspect model output, token usage and moderation status before approving generated content.</p>
            </div>
          </div>
          <div className="admin-users-ai-stats">
            <div><span>Total Outputs</span><strong>{outputs.length}</strong></div>
            <div><span>Flagged</span><strong>{outputs.filter((item) => item.status === "Flagged").length}</strong></div>
            <div><span>Tokens</span><strong>{outputs.reduce((sum, item) => sum + (Number.isFinite(Number(String(item.tokens).replace(/,/g, ""))) ? Number(String(item.tokens).replace(/,/g, "")) : 0), 0).toLocaleString()}</strong></div>
          </div>
        </section>

        <section className="admin-users-content-card admin-ai-output-card">
          <div className="admin-users-toolbar">
            <div>
              <span className="admin-users-section-label">GENERATED CONTENT</span>
              <h2>AI Outputs <span>{outputs.length}</span></h2>
            </div>
            <div className="admin-ai-review-note"><Zap size={14} /> Live AI monitoring data</div>
          </div>

          <div className="admin-ai-filter-row">
            <div className="admin-users-filters">
              {filters.map((item) => (
                <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                  {item}
                  <span>{item === "All" ? outputs.length : outputs.filter((output) => output.status === item).length}</span>
                </button>
              ))}
            </div>
            <span className="admin-ai-results">{filteredOutputs.length} outputs shown</span>
          </div>

          <div className="admin-users-table-wrapper">
            <table className="admin-users-table admin-ai-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>OUTPUT TYPE</th>
                  <th>MODEL</th>
                  <th>CREATED</th>
                  <th>STATUS</th>
                  <th>TOKENS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutputs.map((output) => (
                  <tr key={output.id}>
                    <td>
                      <div className="admin-users-user-cell">
                        <div className="admin-users-avatar">{output.user.split(" ").map((part) => part[0]).join("")}</div>
                        <div><strong>{output.user}</strong><span>{output.email}</span></div>
                      </div>
                    </td>
                    <td><span className="admin-ai-type"><Bot size={14} />{output.type}</span></td>
                    <td><span className="admin-ai-model">{output.model}</span></td>
                    <td><div className="admin-users-login"><Clock3 size={14} />{output.created}</div></td>
                    <td><span className={`admin-ai-status ${getStatusClass(output.status)}`}><i />{output.status}</span></td>
                    <td><strong className="admin-ai-token-value">{output.tokens}</strong></td>
                    <td>
                      <div className="admin-ai-actions">
                        <button type="button" className="admin-ai-action-view" onClick={() => setSelectedOutput(output)}><Eye size={14} />View</button>
                        <button type="button" title="Approve" onClick={() => updateStatus(output.id, "Approved")}><Check size={15} /></button>
                        <button type="button" className="flag" title="Flag" onClick={() => updateStatus(output.id, "Flagged")}><Flag size={14} /></button>
                        <button type="button" title="Edit" onClick={() => setSelectedOutput(output)}><Edit3 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-ai-templates-card">
          <div className="admin-ai-section-heading">
            <div>
              <span className="admin-users-section-label">ADMIN-CONTROLLED AI</span>
              <h2>Prompt Templates</h2>
              <p>Manage the prompts used to generate personalized fitness outputs.</p>
            </div>
            <div className="admin-ai-template-badge"><ShieldCheck size={14} /> Admin controlled</div>
          </div>

          <div className="admin-ai-template-grid">
            {promptTemplates.map((template) => (
              <article className="admin-ai-template" key={template.key || template.id}>
                <div className="admin-ai-template-icon"><Sparkles size={17} /></div>
                <div className="admin-ai-template-body">
                  <div className="admin-ai-template-title-row"><h3>{template.title}</h3><span>ACTIVE</span></div>
                  <p>{template.description}</p>
                  <small>{template.updated}</small>
                </div>
                <button type="button" className="admin-ai-edit-template" onClick={() => { setEditingTemplate(template); setPromptText(template.template || `You are FitCoach AI. ${template.description}`); }}><Edit3 size={14} /> Edit</button>
              </article>
            ))}
          </div>
        </section>

        <footer className="admin-users-footer">
          <div><strong><Activity size={13} /> FitCoach AI</strong><span>Admin Console</span></div>
          <div><span>Live MongoDB data</span><i /><span>AI monitoring</span><i /><span>v1.0</span></div>
        </footer>
      </main>

      {selectedOutput && (
        <div className="admin-ai-modal-overlay" onMouseDown={() => setSelectedOutput(null)}>
          <section className="admin-ai-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="admin-users-eyebrow"><Bot size={13} /> OUTPUT REVIEW</span>
                <h2>{selectedOutput.type} · {selectedOutput.user}</h2>
                <p>Generated {selectedOutput.timestamp}</p>
              </div>
              <button type="button" onClick={() => setSelectedOutput(null)} aria-label="Close"><X size={19} /></button>
            </header>

            <div className="admin-ai-modal-meta">
              <div><span>Model</span><strong>{selectedOutput.model}</strong></div>
              <div><span>Token Usage</span><strong>{selectedOutput.tokens}</strong></div>
              <div><span>Timestamp</span><strong>{selectedOutput.timestamp}</strong></div>
              <div><span>Moderation</span><strong className={`admin-ai-status ${getStatusClass(selectedOutput.status)}`}><i />{selectedOutput.moderation}</strong></div>
            </div>

            <div className="admin-ai-modal-section">
              <div className="admin-ai-modal-label"><Sparkles size={14} /> AI PROMPT SUMMARY</div>
              <p>{selectedOutput.promptSummary}</p>
            </div>

            <div className="admin-ai-modal-section output">
              <div className="admin-ai-modal-label"><FileText size={14} /> GENERATED OUTPUT</div>
              <pre>{selectedOutput.output}</pre>
            </div>

            <footer>
              <button type="button" className="secondary" onClick={() => setSelectedOutput(null)}>Close</button>
              <button type="button" className="flag-button" onClick={() => updateStatus(selectedOutput.id, "Flagged")}><Flag size={15} /> Flag</button>
              <button type="button" className="approve-button" onClick={() => updateStatus(selectedOutput.id, "Approved")}><CheckCircle2 size={15} /> Approve</button>
            </footer>
          </section>
        </div>
      )}

      {editingTemplate && (
        <div className="admin-ai-modal-overlay" onMouseDown={() => setEditingTemplate(null)}>
          <section className="admin-ai-template-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span className="admin-users-eyebrow"><Sparkles size={13} /> PROMPT TEMPLATE</span><h2>Edit {editingTemplate.title}</h2></div>
              <button type="button" onClick={() => setEditingTemplate(null)} aria-label="Close"><X size={19} /></button>
            </header>
            <label>Prompt template<textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} /></label>
            <div className="admin-ai-template-modal-note"><ShieldCheck size={15} /> Changes are stored in MongoDB and apply to the selected template.</div>
            <footer><button type="button" className="secondary" onClick={() => setEditingTemplate(null)}>Cancel</button><button type="button" className="approve-button" onClick={async () => { try { await updatePromptTemplate(editingTemplate.key || editingTemplate.id, { template: promptText });
setPromptTemplates((current)=>current.map((template)=>
(template.id===editingTemplate.id || template.key===editingTemplate.key)
? {...template, template: promptText, updated:'Updated just now'}
: template));
setEditingTemplate(null); } catch (error) { setLoadError(error.response?.data?.message || "Unable to save prompt template."); } }}>Save Template</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}

function AdminNav({ icon, label, badge, ai = false, warning = false, active = false, onClick }) {
  return (
    <button className={`admin-users-nav-item ${active ? "active" : ""}`} onClick={onClick} type="button">
      <span className="admin-users-nav-icon">{icon}</span>
      <span>{label}</span>
      {badge && <small className={`${ai ? "ai" : ""} ${warning ? "warning" : ""}`}>{badge}</small>}
      {active && <i className="admin-users-active-line" />}
    </button>
  );
}

export default AdminAI;
