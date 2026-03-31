import { getTranslation } from "../helpers/getTranslation";

export const summaryReportTranslations = {
  summaryReport: {
    title: {
      en: "Production/Manufacturing Comprehensive Status Summary Report",
      ko: "생산·제조 종합 현황 요약 보고서"
    },
    referenceDateTime: {
      en: "Reference Date/Time",
      ko: "기준일시"
    },
    reportGenerationDate: {
      en: "Report Generation Date",
      ko: "리포트생성일자"
    },
    prepared: {
      en: "Prepared",
      ko: "작성"
    },
    reviewed: {
      en: "Reviewed",
      ko: "검토"
    },
    approved: {
      en: "Approved",
      ko: "승인"
    },
    dailyProductionStatus: {
      en: "Daily Production Status",
      ko: "일간 생산성 현황"
    },
    weeklyProductionStatus: {
      en: "Weekly Production Status",
      ko: "주간 생산성 현황"
    },
    monthlyProductionStatus: {
      en: "Monthly Production Status",
      ko: "월간 생산성 현황"
    },
    progressRate: {
      en: "Progress Rate",
      ko: "진행률"
    },
    totalWorkCount: {
      en: "Total Work Count",
      ko: "전체작업수"
    },
    completedWorkCount: {
      en: "Completed Work Count",
      ko: "완료 작업 수"
    },
    deliveryDateBasedStatus: {
      en: "Delivery Date Based Status",
      ko: "납기일기준현황"
    },
    delayedDeliveries: {
      en: "Delayed Deliveries",
      ko: "납기 지연 수"
    },
    imminentDeliveries: {
      en: "Imminent Deliveries",
      ko: "납기 임박 수"
    },
    onTimeDeliveries: {
      en: "On-time Deliveries",
      ko: "납기 준수"
    },
    equipmentUtilizationRate: {
      en: "Equipment Utilization Rate",
      ko: "장비 가동률"
    },
    operatingEquipmentCount: {
      en: "Operating Equipment Count",
      ko: "가동장비수"
    },
    totalEquipmentCount: {
      en: "Total Equipment Count",
      ko: "총장비수"
    },
    topErrorFrequencies: {
      en: "Top 3 Error Occurrence Frequencies by Type",
      ko: "유형별 에러 발생 빈도 상위 3"
    },
    workerStatus: {
      en: "Worker Status",
      ko: "작업자 현황"
    },
    overallStatus: {
      en: "Overall Status",
      ko: "Overall Status"
    },
    workersInProgress: {
      en: "Workers in Progress",
      ko: "작업 진행자 수"
    },
    totalWorkers: {
      en: "Total Workers",
      ko: "총 작업자 수"
    },
    top10ProductWorkload: {
      en: "Top 10 Product Workload",
      ko: "제품별 작업량 상위 10"
    },
    top10PartWorkload: {
      en: "Top 10 Part Workload",
      ko: "부품별 작업량 상위 10"
    },
    top10CustomerOrderCount: {
      en: "Top 10 Customer Order Count",
      ko: "고객사 주문건 수 상위 10"
    },
    top10EquipmentUsage: {
      en: "Top 10 Equipment Usage",
      ko: "장비별 사용량 상위 10"
    },
    rank: {
      en: "Rank",
      ko: "순위"
    },
    productName: {
      en: "Product Name",
      ko: "제품명"
    },
    workload: {
      en: "Workload",
      ko: "작업량"
    },
    partName: {
      en: "Part Name",
      ko: "부품명"
    },
    customerName: {
      en: "Customer Name",
      ko: "고객사명"
    },
    orderCount: {
      en: "Order Count",
      ko: "주문건 수"
    },
    equipmentName: {
      en: "Equipment Name",
      ko: "장비명"
    },
    usageTime: {
      en: "Usage Time",
      ko: "사용량"
    },
    month: {
      en: "Month",
      ko: "월"
    },
    toolChange: {
      en: "Tool Change",
      ko: "툴체인지"
    },
    equipmentDefect: {
      en: "Equipment Defect",
      ko: "장비결함"
    },
    processingDefect: {
      en: "Processing Defect",
      ko: "가공결함"
    },
    materialDefect: {
      en: "Material Defect",
      ko: "재료결함"
    },
    other: {
      en: "Other",
      ko: "기타"
    }
  }
};
export function getSummaryReportTranslation(
  path: string,
  lang: string = "en"
): string {
  return getTranslation(summaryReportTranslations, path, lang);
}
