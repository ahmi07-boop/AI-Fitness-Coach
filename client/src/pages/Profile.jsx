import useScrollShadows from "../hooks/useScrollShadows";
import { useRef,  useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ImagePlus, LoaderCircle, MessageCircle, Save, User, Target } from "lucide-react";

const goals = {
  "weight-loss": "Weight Loss",
  "weight-gain": "Weight Gain",
  "muscle-building": "Muscle Building",
  maintenance: "Maintenance",
};

function Profile() {
  const sidebarRef = useRef(null);
  useScrollShadows(sidebarRef);

  const navigate = useNavigate();
  const { user: authUser, updateProfile, uploadProfilePicture } = useAuth();
  const [user, setUser] = useState(null);
  const [goal, setGoal] = useState("maintenance");
  const [saved, setSaved] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      const savedGoal = authUser.profile?.goal;
      if (savedGoal && goals[savedGoal]) setGoal(savedGoal);
    }
  }, [authUser]);

  const updateUser = (field, value) => {
    setUser((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      const nextUser = await updateProfile({ ...(user.profile || {}), goal }, { name: user.name, email: user.email });
      setUser(nextUser);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      setSaved(false);
    }
  };

  useEffect(() => {
    let objectUrl = "";
    if (!user?.profile?.avatarPath) {
      setAvatarUrl("");
      return undefined;
    }

    let cancelled = false;
    api.get("/api/auth/me/avatar", { responseType: "blob" })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setAvatarUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl("");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.profile?.avatarPath]);

  const handlePictureChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPictureError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureError("Profile pictures must be 5 MB or smaller.");
      return;
    }
    try {
      setPictureError("");
      setUploadingPicture(true);
      await uploadProfilePicture(file);
    } catch (error) {
      setPictureError(error?.response?.data?.message || error?.message || "Could not upload your profile picture.");
    } finally {
      setUploadingPicture(false);
    }
  };

  const firstName = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="profile-page">
      <aside ref={sidebarRef} className="app-sidebar profile-sidebar">
        <div className="profile-brand">
          <div className="profile-logo"><Activity size={20} /></div>
          <div><strong>FitCoach AI</strong><span>Smart Fitness</span></div>
        </div>
        <nav className="profile-nav">
          <button type="button" onClick={() => navigate("/dashboard")}><Activity size={17} /> Dashboard</button>
          <button type="button" onClick={() => navigate("/plan")}><CalendarDays size={17} /> My Plan</button>
          <button type="button" onClick={() => navigate("/progress")}><BarChart3 size={17} /> Progress</button>
          <button type="button" onClick={() => navigate("/coach")}><MessageCircle size={17} /> AI Coach</button>
          <button type="button" className="active"><User size={17} /> Profile</button>
        </nav>
        <button className="profile-back" type="button" onClick={() => navigate("/dashboard")}><ArrowLeft size={16} /> Back to Dashboard</button>
      </aside>

      <main className="profile-main">
        <header className="profile-header">
          <div>
            <span className="profile-eyebrow">ACCOUNT</span>
            <h1>Your Profile</h1>
            <p>Manage your FitCoach AI account and fitness preferences.</p>
          </div>
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : firstName}</div>
            <label className="profile-picture-button">
              {uploadingPicture ? <LoaderCircle size={14} className="profile-spinner" /> : <ImagePlus size={14} />}
              {uploadingPicture ? "Uploading..." : "Add picture"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePictureChange} disabled={uploadingPicture} />
            </label>
          </div>
        </header>

        <section className="profile-grid">
          <article className="profile-card profile-card-main">
            <div className="profile-card-title"><User size={18} /><div><h2>Personal Information</h2><p>Keep your profile details up to date.</p></div></div>
            <label>Name<input value={user?.name || ""} onChange={(e) => updateUser("name", e.target.value)} /></label>
            <label>Email<input type="email" value={user?.email || ""} onChange={(e) => updateUser("email", e.target.value)} /></label>
            <label>Fitness Goal<select value={goal} onChange={(e) => { setGoal(e.target.value); setSaved(false); }}><option value="weight-loss">Weight Loss</option><option value="weight-gain">Weight Gain</option><option value="muscle-building">Muscle Building</option><option value="maintenance">Maintenance</option></select></label>
            <button className="profile-save" type="button" onClick={saveProfile}><Save size={16} /> Save Changes</button>
            {saved && <div className="profile-success"><CheckCircle2 size={15} /> Profile saved successfully</div>}
            {pictureError && <div className="profile-picture-error">{pictureError}</div>}
          </article>

          <aside className="profile-card profile-summary">
            <div className="profile-summary-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : firstName}</div>
            <h2>{user?.name || "Your Profile"}</h2>
            <p>{user?.email || "Add your email"}</p>
            <div className="profile-goal"><Target size={16} /><span>Current Goal</span><strong>{goals[goal]}</strong></div>
            <button type="button" onClick={() => navigate("/progress")}>View Progress <BarChart3 size={15} /></button>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default Profile;
