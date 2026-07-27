const { buildDashboardStats } = require('./dashboardStats');

describe('buildDashboardStats', () => {
  it('returns public landing stats for job seekers', () => {
    const stats = buildDashboardStats({
      globalLiveJobs: 12,
      globalVacancies: 12,
      organisationCount: 4,
    });

    expect(stats).toEqual({
      available_jobs: 12,
      vacancies: 12,
      organizations: 4,
    });
  });

  it('returns organisation-scoped stats for employers', () => {
    const stats = buildDashboardStats({
      orgPostedJobs: 3,
      orgOpenVacancies: 2,
      orgApplications: 9,
      isOrganisation: true,
    });

    expect(stats).toEqual({
      posted_jobs: 3,
      vacancies: 2,
      total_applications: 9,
    });
  });
});
