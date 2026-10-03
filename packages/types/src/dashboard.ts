export type DashboardResponse = {
  date: string; // YYYY-MM-DD in company timezone
  timezone: string;
  kpis: {
    totalEmployees: number;
    workingNow: number;
    checkedInToday: number;
    workMinutesToday: number;
    workMinutesYesterday: number;
    updatesToday: number;
    updatesYesterday: number;
  };
  locations: Array<{
    employeeId: string;
    name: string;
    designation: string | null;
    status: 'WORKING' | 'OFF_DUTY';
    lastPoint: { latitude: number; longitude: number; capturedAt: string } | null;
  }>;
  recentUpdates: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    text: string;
    submittedAt: string;
  }>;
  workHours: Array<{ employeeId: string; name: string; minutes: number }>;
};
