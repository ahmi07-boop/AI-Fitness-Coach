import { useEffect, useMemo, useRef, useState } from "react";
import { getModerationImages, getModerationChats, updateModerationImage, updateModerationChat, getModerationImageFile } from "../services/adminApi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity, ArrowLeft, Bot, Check, CheckCircle2, ChevronRight, ClipboardList,
  FileText, Image as ImageIcon, LayoutDashboard, MessageSquare, MoreHorizontal,
 ShieldCheck, Sparkles, Trash2, Users, X, Flag, Clock3
} from "lucide-react";

function AdminModeration() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "chat" ? "chat" : "images";
  const previewUrlsRef = useRef(new Map());
  const [images, setImages] = useState([]);
  const [chats, setChats] = useState([]);
  const [notice, setNotice] = useState("");
  const [conversation, setConversation] = useState(null);
  const [loadError, setLoadError] = useState("");
  const selectTab = (nextTab) => {
    const normalizedTab = nextTab === "chat" ? "chat" : "images";
    setConversation(null);
    setLoadError("");
    setSearchParams({ tab: normalizedTab }, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const loadQueues = async () => {
      const [imageResult, chatResult] = await Promise.allSettled([
        getModerationImages(),
        getModerationChats(),
      ]);

      if (cancelled) return;

      const errors = [];

      if (imageResult.status === "fulfilled") {
        const imageData = imageResult.value.data?.data?.images || [];
        const normalizedImages = imageData.map((item, index) => ({
          id: String(item._id),
          user: item.userId?.name || item.userId?.email || `User ${String(item.userId?._id || item.userId || "—")}`,
          date: item.createdAt ? new Date(item.createdAt).toLocaleString() : "—",
          status: item.moderationStatus === "Pending" ? "Pending Review" : item.moderationStatus,
          position: ["center", "top", "bottom"][index % 3],
          image: item,
          previewUrl: null,
        }));
        setImages(normalizedImages);

        const previewResults = await Promise.allSettled(normalizedImages.map(async (item) => {
          const position = item.image?.images
            ? Object.keys(item.image.images).find((key) => item.image.images[key])
            : null;
          if (!position || !item.id) return { id: item.id, position, url: null };
          try {
            const response = await getModerationImageFile(item.id, position);
            const url = URL.createObjectURL(response.data);
            previewUrlsRef.current.set(item.id, url);
            return { id: item.id, position, url };
          } catch {
            return { id: item.id, position, url: null };
          }
        }));

        if (!cancelled) {
          setImages((current) => current.map((item) => {
            const result = previewResults.find((entry) => entry.status === "fulfilled" && entry.value.id === item.id);
            return result ? { ...item, position: result.value.position || item.position, previewUrl: result.value.url } : item;
          }));
        }
      } else {
        errors.push(imageResult.reason?.response?.data?.message || "Unable to load image moderation queue.");
      }

      if (chatResult.status === "fulfilled") {
        const chatData = chatResult.value.data?.data?.chats || [];
        setChats(chatData.map((item) => ({
          id: String(item._id),
          user: item.user?.name || item.user?.email || `User ${String(item.user?._id || item.user || "—")}`,
          messages: item.messages?.length || 0,
          date: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—",
          status: item.moderationStatus,
          conversation: (item.messages || []).map((message) => [
            message.role === "assistant" ? "FitCoach AI" : item.user?.name || "User",
            message.content,
          ]),
        })));
      } else {
        errors.push(chatResult.reason?.response?.data?.message || "Unable to load chat moderation queue.");
      }

      setLoadError(errors.join(" "));
    };

    loadQueues();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  const summary = useMemo(() => ({
    total: images.length,
    pending: images.filter((item) => item.status === "Pending Review").length,
    flagged: images.filter((item) => item.status === "Flagged").length,
    approved: images.filter((item) => item.status === "Safe" || item.status === "Approved").length,
  }), [images]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateImage = async (id, status) => {
    try {
      await updateModerationImage(id, { status });
      setImages((current) => current.map((item) => item.id === id ? { ...item, status } : item));
      flash(status === "Flagged" ? "✓ Image flagged for moderation" : "✓ Image approved");
    } catch (error) { setLoadError(error.response?.data?.message || "Unable to update image moderation."); }
  };

  const deleteImage = async (id) => {
    try {
      await updateModerationImage(id, { status: "Deleted" });
      const previewUrl = previewUrlsRef.current.get(id);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrlsRef.current.delete(id); }
      setImages((current) => current.filter((item) => item.id !== id));
      flash("✓ Image deleted from moderation queue");
    } catch (error) { setLoadError(error.response?.data?.message || "Unable to delete image."); }
  };

  const updateChat = async (id, status) => {
    try {
      await updateModerationChat(id, { status: status === "Flagged" ? "Flagged" : status === "Blocked" ? "Blocked" : "Normal" });
      setChats((current) => current.map((item) => item.id === id ? { ...item, status } : item));
      flash(status === "Blocked" ? "✓ User blocked successfully" : `✓ Chat marked ${status}`);
    } catch (error) { setLoadError(error.response?.data?.message || "Unable to update chat moderation."); }
  };

  const chatSummary = useMemo(() => ({
    total: chats.length,
    flagged: chats.filter((item) => item.status === "Flagged").length,
    blocked: chats.filter((item) => item.status === "Blocked").length,
  }), [chats]);

  return (
    <div className="admin-users-page admin-moderation-page">
      <aside className="admin-users-sidebar">
        <div className="admin-users-sidebar-glow" />
        <div className="admin-users-brand"><div className="admin-users-brand-icon"><Activity size={21} /></div><div><strong>FitCoach AI</strong><span>Admin Console</span></div></div>
        <div className="admin-users-system"><div className="admin-users-system-icon"><Bot size={17} /><span /></div><div><strong>AI System</strong><small><i />Operational</small></div></div>
        <nav className="admin-users-nav">
          <span className="admin-users-nav-title">MAIN MENU</span>
          <AdminNav icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={() => navigate("/admin")} />
          <AdminNav icon={<Users size={18} />} label="Users" badge="—" onClick={() => navigate("/admin/users")} />
          <AdminNav icon={<Bot size={18} />} label="AI Outputs" badge="NEW" ai onClick={() => navigate("/admin/ai")} />
          <AdminNav icon={<ClipboardList size={18} />} label="Plans" onClick={() => navigate("/admin/plans")} />
          <span className="admin-users-nav-title second">MODERATION</span>
          <AdminNav icon={<ImageIcon size={18} />} label="Image Moderation" badge="—" warning active={tab === "images"} onClick={() => selectTab("images")} />
          <AdminNav icon={<MessageSquare size={18} />} label="Chat Moderation" badge="—" warning active={tab === "chat"} onClick={() => selectTab("chat")} />
          <AdminNav icon={<FileText size={18} />} label="Logs" onClick={() => navigate("/admin/logs")} />
        </nav>
        <div className="admin-users-sidebar-bottom"><div className="admin-users-admin-profile"><div className="admin-users-admin-avatar">{authUser?.name?.trim()?.charAt(0)?.toUpperCase() || "A"}</div><div><strong>{authUser?.name || "Admin"}</strong><span>{authUser?.role === "admin" ? "Administrator" : "Admin"}</span></div><MoreHorizontal size={17} /></div></div>
      </aside>

      {loadError && <div className="admin-users-ai-banner" style={{ margin: 16 }}><strong>{loadError}</strong></div>}
      <main className="admin-users-main">
        <header className="admin-users-header">
          <div>
            <button className="admin-users-back" onClick={() => navigate("/admin")} type="button"><ArrowLeft size={15} /> Back to Dashboard</button>
            <div className="admin-users-breadcrumb"><span>Admin Console</span><ChevronRight size={13} /><strong>Moderation</strong></div>
            <div className="admin-users-title-row"><div><div className="admin-users-eyebrow"><ShieldCheck size={13} /> CONTENT MODERATION</div><h1>{tab === "images" ? "Image Moderation" : "Chat Moderation"}</h1><p>{tab === "images" ? "Review uploaded body images, detect misuse and remove flagged content." : "Review chatbot conversations, flag harmful messages and block abusive users."}</p></div><div className="admin-users-live"><span /> MODERATION ACTIVE</div></div>
          </div>
          <div className="admin-users-header-actions"><div className="admin-users-secure"><ShieldCheck size={16} /> Secure</div></div>
        </header>

        <section className="admin-users-ai-banner admin-moderation-banner">
          <div className="admin-users-ai-banner-glow" />
          <div className="admin-users-ai-left"><div className="admin-users-ai-avatar"><div /><ShieldCheck size={22} /></div><div><div className="admin-users-ai-label"><Sparkles size={12} /> SAFETY MONITORING <span>ACTIVE</span></div><strong>Review uploads before they reach the fitness workflow</strong><p>Moderators can approve safe content, flag suspicious uploads or delete inappropriate images.</p></div></div>
          <div className="admin-users-ai-stats">{tab === "images" ? <>
            <div><span>Total Images</span><strong>{summary.total}</strong></div><div><span>Pending</span><strong>{summary.pending}</strong></div><div><span>Flagged</span><strong>{summary.flagged}</strong></div><div><span>Approved</span><strong>{summary.approved}</strong></div>
          </> : <>
            <div><span>Total Conversations</span><strong>{chatSummary.total}</strong></div><div><span>Flagged</span><strong>{chatSummary.flagged}</strong></div><div><span>Blocked</span><strong>{chatSummary.blocked}</strong></div>
          </>}</div>
        </section>

        <section className="admin-users-content-card admin-moderation-card">
          <div className="admin-moderation-tabs"><button type="button" className={tab === "images" ? "active" : ""} onClick={() => selectTab("images")}><ImageIcon size={15} /> Images <span>{summary.total}</span></button><button type="button" className={tab === "chat" ? "active" : ""} onClick={() => selectTab("chat")}><MessageSquare size={15} /> Chat <span>{chats.length}</span></button></div>
          {tab === "images" ? (
            <div className="admin-moderation-grid">
              {images.map((item) => <ModerationImageCard key={item.id} item={item} onApprove={() => updateImage(item.id, "Approved")} onFlag={() => updateImage(item.id, "Flagged")} onDelete={() => deleteImage(item.id)} />)}
              {!images.length && <EmptyState icon={<ImageIcon size={22} />} title="No images in the queue" text="Deleted uploads will no longer appear here." />}
            </div>
          ) : (
            <div className="admin-moderation-chat-table"><div className="admin-moderation-chat-head"><span>User</span><span>Messages</span><span>Status</span><span>Last Message</span><span>Actions</span></div>{chats.map((item) => <div className="admin-moderation-chat-row" key={item.id}><strong>{item.user}</strong><p>{item.messages} messages</p><StatusBadge status={item.status} /><span className="admin-moderation-date"><Clock3 size={12} /> {item.date}</span><div className="admin-moderation-actions"><button type="button" onClick={() => setConversation(item)}><MessageSquare size={13} /> View Conversation</button><button type="button" className="flag" onClick={() => updateChat(item.id, "Flagged")} disabled={item.status === "Blocked"}><Flag size={13} /> Flag</button><button type="button" className="block" onClick={() => updateChat(item.id, "Blocked")} disabled={item.status === "Blocked"}><ShieldCheck size={13} /> Block User</button></div></div>)}</div>
          )}
        </section>
      </main>
      {conversation && <ConversationModal conversation={conversation} onClose={() => setConversation(null)} />}
      {notice && <div className="admin-plan-toast admin-moderation-toast"><CheckCircle2 size={16} /> {notice}</div>}
    </div>
  );
}

function ModerationImageCard({ item, onApprove, onFlag, onDelete }) {
  return <article className="admin-moderation-image-card">
    <div className={`admin-moderation-image-preview ${item.position}`}>{item.previewUrl ? <img src={item.previewUrl} alt={`${item.user} uploaded body image`} /> : <div className="admin-moderation-image-placeholder"><ImageIcon size={28} /></div>}<div className="admin-moderation-image-overlay"><span><ShieldCheck size={13} /> BODY IMAGE</span></div><StatusBadge status={item.status} /></div>
    <div className="admin-moderation-image-info"><div><strong>{item.user}</strong><span><Clock3 size={11} /> {item.date}</span></div><div className="admin-moderation-actions"><button type="button" onClick={onApprove}><Check size={13} /> Approve</button><button type="button" className="flag" onClick={onFlag}><Flag size={13} /> Flag</button><button type="button" className="delete" onClick={onDelete} aria-label={`Delete ${item.user} image`}><Trash2 size={13} /> Delete</button></div></div>
  </article>;
}

function ConversationModal({ conversation, onClose }) {
  return <div className="admin-moderation-modal-overlay" role="dialog" aria-modal="true" aria-label={`Conversation with ${conversation.user}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="admin-moderation-conversation-modal">
      <header><div><span>CHAT MODERATION</span><h2>{conversation.user}</h2><p>{conversation.messages} messages · Last message {conversation.date}</p></div><button type="button" onClick={onClose} aria-label="Close conversation"><X size={17} /></button></header>
      <div className="admin-moderation-conversation-status"><StatusBadge status={conversation.status} /><span>Conversation review</span></div>
      <div className="admin-moderation-conversation-body">{conversation.conversation.map(([speaker, message], index) => <div key={index} className={`admin-moderation-message ${speaker === "FitCoach AI" ? "ai" : "user"}`}><span>{speaker}</span><p>{message}</p></div>)}</div>
      <footer><button type="button" onClick={onClose}>Close</button></footer>
    </div>
  </div>;
}

function StatusBadge({ status }) { const cls = status.toLowerCase().replace(/\s+/g, "-"); return <span className={`admin-moderation-status ${cls}`}><i />{status}</span>; }
function EmptyState({ icon, title, text }) { return <div className="admin-moderation-empty">{icon}<strong>{title}</strong><p>{text}</p></div>; }
function AdminNav({ icon, label, badge, ai = false, warning = false, active = false, onClick }) { return <button type="button" className={`admin-users-nav-item ${active ? "active" : ""} ${ai ? "ai" : ""} ${warning ? "warning" : ""}`} onClick={onClick}><span className="admin-users-nav-icon">{icon}</span><span className="admin-users-nav-label">{label}</span>{badge && <b>{badge}</b>}</button>; }

export default AdminModeration;
