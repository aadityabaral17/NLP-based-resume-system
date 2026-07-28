function buildDashboardStats({
  globalLiveJobs = 0,
  globalVacancies = 0,
  organisationCount = 0,
  orgPostedJobs = 0,
  orgOpenVacancies = 0,
  orgApplications = 0,
  isOrganisation = false,
}) {
  if (isOrganisation) {
    return {
      posted_jobs: Number(orgPostedJobs || 0),
      vacancies: Number(orgOpenVacancies || 0),
      total_applications: Number(orgApplications || 0),
    };
  }

  return {
    available_jobs: Number(globalLiveJobs || 0),
    vacancies: Number(globalVacancies || 0),
    organizations: Number(organisationCount || 0),
  };
}

module.exports = {
  buildDashboardStats,
};
