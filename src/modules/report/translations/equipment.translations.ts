import { getTranslation } from "../helpers/getTranslation";

export const equipmentReportTranslations = {
  // Equipment Report
  equipmentReport: {
    title: {
      en: "Equipment Report",
      ko: "설비 보고서"
    },
    period: {
      en: "Period",
      ko: "기간"
    },
    to: {
      en: "to",
      ko: "~"
    },
    equipmentNo: {
      en: "Equipment No",
      ko: "장비번호"
    },
    equipmentName: {
      en: "Equipment Name",
      ko: "장비명"
    },
    operationTime: {
      en: "Operation Time",
      ko: "가동 시간"
    },
    downtime: {
      en: "Downtime",
      ko: "비가동 시간"
    },
    operationRate: {
      en: "Operation Rate",
      ko: "가동률"
    },
    errorCount: {
      en: "Error Count",
      ko: "에러발생횟수"
    },
    productionQuantity: {
      en: "Production Quantity",
      ko: "생산량"
    }
  },
  // Approval workflow
  approval: {
    created: {
      en: "Created",
      ko: "작성"
    },
    reviewed: {
      en: "Reviewed",
      ko: "검토"
    },
    approved: {
      en: "Approved",
      ko: "승인"
    }
  },
  // Legacy Equipment KPI Report (keeping for backward compatibility)
  equipmentKPI: {
    title: {
      en: "EQUIPMENT PERFORMANCE KPI REPORT",
      ko: "장비 성능 KPI 보고서"
    },
    period: {
      en: "Period",
      ko: "기간"
    },
    to: {
      en: "to",
      ko: "~"
    },
    deviceName: {
      en: "Device Name",
      ko: "장비명"
    },
    deviceType: {
      en: "Device Type",
      ko: "장비 유형"
    },
    utilization: {
      en: "Utilization (%)",
      ko: "가동률 (%)"
    },
    actualUptimeHours: {
      en: "Actual Uptime Hours",
      ko: "실제 가동 시간"
    },
    operationalHours: {
      en: "Operational Hours",
      ko: "운영 시간"
    },
    errorCount: {
      en: "Error Count",
      ko: "오류 횟수"
    },
    productionCount: {
      en: "Production Count",
      ko: "생산량"
    }
  },
  // Reuse from workerReportService
  titles: {
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
  }
};

export const getEquipmentReportTranslation = (
  path: string,
  lang: string = "en"
): string => {
  return getTranslation(equipmentReportTranslations, path, lang);
};
