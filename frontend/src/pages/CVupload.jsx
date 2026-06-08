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

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    validateAndSetFile(selected);
  };

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

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    validateAndSetFile(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

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
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("CV uploaded successfully! Redirecting to dashboard...");
      setFile(null);

      setTimeout(() => {
        navigate("/dashboard/jobseeker");
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Upload failed. Try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-blue-600">ResumeMatch AI</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button
            onClick={() => navigate("/dashboard/jobseeker")}
            className="text-sm text-gray-500 hover:text-blue-600"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">Upload Your CV</h2>
          <p className="text-gray-500 text-sm mt-2">
            Upload your CV in PDF or DOCX format to get matched with jobs
          </p>
        </div>

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-white hover:border-blue-400"
          }`}
          onClick={() => document.getElementById("cv-input").click()}
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
              <p className="font-medium text-green-700">{file.name}</p>
              <p className="text-sm text-green-600 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-xs text-gray-400 mt-2">Click to change file</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">📂</div>
              <p className="font-medium text-gray-600">
                Drag and drop your CV here
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              <p className="text-xs text-gray-400 mt-3">
                Supported: PDF, DOCX · Max size: 5MB
              </p>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mt-4">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg mt-4">
            {success}
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload CV"}
        </button>

        {/* Info box */}
        <div className="bg-blue-50 rounded-xl p-4 mt-6">
          <p className="text-sm font-medium text-blue-700 mb-2">
            What happens after upload?
          </p>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>→ Your CV is parsed and skills are extracted</li>
            <li>→ Your profile is matched against all available jobs</li>
            <li>→ You receive email notifications for jobs above 70% match</li>
            <li>→ Your dashboard shows your match scores and skill gaps</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CVUpload;
