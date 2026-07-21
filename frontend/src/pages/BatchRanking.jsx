import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import ScoreDial from "../components/ScoreDial";

function BatchRanking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const validateAndAddFiles = (fileList) => {
    setError("");
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const validFiles = [];
    for (const file of Array.from(fileList)) {
      if (!allowedTypes.includes(file.type)) {
        setError(`${file.name} is not a PDF or DOCX file`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} exceeds 5MB`);
        continue;
      }
      validFiles.push(file);
    }
    setFiles((prev) => [...prev, ...validFiles].slice(0, 20));
  };

  const handleFileChange = (e) => validateAndAddFiles(e.target.files);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateAndAddFiles(e.dataTransfer.files);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRank = async () => {
    if (files.length === 0) {
      setError("Please add at least one CV");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }

    setProcessing(true);
    setError("");
    setResults(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("cv_files", file));
      formData.append("job_description", jobDescription);

      const res = await api.post("/batch/rank", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data.results || []);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Failed to process batch ranking",
      );
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setJobDescription("");
    setResults(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate">{user?.name}</span>
          <button
            onClick={() => navigate("/dashboard/organisation")}
            className="text-sm text-slate hover:text-indigo transition"
          >
            Back to dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-2">
          <h2 className="font-serif text-2xl text-ink">Batch CV ranking</h2>
          <p className="text-slate text-sm mt-1">
            Upload CVs you already have and paste a job description to rank them
            instantly.
          </p>
        </div>

        <div className="bg-indigo-light rounded-xl p-3 mb-6">
          <p className="text-xs text-indigo-dark">
            This is a standalone ranking tool — it does not create a job
            posting, does not notify candidates, and is separate from Apply for
            Job.
          </p>
        </div>

        {error && (
          <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!results && (
          <div className="bg-white rounded-2xl border border-line p-6 sm:p-8">
            <label className="block text-sm font-medium text-ink mb-1.5">
              Job description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste or write the job description here..."
              rows={5}
              className="w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition resize-none mb-6"
            />

            <label className="block text-sm font-medium text-ink mb-1.5">
              Candidate CVs
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById("batch-cv-input").click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                dragging
                  ? "border-indigo bg-indigo-light"
                  : "border-line hover:border-indigo/50"
              }`}
            >
              <input
                id="batch-cv-input"
                type="file"
                accept=".pdf,.docx"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-3xl mb-2">📁</div>
              <p className="text-sm text-ink font-medium">
                Drag and drop CVs here, or click to browse
              </p>
              <p className="text-xs text-slate mt-1">
                Up to 20 files · PDF or DOCX · Max 5MB each
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate/70">
                  {files.length} file(s) selected
                </p>
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-mist rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-ink truncate">
                      {file.name}
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-xs text-danger hover:underline ml-2 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleRank}
              disabled={processing}
              className="w-full mt-6 bg-indigo hover:bg-indigo-dark text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
            >
              {processing
                ? "Ranking candidates..."
                : `Rank ${files.length || ""} candidate${files.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}

        {results && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg text-ink">Ranked results</h3>
              <button
                onClick={reset}
                className="text-sm text-indigo hover:underline"
              >
                Start new ranking
              </button>
            </div>

            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-4 border border-line"
                >
                  {result.error ? (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-ink">
                          {result.filename}
                        </p>
                        <p className="text-xs text-danger mt-1">
                          {result.error}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate/60">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-ink">
                            {result.filename}
                          </p>
                          {result.predicted_category && (
                            <span className="text-xs bg-indigo-light text-indigo px-2 py-0.5 rounded-full">
                              {result.predicted_category}
                            </span>
                          )}
                        </div>
                        {result.skills?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {result.skills.slice(0, 6).map((skill, i) => (
                              <span
                                key={i}
                                className="text-xs bg-indigo-light text-indigo px-2 py-1 rounded-full"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        {result.missing_skills?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {result.missing_skills
                              .slice(0, 3)
                              .map((skill, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-danger-light text-danger px-2 py-1 rounded-full"
                                >
                                  Missing: {skill}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <ScoreDial score={result.final_score * 100} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchRanking;
