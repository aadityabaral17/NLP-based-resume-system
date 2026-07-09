function StatusBadge({ status }) {
  const config = {
    shortlisted: {
      text: "★ Shortlisted",
      bg: "bg-success-light",
      color: "text-success",
    },
    rejected: {
      text: "✕ Rejected",
      bg: "bg-danger-light",
      color: "text-danger",
    },
    applied: {
      text: "Under review",
      bg: "bg-indigo-light",
      color: "text-indigo",
    },
  };
  const c = config[status] || config.applied;

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.bg} ${c.color}`}
    >
      {c.text}
    </span>
  );
}

export default StatusBadge;
