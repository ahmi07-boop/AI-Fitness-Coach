import { useEffect, useMemo, useState } from "react";
import { getAdminPlans, getAdminUsers, updateAdminPlan, getPlanTemplates, createPlanTemplate, assignPlanTemplate } from "../services/adminApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";


function AdminPlans() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState("ai");
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ user: "", template: "" });
  const [notice, setNotice] = useState("");
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [templateList, setTemplateList] = useState([]);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", goal: "weight-loss", calories: 2100, protein: 160, carbs: 220, fat: 65, hydrationLiters: 2.5 });

  useEffect(() => {
    Promise.all([getAdminPlans(), getAdminUsers(), getPlanTemplates()])
      .then(([plansResponse, usersResponse, templatesResponse]) => {
        const data = plansResponse.data?.data?.plans || [];
        setPlans(data.map((item) => ({
          ...item,
          id: String(item._id),
          user: item.user?.name || item.user?.email || `User ${String(item.user?._id || item.user || "—")}`,
          userId: String(item.user?._id || item.user || ""),
          goal: item.goal,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fat: item.fat || 0,
          status: item.status,
          generatedBy: item.generatedBy || item.model || "OpenAI",
          modified: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—",
          breakfast: item.meals?.find((meal) => meal.type?.toLowerCase() === "breakfast")?.name || item.meals?.[0]?.name || "—",
          lunch: item.meals?.find((meal) => meal.type?.toLowerCase() === "lunch")?.name || "—",
          dinner: item.meals?.find((meal) => meal.type?.toLowerCase() === "dinner")?.name || "—",
        })));
        const remoteTemplates = templatesResponse.data?.data?.templates || [];
        if (remoteTemplates.length) setTemplateList(remoteTemplates.map((item) => ({ id: String(item._id), name: item.name, goal: item.goal === "muscle-building" ? "Muscle Gain" : item.goal === "weight-loss" ? "Weight Loss" : item.goal === "weight-gain" ? "Weight Gain" : "Maintenance", calories: item.calories, protein: item.protein, updated: item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleDateString()}` : "Updated recently", source: item })));
        const usersData = usersResponse.data?.data?.users || [];
        setAdminUsers(usersData.map((user) => ({ id: String(user._id), name: user.name })));
      })
      .catch((error) => setLoadError(error.response?.data?.message || "Unable to load plan management data."));
  }, []);

  const totals = useMemo(() => ({
    ai: plans.filter((plan) => plan.generatedBy !== "Admin").length,
    modified: plans.filter((plan) => plan.status === "Admin Modified").length,
  }), [plans]);

  const openEditor = (plan) => setEditingPlan({ ...plan });

  const saveOverride = async () => {
    try {
      await updateAdminPlan(editingPlan.id, {
        title: editingPlan.title || `${editingPlan.goal} Plan`,
        calories: Number(editingPlan.calories), protein: Number(editingPlan.protein),
        carbs: Number(editingPlan.carbs), fat: Number(editingPlan.fat),
        status: "Admin Modified",
      });
      setPlans((current) => current.map((plan) => plan.id === editingPlan.id ? { ...editingPlan, status: "Admin Modified", generatedBy: "Admin", modified: "Just now" } : plan));
      setEditingPlan(null);
      setNotice("✓ Plan successfully overridden by Admin");
    } catch (error) { setLoadError(error.response?.data?.message || "Unable to update plan."); }
    window.setTimeout(() => setNotice(""), 3500);
  };

  const assignPlan = async () => {
    if (!assignForm.user) return;
    const template = templateList.find((item) => item.id === assignForm.template) || templateList[0];
    const user = adminUsers.find((item) => item.id === assignForm.user);
    if (!user) return;
    try {
      const response = await assignPlanTemplate({ userId: user.id, templateId: template.id });
      const item = response.data?.data?.plan;
      if (item) setPlans((current) => [{ ...item, id: String(item._id), user: item.user?.name || assignForm.user, modified: "Just now" }, ...current]);
      setAssigning(false); setTab("ai"); setAssignForm({ user: "", template: templateList[0]?.id || "" });
      setNotice(`✓ ${template.name} assigned to ${assignForm.user}`);
    } catch (error) { setLoadError(error.response?.data?.message || "Unable to assign plan."); }
    window.setTimeout(() => setNotice(""), 3500);
  };

  return (
    <div className="admin-users-page admin-plans-page">
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
          <AdminNav icon={<ClipboardList size={18} />} label="Plans" active />
          <span className="admin-users-nav-title second">MODERATION</span>
          <AdminNav icon={<Image size={18} />} label="Image Moderation" badge="—" warning onClick={() => navigate("/admin/moderation")} />
          <AdminNav icon={<MessageSquare size={18} />} label="Chat Moderation" badge="—" warning onClick={() => navigate("/admin/moderation?tab=chat")} />
          <AdminNav icon={<FileText size={18} />} label="Logs" onClick={() => navigate("/admin/logs")} />
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
            <div className="admin-users-breadcrumb"><span>Admin Console</span><ChevronRight size={13} /><strong>Plan Management</strong></div>
            <div className="admin-users-title-row">
              <div>
                <div className="admin-users-eyebrow"><ClipboardList size={13} /> PLAN MANAGEMENT</div>
                <h1>Admin Plan Management</h1>
                <p>Override AI-generated plans, manage reusable templates and assign plans manually.</p>
              </div>
              <div className="admin-users-live"><span /> ADMIN CONTROL</div>
            </div>
          </div>
          <div className="admin-users-header-actions"><div className="admin-users-secure"><ShieldCheck size={16} /> Secure</div></div>
        </header>

        <section className="admin-users-ai-banner admin-plans-banner">
          <div className="admin-users-ai-banner-glow" />
          <div className="admin-users-ai-left">
            <div className="admin-users-ai-avatar"><div /><Bot size={22} /></div>
            <div>
              <div className="admin-users-ai-label"><Sparkles size={12} /> PLAN OVERRIDE INTELLIGENCE <span>ACTIVE</span></div>
              <strong>Admins have full control over generated fitness plans</strong>
              <p>Review AI recommendations, make safe manual adjustments and assign approved templates to users.</p>
            </div>
          </div>
          <div className="admin-users-ai-stats">
            <div><span>AI Plans</span><strong>{totals.ai}</strong></div>
            <div><span>Admin Modified</span><strong>{totals.modified}</strong></div>
            <div><span>Templates</span><strong>{templateList.length}</strong></div>
          </div>
        </section>

        <section className="admin-users-content-card admin-plans-card">
          <div className="admin-plans-toolbar">
            <div className="admin-plans-tabs">
              <button type="button" className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}><Bot size={15} /> AI Generated Plans <span>{plans.length}</span></button>
              <button type="button" className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}><ClipboardList size={15} /> Manual Templates <span>{templateList.length}</span></button>
            </div>
            <button type="button" className="admin-plans-assign-button" onClick={() => setAssigning(true)}><UserPlus size={15} /> Assign Plan to User</button>
          </div>

          {tab === "ai" ? (
            <div className="admin-users-table-wrapper admin-plans-table-wrap">
              <table className="admin-users-table admin-plans-table">
                <thead><tr><th>USER</th><th>GOAL</th><th>CALORIES</th><th>PROTEIN</th><th>STATUS</th><th>GENERATED BY</th><th>LAST MODIFIED</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td><div className="admin-users-user-cell"><div className="admin-users-avatar">{plan.user.split(" ").map((part) => part[0]).join("")}</div><div><strong>{plan.user}</strong><span>{plan.goal}</span></div></div></td>
                      <td><span className="admin-plan-goal">{plan.goal}</span></td>
                      <td><strong>{plan.calories.toLocaleString()} <small>kcal</small></strong></td>
                      <td><strong>{plan.protein}g</strong></td>
                      <td><span className={`admin-plan-status ${plan.status.toLowerCase().replaceAll(" ", "-")}`}><i />{plan.status}</span></td>
                      <td><span className="admin-plan-generator"><Bot size={13} /> {plan.generatedBy}</span></td>
                      <td><div className="admin-users-login"><Clock3 size={14} />{plan.modified}</div></td>
                      <td><button className="admin-plan-edit" type="button" onClick={() => openEditor(plan)}><Edit3 size={14} /> Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-template-grid">
              {templateList.map((template) => (
                <article className="admin-plan-template" key={template.id}>
                  <div className="admin-plan-template-icon"><ClipboardList size={19} /></div>
                  <div className="admin-plan-template-head"><div><span>MANUAL TEMPLATE</span><h3>{template.name}</h3></div><span className="admin-plan-template-active">ACTIVE</span></div>
                  <div className="admin-plan-template-goal"><strong>{template.goal}</strong><span>{template.updated}</span></div>
                  <div className="admin-plan-template-macros"><div><span>Calories</span><strong>{template.calories.toLocaleString()}</strong></div><div><span>Protein</span><strong>{template.protein}g</strong></div></div>
                  <button type="button" className="admin-plan-template-assign" onClick={() => { setAssignForm({ user: "", template: template.id }); setAssigning(true); }}><UserPlus size={14} /> Assign Template</button>
                </article>
              ))}
              <article className="admin-plan-template admin-plan-template-add"><div className="admin-plan-add-icon"><Plus size={20} /></div><h3>Create Manual Template</h3><p>Build a reusable plan for recurring admin assignments.</p><button type="button" onClick={() => setCreatingTemplate(true)}><Plus size={14} /> New Template</button></article>
            </div>
          )}
        </section>

        <footer className="admin-users-footer"><div><strong><Activity size={13} /> FitCoach AI</strong><span>Admin Console</span></div><div><span>Live MongoDB data</span><i /><span>Plan management</span><i /><span>v1.0</span></div></footer>
      </main>

      {notice && <div className="admin-plan-toast"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {editingPlan && (
        <div className="admin-plan-modal-overlay" onMouseDown={() => setEditingPlan(null)}>
          <section className="admin-plan-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="admin-users-eyebrow"><Edit3 size={13} /> ADMIN OVERRIDE</span><h2>Edit {editingPlan.user}'s Plan</h2><p>Make controlled changes to the AI-generated nutrition plan.</p></div><button type="button" onClick={() => setEditingPlan(null)} aria-label="Close"><X size={19} /></button></header>
            <div className="admin-plan-modal-meta"><div><span>User</span><strong>{editingPlan.user}</strong></div><div><span>Goal</span><strong>{editingPlan.goal}</strong></div><div><span>Generated By</span><strong>{editingPlan.generatedBy}</strong></div><div><span>Status</span><strong>{editingPlan.status}</strong></div></div>
            <div className="admin-plan-form">
              <label>Breakfast<textarea value={editingPlan.breakfast} onChange={(e) => setEditingPlan({ ...editingPlan, breakfast: e.target.value })} /></label>
              <label>Lunch<textarea value={editingPlan.lunch} onChange={(e) => setEditingPlan({ ...editingPlan, lunch: e.target.value })} /></label>
              <label>Dinner<textarea value={editingPlan.dinner} onChange={(e) => setEditingPlan({ ...editingPlan, dinner: e.target.value })} /></label>
              <div className="admin-plan-number-grid">
                <label>Calories<input type="number" value={editingPlan.calories} onChange={(e) => setEditingPlan({ ...editingPlan, calories: Number(e.target.value) })} /></label>
                <label>Protein (g)<input type="number" value={editingPlan.protein} onChange={(e) => setEditingPlan({ ...editingPlan, protein: Number(e.target.value) })} /></label>
                <label>Carbs (g)<input type="number" value={editingPlan.carbs} onChange={(e) => setEditingPlan({ ...editingPlan, carbs: Number(e.target.value) })} /></label>
                <label>Fat (g)<input type="number" value={editingPlan.fat} onChange={(e) => setEditingPlan({ ...editingPlan, fat: Number(e.target.value) })} /></label>
              </div>
            </div>
            <div className="admin-plan-modal-note"><ShieldCheck size={15} /> Saving marks this plan as <strong>Admin Modified</strong>.</div>
            <footer><button type="button" className="secondary" onClick={() => setEditingPlan(null)}>Cancel</button><button type="button" className="admin-plan-save" onClick={saveOverride}><Save size={15} /> Save Override</button></footer>
          </section>
        </div>
      )}

      {creatingTemplate && (
        <div className="admin-plan-modal-overlay" onMouseDown={() => setCreatingTemplate(false)}>
          <section className="admin-plan-assign-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="admin-users-eyebrow"><Plus size={13} /> NEW TEMPLATE</span><h2>Create Manual Template</h2><p>Save a reusable admin-approved plan template.</p></div><button type="button" onClick={() => setCreatingTemplate(false)} aria-label="Close"><X size={19} /></button></header>
            <div className="admin-plan-assign-body">
              <label>Name<input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="High Protein Fat Loss" /></label>
              <label>Goal<select value={templateForm.goal} onChange={(e) => setTemplateForm({ ...templateForm, goal: e.target.value })}><option value="weight-loss">Weight Loss</option><option value="weight-gain">Weight Gain</option><option value="muscle-building">Muscle Gain</option><option value="maintenance">Maintenance</option></select></label>
              <div className="admin-plan-number-grid"><label>Calories<input type="number" value={templateForm.calories} onChange={(e) => setTemplateForm({ ...templateForm, calories: Number(e.target.value) })} /></label><label>Protein<input type="number" value={templateForm.protein} onChange={(e) => setTemplateForm({ ...templateForm, protein: Number(e.target.value) })} /></label><label>Carbs<input type="number" value={templateForm.carbs} onChange={(e) => setTemplateForm({ ...templateForm, carbs: Number(e.target.value) })} /></label><label>Fat<input type="number" value={templateForm.fat} onChange={(e) => setTemplateForm({ ...templateForm, fat: Number(e.target.value) })} /></label></div>
            </div>
            <footer><button type="button" className="secondary" onClick={() => setCreatingTemplate(false)}>Cancel</button><button type="button" className="admin-plan-save" disabled={!templateForm.name.trim()} onClick={async () => { try { const response = await createPlanTemplate(templateForm); const item = response.data?.data?.template; if (item) setTemplateList((current) => [{ id: String(item._id), name: item.name, goal: item.goal === "muscle-building" ? "Muscle Gain" : item.goal === "weight-loss" ? "Weight Loss" : item.goal === "weight-gain" ? "Weight Gain" : "Maintenance", calories: item.calories, protein: item.protein, updated: "Updated just now", source: item }, ...current]); setCreatingTemplate(false); setNotice("✓ Template created in MongoDB"); } catch (error) { setLoadError(error.response?.data?.message || "Unable to create template."); } }}><Save size={15} /> Save Template</button></footer>
          </section>
        </div>
      )}

      {assigning && (
        <div className="admin-plan-modal-overlay" onMouseDown={() => setAssigning(false)}>
          <section className="admin-plan-assign-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="admin-users-eyebrow"><UserPlus size={13} /> MANUAL ASSIGNMENT</span><h2>Assign Plan to User</h2><p>Assign an admin-approved template stored in MongoDB.</p></div><button type="button" onClick={() => setAssigning(false)} aria-label="Close"><X size={19} /></button></header>
            <div className="admin-plan-assign-body">
              <label>User<select value={assignForm.user} onChange={(e) => setAssignForm({ ...assignForm, user: e.target.value })}><option value="">Select a user</option>{adminUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label>
              <label>Plan Template<select value={assignForm.template} onChange={(e) => setAssignForm({ ...assignForm, template: e.target.value })}>{templateList.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              <div className="admin-plan-assign-preview"><Sparkles size={16} /><div><strong>Admin assignment</strong><span>The selected template will appear in the user's plan list with <b>Admin Modified</b> status.</span></div></div>
            </div>
            <footer><button type="button" className="secondary" onClick={() => setAssigning(false)}>Cancel</button><button type="button" className="admin-plan-save" disabled={!assignForm.user} onClick={assignPlan}><UserPlus size={15} /> Assign Plan</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}

function AdminNav({ icon, label, badge, ai = false, warning = false, active = false, onClick }) {
  return <button className={`admin-users-nav-item ${active ? "active" : ""}`} onClick={onClick} type="button"><span className="admin-users-nav-icon">{icon}</span><span>{label}</span>{badge && <small className={`${ai ? "ai" : ""} ${warning ? "warning" : ""}`}>{badge}</small>}{active && <i className="admin-users-active-line" />}</button>;
}

export default AdminPlans;
