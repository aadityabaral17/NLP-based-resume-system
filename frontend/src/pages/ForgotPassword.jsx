import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import PasswordInput from "../components/PasswordInput";

function ForgotPassword() {
  // "request" asks for the email, "reset" takes the code and the new password
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setNotice(res.data.message);
      setStep("reset");
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Could not send the reset code. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        otp,
        new_password: newPassword,
      });
      navigate("/login", {
        state: { message: "Password reset. Please sign in." },
      });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Could not reset the password. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo flex items-center justify-center">
              <span className="text-white font-serif text-lg">R</span>
            </div>
            <span className="font-serif text-xl text-ink">ResumeMatch</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-line shadow-sm p-8">
          <h1 className="font-serif text-2xl text-ink mb-1">
            {step === "request" ? "Forgot password" : "Set a new password"}
          </h1>
          <p className="text-slate text-sm mb-6">
            {step === "request"
              ? "Enter your email and we'll send you a reset code"
              : `Enter the code sent to ${email}`}
          </p>

          {error && (
            <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          {notice && step === "reset" && (
            <div className="bg-mist text-slate text-sm px-4 py-3 rounded-lg mb-5 border border-line">
              {notice}
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Reset code
                </label>
                <input
                  type="text"
                  name="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 tracking-[0.3em] text-ink placeholder:text-slate/60 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  New password
                </label>
                <PasswordInput
                  name="new_password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Confirm new password
                </label>
                <PasswordInput
                  name="confirm_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setError("");
                  setNotice("");
                }}
                className="w-full text-slate hover:text-ink text-sm py-1 transition"
              >
                Use a different email
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate mt-6">
            Remembered it?{" "}
            <Link to="/login" className="text-indigo hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
