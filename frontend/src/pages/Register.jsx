import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import PasswordInput from "../components/PasswordInput";
import jobCategoriesList from "../constants/jobCategories";

function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    user_type: "user",
    company_name: "",
    industry: "",
  });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email: formData.email });
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Failed to send OTP. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/verify-otp", { email: formData.email, otp });
      const dataToSend = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        user_type: formData.user_type,
      };
      if (formData.user_type === "organisation") {
        dataToSend.company_name = formData.company_name;
        dataToSend.industry = formData.industry;
      }
      await api.post("/auth/register", dataToSend);
      setStep(3);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Verification failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setResendLoading(true);
    try {
      await api.post("/auth/send-otp", { email: formData.email });
      alert("New OTP sent to your email!");
    } catch (err) {
      setError("Failed to resend OTP. Try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const inputClass =
    "w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition";
  const labelClass = "block text-sm font-medium text-ink mb-1.5";

  return (
    <div className="min-h-screen bg-mist flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo flex items-center justify-center">
              <span className="text-white font-serif text-lg">R</span>
            </div>
            <span className="font-serif text-xl text-ink">ResumeMatch</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-line shadow-sm p-8">
          <h1 className="font-serif text-2xl text-ink mb-1">
            {step === 1 && "Create your account"}
            {step === 2 && "Verify your email"}
            {step === 3 && "You're all set"}
          </h1>
          <p className="text-slate text-sm mb-5 wrap-break-word">
            {step === 1 && "Join the platform in a minute"}
            {step === 2 && `Enter the 6-digit code sent to ${formData.email}`}
            {step === 3 && "Redirecting to sign in..."}
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step >= s
                      ? "bg-indigo text-white"
                      : "bg-indigo-light text-slate"
                  }`}
                >
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-0.5 flex-1 ${step > s ? "bg-indigo" : "bg-line"}`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className={labelClass}>I am a</label>
                <select
                  name="user_type"
                  value={formData.user_type}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="user">Job Seeker</option>
                  <option value="organisation">Organisation</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Full name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                  className={inputClass}
                />
              </div>

              {formData.user_type === "organisation" && (
                <>
                  <div>
                    <label className={labelClass}>Company name</label>
                    <input
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      placeholder="Your company name"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Industry</label>
                    <input
                      type="text"
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      placeholder="e.g. Information Technology"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@email.com"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <PasswordInput
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Confirm password</label>
                <PasswordInput
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? "Sending code..." : "Send verification code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyAndRegister} className="space-y-4">
              <div className="bg-indigo-light rounded-xl p-4 text-center mb-2">
                <p className="text-sm text-indigo-dark">Code sent to</p>
                <p className="font-semibold text-indigo-dark mt-0.5 break-all">
                  {formData.email}
                </p>
              </div>

              <div>
                <label className={labelClass}>Verification code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full border border-line rounded-lg px-4 py-3 text-center text-xl sm:text-2xl font-bold tracking-[0.3em] sm:tracking-[0.4em] text-ink focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & create account"}
              </button>

              <div className="text-center space-y-2">
                <p className="text-sm text-slate">
                  Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendLoading}
                    className="text-indigo hover:underline font-medium disabled:opacity-50"
                  >
                    {resendLoading ? "Sending..." : "Resend code"}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setError("");
                  }}
                  className="text-sm text-slate/70 hover:text-slate"
                >
                  ← Change email
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-success">✓</span>
              </div>
              <p className="text-success font-semibold">
                Email verified successfully
              </p>
              <p className="text-slate text-sm mt-1">
                Your account has been created.
              </p>
            </div>
          )}

          {step === 1 && (
            <p className="text-center text-sm text-slate mt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-indigo hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Register;
