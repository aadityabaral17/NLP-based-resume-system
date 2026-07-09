import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function CVUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateAndSetFile = (selected) => {
    setError("");
    if (!selected) return;
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(selected.type)) {
      setError("Only PDF and DOCX files are allowed");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB");
      return;
    }
    setFile(selected);
  };

  const handleFileChange = (e) => validateAndSetFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateAndSetFile(e.dataTransfer.files[0]);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("cv_file", file);
      await api.post("/cv/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess("CV uploaded successfully! Redirecting to dashboard...");
      setFile(null);
      setTimeout(() => navigate("/dashboard/jobseeker"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Upload failed. Try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate">{user?.name}</span>
          <button
            onClick={() => navigate("/dashboard/jobseeker")}
            className="text-sm text-slate hover:text-indigo transition"
          >
            Back to dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl text-ink">Upload your CV</h2>
          <p className="text-slate text-sm mt-2">
            We'll extract your skills and match you against open roles
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById("cv-input").click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer ${
            dragging
              ? "border-indigo bg-indigo-light"
              : file
                ? "border-success bg-success-light"
                : "border-line bg-white hover:border-indigo/50"
          }`}
        >
          <input
            id="cv-input"
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div>
              <div className="text-4xl mb-3">📄</div>
              <p className="font-medium text-success">{file.name}</p>
              <p className="text-sm text-success/80 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-xs text-slate mt-2">Click to change file</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">📂</div>
              <p className="font-medium text-ink">Drag and drop your CV here</p>
              <p className="text-sm text-slate mt-1">or click to browse</p>
              <p className="text-xs text-slate/70 mt-3">
                Supported: PDF, DOCX · Max size: 5MB
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mt-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success-light text-success text-sm px-4 py-3 rounded-lg mt-4">
            {success}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full mt-6 bg-indigo hover:bg-indigo-dark text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload CV"}
        </button>

        <div className="bg-indigo-light rounded-xl p-4 mt-6">
          <p className="text-sm font-medium text-indigo-dark mb-2">
            What happens after upload?
          </p>
          <ul className="text-xs text-indigo-dark/80 space-y-1">
            <li>→ Your CV is parsed and skills are extracted</li>
            <li>→ Apply to any open role to get an instant match score</li>
            <li>→ You receive an email when you're eligible (score ≥ 65%)</li>
            <li>→ Your dashboard shows your applications and skill gaps</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CVUpload;
