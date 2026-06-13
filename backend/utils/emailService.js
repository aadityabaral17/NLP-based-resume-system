const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMatchNotification = async (
  candidateEmail,
  candidateName,
  jobTitle,
  companyName,
  matchScore,
  missingSkills,
) => {
  const scorePercent = Math.round(matchScore * 100);
  const missingSkillsList =
    missingSkills.length > 0
      ? missingSkills.map((s) => `• ${s}`).join("\n")
      : "None — great match!";

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: candidateEmail,
    subject: `You matched ${scorePercent}% for ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ResumeMatch AI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937;">Hi ${candidateName}!</h2>
          <p style="color: #4b5563;">Great news! You matched <strong>${scorePercent}%</strong> for a new job posting.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Position:</strong> ${jobTitle}</p>
            <p style="margin: 8px 0 0;"><strong>Company:</strong> ${companyName}</p>
            <p style="margin: 8px 0 0;"><strong>Match Score:</strong> 
              <span style="color: ${scorePercent >= 70 ? "#16a34a" : "#ca8a04"}; font-weight: bold;">
                ${scorePercent}%
              </span>
            </p>
          </div>

          ${
            missingSkills.length > 0
              ? `
          <div style="margin: 16px 0;">
            <p style="font-weight: bold; color: #1f2937;">Skills to improve:</p>
            <ul style="color: #4b5563;">
              ${missingSkills.map((s) => `<li>${s}</li>`).join("")}
            </ul>
          </div>
          `
              : ""
          }

          <p style="color: #4b5563;">Login to your dashboard to view all your matches and apply.</p>
          
          <a href="http://localhost:5173/dashboard/jobseeker" 
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            View Dashboard
          </a>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            This email was sent by ResumeMatch AI — Pokhara University Project
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendMatchNotification };
