import { getTranslation } from "../helpers/getTranslation";

export const workerReportTranslations = {
  workerPerformanceSummary: {
    en: "Worker Performance Summary",
    ko: "작업자 성과 KPI 리포트"
  },
  periods: {
    daily: {
      en: "Daily",
      ko: "일간"
    },
    weekly: {
      en: "Weekly",
      ko: "주간"
    },
    monthly: {
      en: "Monthly",
      ko: "월간"
    }
  },
  // Main Report Titles
  titles: {
    workerPerformanceReport: {
      en: "WORKER PERFORMANCE SUMMARY REPORT",
      ko: "작업자별 성과보고서"
    },
    workerPerformanceRankings: {
      en: "WORKER PERFORMANCE RANKINGS",
      ko: "작업자 성과 순위"
    },
    individualWorkerDetails: {
      en: "INDIVIDUAL WORKER DETAILS",
      ko: "개별 작업자 상세 정보"
    },
    workerDeviceTypeProficiencyMatrix: {
      en: "WORKER DEVICE TYPE PROFICIENCY MATRIX",
      ko: "작업자 기계 유형 숙련도 매트릭스"
    },
    workerTimeTrackingQualityMetrics: {
      en: "WORKER TIME TRACKING & QUALITY METRICS",
      ko: "작업자 시간 추적 및 품질 지표"
    },
    kpi: {
      en: "KPI",
      ko: "KPI"
    },
    kpiValue: {
      en: "Value",
      ko: "값"
    }
  },

  roles: {
    manager: {
      en: "Manager",
      ko: "관리자"
    },
    ceo: {
      en: "CEO",
      ko: "대표"
    },
    worker: {
      en: "Worker",
      ko: "작업자"
    }
  },

  // Performance Rankings Sheet
  performanceRankings: {
    performanceTierDistribution: {
      en: "Performance Tier Distribution",
      ko: "성과 등급 분포"
    },
    tier: { en: "Tier", ko: "등급" },
    workers: { en: "Workers", ko: "작업자" },
    percentage: { en: "Percentage", ko: "비율" },
    scoreRange: { en: "Score Range", ko: "점수 범위" },
    description: { en: "Description", ko: "설명" },
    outstandingPerformance: {
      en: "Outstanding performance, exceeds expectations",
      ko: "뛰어난 성과, 기대 이상"
    },
    strongPerformance: {
      en: "Strong performance, meets all expectations",
      ko: "강한 성과, 모든 기대 충족"
    },
    satisfactoryPerformance: {
      en: "Satisfactory performance, meets most expectations",
      ko: "만족할 만한 성과, 대부분의 기대 충족"
    },
    needsImprovement: {
      en: "Needs improvement in multiple areas",
      ko: "여러 영역에서 개선 필요"
    },
    requiresImmediateAttention: {
      en: "Requires immediate attention and training",
      ko: "즉각적인 주의 및 교육 필요"
    },
    workerRankingsAllWorkers: {
      en: "Worker Rankings (All Workers)",
      ko: "작업자 순위 (모든 작업자)"
    },
    top5Performers: { en: "🏆 TOP 5 PERFORMERS", ko: "🏆 상위 5명 성과자" }
  },

  // Worker Rankings Table Headers
  rankingsHeaders: {
    rank: { en: "Rank", ko: "순위" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    completed: { en: "Completed", ko: "완료됨" },
    failed: { en: "Failed", ko: "실패함" },
    qualityPercent: { en: "Quality %", ko: "품질 %" },
    efficiencyPercent: { en: "Efficiency %", ko: "효율성 %" },
    performanceScore: { en: "Performance Score", ko: "성과 점수" },
    rating: { en: "Rating", ko: "등급" },
    hours: { en: "Hours", ko: "시간" }
  },

  // Worker Details Sheet
  workerDetails: {
    performanceScore: { en: "Performance Score:", ko: "성과 점수:" },
    rating: { en: "Rating:", ko: "등급:" },
    completedTasks: { en: "Completed Tasks:", ko: "완료된 작업:" },
    failedTasks: { en: "Failed Tasks:", ko: "실패한 작업:" },
    qualityScore: { en: "Quality Score:", ko: "품질 점수:" },
    efficiency: { en: "Efficiency:", ko: "효율성:" },
    totalHours: { en: "Total Hours:", ko: "총 시간:" },
    productiveTime: { en: "Productive Time:", ko: "생산적 시간:" },
    breakTime: { en: "Break Time:", ko: "휴식 시간:" },
    avgTaskTime: { en: "Avg Task Time:", ko: "평균 작업 시간:" },
    taskStatusBreakdown: {
      en: "Task Status Breakdown",
      ko: "작업 상태 분석"
    },
    completed: { en: "Completed:", ko: "완료됨:" },
    failed: { en: "Failed:", ko: "실패함:" },
    ongoing: { en: "Ongoing:", ko: "진행 중:" },
    pending: { en: "Pending:", ko: "대기 중:" },
    topProjects: { en: "Top Projects", ko: "상위 프로젝트" },
    topDeviceTypes: { en: "Top Device Types", ko: "상위 기계 유형" }
  },

  // Device Proficiency Sheet
  deviceProficiency: {
    proficiencyLevels: {
      en: "Proficiency Levels: EXPERT (≥120%), PROFICIENT (100-119%), LEARNING (80-99%), BEGINNER (<80%)",
      ko: "숙련도 수준: 전문가 (≥120%), 숙련 (100-119%), 학습 (80-99%), 초급자 (<80%)"
    },
    noProficiencyData: {
      en: "No proficiency data available for the selected date range.",
      ko: "선택한 날짜 범위에 대한 숙련도 데이터가 없습니다."
    },
    summary: { en: "Summary:", ko: "요약:" },
    expert: { en: "Expert:", ko: "전문가:" },
    proficient: { en: "Proficient:", ko: "숙련:" },
    learning: { en: "Learning:", ko: "학습:" },
    beginner: { en: "Beginner:", ko: "초급자:" },
    overallProficiency: {
      en: "Overall Proficiency:",
      ko: "전체 숙련도:"
    }
  },

  // Device Proficiency Table Headers
  proficiencyHeaders: {
    deviceType: { en: "Device Type", ko: "기계 유형" },
    tasksCompleted: { en: "Tasks Completed", ko: "완료된 작업" },
    avgEstimatedTime: { en: "Avg Estimated Time", ko: "평균 예상 시간" },
    avgActualTime: { en: "Avg Actual Time", ko: "평균 실제 시간" },
    proficiencyPercent: { en: "Proficiency %", ko: "숙련도 %" },
    status: { en: "Status", ko: "상태" }
  },

  // Proficiency Status Levels
  proficiencyStatus: {
    expert: { en: "EXPERT", ko: "전문가" },
    proficient: { en: "PROFICIENT", ko: "숙련" },
    learning: { en: "LEARNING", ko: "학습" },
    beginner: { en: "BEGINNER", ko: "초급자" }
  },

  // Time Tracking Sheet
  timeTracking: {
    summaryStatistics: {
      en: "Summary Statistics",
      ko: "요약 통계"
    },
    totalWorkers: { en: "Total Workers:", ko: "총 작업자:" },
    totalHoursWorked: { en: "Total Hours Worked:", ko: "총 근무 시간:" },
    totalProductiveHours: {
      en: "Total Productive Hours:",
      ko: "총 생산적 시간:"
    },
    totalBreakHours: { en: "Total Break Hours:", ko: "총 휴식 시간:" },
    totalTasksCompleted: {
      en: "Total Tasks Completed:",
      ko: "총 완료된 작업:"
    },
    averageQualityScore: {
      en: "Average Quality Score:",
      ko: "평균 품질 점수:"
    },
    averageEfficiency: {
      en: "Average Efficiency:",
      ko: "평균 효율성:"
    }
  },

  // Time Tracking Table Headers
  timeTrackingHeaders: {
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    totalHours: { en: "Total Hours", ko: "총 시간" },
    productiveHours: { en: "Productive Hours", ko: "생산적 시간" },
    breakHours: { en: "Break Hours", ko: "휴식 시간" },
    tasksCompleted: { en: "Tasks Completed", ko: "완료된 작업" },
    tasksPerHour: { en: "Tasks/Hour", ko: "시간당 작업" },
    qualityScorePercent: { en: "Quality Score %", ko: "품질 점수 %" },
    efficiencyPercent: { en: "Efficiency %", ko: "효율성 %" },
    avgTaskTime: { en: "Avg Task Time", ko: "평균 작업 시간" },
    performanceRating: { en: "Performance Rating", ko: "성과 등급" }
  },

  // Raw Worker Data Sheet
  rawWorkerData: {
    instructions: {
      en: "RAW WORKER DATA EXPORT - This sheet contains all task records assigned to workers in the date range. Use for data analysis, export/import, or integration with other systems.",
      ko: "원본 작업자 데이터 내보내기 - 이 시트에는 날짜 범위의 작업자에게 할당된 모든 작업 기록이 포함되어 있습니다. 데이터 분석, 내보내기/가져오기 또는 다른 시스템과의 통합에 사용하세요."
    }
  },

  // Raw Worker Data Table Headers
  rawDataHeaders: {
    taskId: { en: "Task ID", ko: "작업 ID" },
    workerId: { en: "Worker ID", ko: "작업자 ID" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    taskTitle: { en: "Task Title", ko: "작업 제목" },
    projectId: { en: "Project ID", ko: "프로젝트 ID" },
    recipeId: { en: "Recipe ID", ko: "레시피 ID" },
    deviceTypeId: { en: "Device Type ID", ko: "기계 유형 ID" },
    deviceId: { en: "Device ID", ko: "기계 ID" },
    status: { en: "Status", ko: "상태" },
    priority: { en: "Priority", ko: "우선순위" },
    estimatedDuration: {
      en: "Estimated Duration (s)",
      ko: "예상 소요 시간 (초)"
    },
    actualDuration: { en: "Actual Duration (s)", ko: "실제 소요 시간 (초)" },
    pausedDuration: { en: "Paused Duration (s)", ko: "일시 중지 시간 (초)" },
    startedAt: { en: "Started At", ko: "시작 시간" },
    completedAt: { en: "Completed At", ko: "완료 시간" },
    createdAt: { en: "Created At", ko: "생성 시간" },
    qualityScore: { en: "Quality Score", ko: "품질 점수" },
    efficiency: { en: "Efficiency %", ko: "효율성 %" },
    notes: { en: "Notes", ko: "비고" }
  },

  // Worker KPI Report
  workerKPI: {
    title: {
      en: "WORKER PERFORMANCE KPI REPORT",
      ko: "작업자 성과 KPI 보고서"
    },
    prepared: { en: "Prepared", ko: "작성" },
    reviewed: { en: "Reviewed", ko: "검토" },
    approved: { en: "Approved", ko: "승인" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    workProficiency: { en: "Work Proficiency", ko: "작업 숙련도" },
    proficiencyLevel: { en: "Proficiency Level", ko: "숙련도 수준" },
    proficiencyScore: { en: "Proficiency Score", ko: "숙련도 점수" },
    totalWorkingHours: { en: "Total Working Hours", ko: "총 근무 시간" },
    productionVolume: { en: "Production Volume", ko: "생산량" },
    overtimeHours: { en: "Overtime Hours", ko: "초과 근무 시간" },
    jobProcessingDelays: {
      en: "Job Processing Delays",
      ko: "작업 처리 지연 횟수"
    },
    jobProcessingLatency: {
      en: "Job Processing Latency (minutes)",
      ko: "작업 처리 지연 시간 (분)"
    },
    partDefects: { en: "Part Defects", ko: "부품 불량 수" },
    initial: { en: "Initial", ko: "초급" },
    intermediate: { en: "Intermediate", ko: "중급" },
    advanced: { en: "Advanced", ko: "고급" },
    period: { en: "Period", ko: "기간" },
    from: { en: "From", ko: "시작일" },
    to: { en: "To", ko: "종료일" }
  }
};

export function getWorkerReportTranslation(
  path: string,
  lang: string = "en"
): string {
  return getTranslation(workerReportTranslations, path, lang);
}
