import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import JourneyProgress from "../components/JourneyProgress";
import {
  User,
  Ruler,
  Weight,
  Activity,
  ArrowLeft,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  X,
  Minus,
  Plus,
} from "lucide-react";

function Onboarding() {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    activity: "",
    dietaryPreference: "",
    allergies: "",
  });

  const [images, setImages] = useState({
    front: null,
    back: null,
    left: null,
    right: null,
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const adjustNumber = (name, delta, min, max) => {
    setFormData((previous) => {
      const current = Number(previous[name]);
      const base = Number.isFinite(current) && current !== 0 ? current : min;
      const next = Math.min(max, Math.max(min, base + delta));
      return { ...previous, [name]: String(next) };
    });
  };

  const handleImageUpload = (position, event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setImages((previous) => ({
      ...previous,
      [position]: {
        file,
        url: imageUrl,
      },
    }));
  };

  const removeImage = (position) => {
    setImages((previous) => ({
      ...previous,
      [position]: null,
    }));
  };

  const continueToImages = () => {
    if (!formData.name || !formData.age || !formData.height || !formData.weight || !formData.activity) {
      alert("Please complete your basic information first.");
      return;
    }

    setStep(2);
  };

  const continueToAnalysis = async () => {
  const allImagesUploaded =
    images.front &&
    images.back &&
    images.left &&
    images.right;

  if (!allImagesUploaded) {
    alert("Please upload all four body images.");
    return;
  }

  try {
    const profile = {
      age: Number(formData.age),
      gender: formData.gender,
      heightCm: Number(formData.height),
      weightKg: Number(formData.weight),
      activityLevel: formData.activity,
      dietaryPreference: formData.dietaryPreference,
      allergies: formData.allergies,
    };

    await updateProfile(profile);

    navigate("/analysis", {
      state: {
        analysisData: {
          images,
        },
      },
    });

  } catch (error) {
    console.error(error);

    alert(
      "Failed to prepare body analysis."
    );
  }
};

  return (
    <div className="onboarding-page">

      <div className="onboarding-container">

        {/* Header */}

        <div className="onboarding-header">

          <div className="onboarding-brand">
            <div className="small-brand-icon">
              <Activity size={20} />
            </div>

            <span>FitCoach AI</span>
          </div>


        </div>


        <JourneyProgress currentStep={step} />

        {/* STEP 1 */}

        {step === 1 && (
          <div className="onboarding-content">

            <div className="section-heading">

              <div className="section-icon">
                <User size={25} />
              </div>

              <div>
                <h1>Tell us about yourself</h1>

                <p>
                  We'll use this information to personalize
                  your fitness journey.
                </p>
              </div>

            </div>

            <div className="onboarding-form">

              <div className="field-group">
                <label>Full Name</label>

                <div className="onboarding-input">
                  <User size={18} />

                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="form-grid">

                <div className="field-group">
                  <label>Age</label>

                  <div className="onboarding-input onboarding-number-input">
                    <User size={18} />
                    <input
                      type="number"
                      name="age"
                      min="13"
                      max="120"
                      value={formData.age}
                      onChange={handleInputChange}
                      placeholder="e.g. 25"
                    />
                    <div className="onboarding-stepper" aria-label="Adjust age">
                      <button type="button" onClick={() => adjustNumber("age", -1, 13, 120)} aria-label="Decrease age"><Minus size={14} /></button>
                      <button type="button" onClick={() => adjustNumber("age", 1, 13, 120)} aria-label="Increase age"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>

                <div className="field-group">
                  <label>Gender</label>

                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="onboarding-select"
                  >
                    <option value="">
                      Select gender
                    </option>

                    <option value="male">
                      Male
                    </option>

                    <option value="female">
                      Female
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

              </div>

              <div className="form-grid">

                <div className="field-group">
                  <label>Height (cm)</label>

                  <div className="onboarding-input onboarding-number-input">
                    <Ruler size={18} />
                    <input
                      type="number"
                      name="height"
                      min="50"
                      max="300"
                      value={formData.height}
                      onChange={handleInputChange}
                      placeholder="e.g. 175"
                    />
                    <div className="onboarding-stepper" aria-label="Adjust height">
                      <button type="button" onClick={() => adjustNumber("height", -1, 50, 300)} aria-label="Decrease height"><Minus size={14} /></button>
                      <button type="button" onClick={() => adjustNumber("height", 1, 50, 300)} aria-label="Increase height"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>

                <div className="field-group">
                  <label>Weight (kg)</label>

                  <div className="onboarding-input onboarding-number-input">
                    <Weight size={18} />
                    <input
                      type="number"
                      name="weight"
                      min="20"
                      max="500"
                      value={formData.weight}
                      onChange={handleInputChange}
                      placeholder="e.g. 70"
                    />
                    <div className="onboarding-stepper" aria-label="Adjust weight">
                      <button type="button" onClick={() => adjustNumber("weight", -1, 20, 500)} aria-label="Decrease weight"><Minus size={14} /></button>
                      <button type="button" onClick={() => adjustNumber("weight", 1, 20, 500)} aria-label="Increase weight"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>

              </div>

              <div className="field-group">
                <label>Activity Level</label>

                <select
                  name="activity"
                  value={formData.activity}
                  onChange={handleInputChange}
                  className="onboarding-select"
                >
                  <option value="">
                    Select activity level
                  </option>

                  <option value="sedentary">
                    Sedentary
                  </option>

                  <option value="light">
                    Lightly Active
                  </option>

                  <option value="moderate">
                    Moderately Active
                  </option>

                  <option value="very">
                    Very Active
                  </option>

                  <option value="athlete">
                    Extremely Active
                  </option>
                </select>
              </div>

              <div className="form-grid">
                <div className="field-group">
                  <label>Dietary Preference</label>
                  <select
                    name="dietaryPreference"
                    value={formData.dietaryPreference}
                    onChange={handleInputChange}
                    className="onboarding-select"
                  >
                    <option value="">No specific preference</option>
                    <option value="balanced">Balanced</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="high-protein">High Protein</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Allergies</label>
                  <div className="onboarding-input">
                    <span style={{ fontSize: 18 }}>⚠</span>
                    <input
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      placeholder="e.g. peanuts, dairy (optional)"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="onboarding-actions">

              <button
                className="secondary-button"
                onClick={() => navigate("/login")}
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <button
                className="primary-button onboarding-next"
                onClick={continueToImages}
              >
                Continue
                <ArrowRight size={18} />
              </button>

            </div>

          </div>
        )}

        {/* STEP 2 */}

        {step === 2 && (
          <div className="onboarding-content">

            <div className="section-heading">

              <div className="section-icon">
                <ImageIcon size={25} />
              </div>

              <div>
                <h1>Body Analysis Images</h1>

                <p>
                  Upload four clear images for your AI
                  body analysis.
                </p>
              </div>

            </div>

            <div className="image-instructions">
              <strong>For best results:</strong>

              <span>
                Stand straight, keep your full body visible,
                and use good lighting.
              </span>
            </div>

            <div className="body-image-grid">

              {[
                ["front", "Front"],
                ["back", "Back"],
                ["left", "Left"],
                ["right", "Right"],
              ].map(([position, label]) => (

                <div
                  className="body-upload-card"
                  key={position}
                >

                  {images[position] ? (
                    <div className="uploaded-image">

                      <img
                        src={images[position].url}
                        alt={`${label} body`}
                      />

                      <button
                        className="remove-image-button"
                        onClick={() =>
                          removeImage(position)
                        }
                      >
                        <X size={16} />
                      </button>

                      <div className="uploaded-label">
                        ✓ {label} image uploaded
                      </div>

                    </div>
                  ) : (
                    <label className="upload-area">

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          handleImageUpload(
                            position,
                            event
                          )
                        }
                        hidden
                      />

                      <div className="upload-icon">
                        <Upload size={25} />
                      </div>

                      <strong>{label}</strong>

                      <span>
                        Click to upload
                      </span>

                    </label>
                  )}

                </div>

              ))}

            </div>

            <div className="onboarding-actions">

              <button
                className="secondary-button"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <button
                className="primary-button onboarding-next"
                onClick={continueToAnalysis}
              >
                Analyze My Body
                <ArrowRight size={18} />
              </button>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}

export default Onboarding;