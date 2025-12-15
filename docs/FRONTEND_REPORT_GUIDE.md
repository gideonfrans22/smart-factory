# Frontend Report Integration Guide

**Last Updated:** December 15, 2025  
**For:** Frontend Developers  
**Backend Version:** Smart Factory API v1.0

---

## 📋 Overview

This guide explains how to integrate the report generation system into your frontend application. The backend supports **daily, weekly, and monthly reports** through date range selection.

---

## 🎯 Available Reports

### 1. **TASK_COMPLETION Report** (작업 완료 리포트)
Contains overall work status with 5 sheets:
- ✅ 전체 작업 현황 (Overall Work Status)
- Task details, recipe execution, device utilization
- Raw task data export

### 2. **WORKER_PERFORMANCE Report** (작업자 성과 리포트)
Contains worker-specific metrics with 5 sheets:
- ✅ 작업자별 현황 (Worker Status)
- ✅ 작업자별 작업량 (Worker Workload)
- ✅ 작업자 생산성 (Worker Productivity)
- Device proficiency, time tracking
- Raw worker data export

### 3. **PRODUCTION_RATE Report** (생산율 리포트)
⚠️ Not yet implemented (coming soon)

---

## 🔌 API Endpoint

### Generate Report

```
POST /api/reports/generate
Content-Type: application/json
```

**Request Body:**
```typescript
interface ReportGenerateRequest {
  title: string;                    // Report title
  type: "TASK_COMPLETION" | "WORKER_PERFORMANCE" | "PRODUCTION_RATE";
  format: "PDF" | "EXCEL" | "CSV" | "JSON";  // Currently only EXCEL is supported
  parameters: {
    startDate: string;              // Format: YYYY-MM-DD
    endDate: string;                // Format: YYYY-MM-DD
  };
  lang?: "en" | "ko";              // Optional, defaults to "en"
}
```

**Response:**
```typescript
interface ReportGenerateResponse {
  success: boolean;
  message: string;
  data: {
    reportId: string;               // MongoDB ObjectId
    status: "COMPLETED" | "FAILED";
    downloadUrl: string;            // e.g., "/api/reports/download/abc123"
    fileName: string;               // e.g., "TaskReport_2025-12-01_2025-12-31.xlsx"
    metadata?: {
      sheetsGenerated: string[];
      totalRecords: number;
      generationTime: number;       // milliseconds
    };
  };
}
```

---

## 📅 How to Generate Daily/Weekly/Monthly Reports

The backend automatically aggregates data based on the date range you provide.

### Daily Report (일간 리포트)

**Concept:** Set `startDate` and `endDate` to the **same day**

```typescript
// Example: Generate report for December 15, 2025
const generateDailyReport = async (selectedDate: Date) => {
  const dateStr = format(selectedDate, 'yyyy-MM-dd'); // "2025-12-15"
  
  const response = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Daily Report - ${dateStr}`,
      type: 'TASK_COMPLETION',
      format: 'EXCEL',
      parameters: {
        startDate: dateStr,   // Same date
        endDate: dateStr      // Same date
      },
      lang: 'ko'
    })
  });
  
  const result = await response.json();
  return result.data.downloadUrl;
};
```

### Weekly Report (주간 리포트)

**Concept:** Set `startDate` to Monday, `endDate` to Sunday

```typescript
// Example: Generate report for the week containing December 15, 2025
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';

const generateWeeklyReport = async (selectedDate: Date) => {
  // Get Monday of the week (week starts on Monday)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  // Get Sunday of the week
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  
  const startStr = format(weekStart, 'yyyy-MM-dd'); // "2025-12-08"
  const endStr = format(weekEnd, 'yyyy-MM-dd');     // "2025-12-14"
  
  const response = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Weekly Report - ${startStr} to ${endStr}`,
      type: 'WORKER_PERFORMANCE',
      format: 'EXCEL',
      parameters: {
        startDate: startStr,  // Monday
        endDate: endStr       // Sunday
      },
      lang: 'ko'
    })
  });
  
  const result = await response.json();
  return result.data.downloadUrl;
};
```

### Monthly Report (월간 리포트)

**Concept:** Set `startDate` to first day of month, `endDate` to last day of month

```typescript
// Example: Generate report for December 2025
import { startOfMonth, endOfMonth, format } from 'date-fns';

const generateMonthlyReport = async (selectedDate: Date) => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  
  const startStr = format(monthStart, 'yyyy-MM-dd'); // "2025-12-01"
  const endStr = format(monthEnd, 'yyyy-MM-dd');     // "2025-12-31"
  const monthName = format(selectedDate, 'MMMM yyyy'); // "December 2025"
  
  const response = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Monthly Report - ${monthName}`,
      type: 'WORKER_PERFORMANCE',
      format: 'EXCEL',
      parameters: {
        startDate: startStr,  // First day of month
        endDate: endStr       // Last day of month
      },
      lang: 'ko'
    })
  });
  
  const result = await response.json();
  return result.data.downloadUrl;
};
```

---

## 🎨 UI Component Example (React + TypeScript)

### Complete Report Generator Component

```typescript
import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type ReportType = 'TASK_COMPLETION' | 'WORKER_PERFORMANCE';

const ReportGenerator: React.FC = () => {
  const [periodType, setPeriodType] = useState<PeriodType>('DAILY');
  const [reportType, setReportType] = useState<ReportType>('TASK_COMPLETION');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const calculateDateRange = (period: PeriodType, date: Date) => {
    switch (period) {
      case 'DAILY':
        const dateStr = format(date, 'yyyy-MM-dd');
        return { startDate: dateStr, endDate: dateStr };
      
      case 'WEEKLY':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return {
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd')
        };
      
      case 'MONTHLY':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return {
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd')
        };
    }
  };

  const generateTitle = (period: PeriodType, date: Date) => {
    switch (period) {
      case 'DAILY':
        return `일간 리포트 - ${format(date, 'yyyy-MM-dd')}`;
      case 'WEEKLY':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return `주간 리포트 - ${format(weekStart, 'MM/dd')} ~ ${format(weekEnd, 'MM/dd')}`;
      case 'MONTHLY':
        return `월간 리포트 - ${format(date, 'yyyy년 MM월')}`;
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setDownloadUrl(null);

    try {
      const dateRange = calculateDateRange(periodType, selectedDate);
      const title = generateTitle(periodType, selectedDate);

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: reportType,
          format: 'EXCEL',
          parameters: dateRange,
          lang: 'ko'
        })
      });

      const result = await response.json();

      if (result.success) {
        setDownloadUrl(result.data.downloadUrl);
        alert('리포트가 성공적으로 생성되었습니다!');
      } else {
        alert(`리포트 생성 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="report-generator">
      <h2>리포트 생성</h2>

      {/* Report Type Selection */}
      <div className="form-group">
        <label>리포트 종류</label>
        <select 
          value={reportType} 
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          <option value="TASK_COMPLETION">작업 완료 리포트</option>
          <option value="WORKER_PERFORMANCE">작업자 성과 리포트</option>
        </select>
      </div>

      {/* Period Type Selection */}
      <div className="form-group">
        <label>기간 선택</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="DAILY"
              checked={periodType === 'DAILY'}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            />
            일간 (Daily)
          </label>
          <label>
            <input
              type="radio"
              value="WEEKLY"
              checked={periodType === 'WEEKLY'}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            />
            주간 (Weekly)
          </label>
          <label>
            <input
              type="radio"
              value="MONTHLY"
              checked={periodType === 'MONTHLY'}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            />
            월간 (Monthly)
          </label>
        </div>
      </div>

      {/* Date Picker */}
      <div className="form-group">
        <label>날짜 선택</label>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => date && setSelectedDate(date)}
          dateFormat="yyyy-MM-dd"
          className="date-picker"
        />
        {periodType === 'WEEKLY' && (
          <p className="help-text">
            선택한 날짜가 포함된 주(월~일)의 리포트가 생성됩니다.
          </p>
        )}
        {periodType === 'MONTHLY' && (
          <p className="help-text">
            선택한 날짜가 포함된 월의 리포트가 생성됩니다.
          </p>
        )}
      </div>

      {/* Generate Button */}
      <button 
        onClick={handleGenerateReport}
        disabled={isGenerating}
        className="btn-generate"
      >
        {isGenerating ? '생성 중...' : '리포트 생성'}
      </button>

      {/* Download Link */}
      {downloadUrl && (
        <div className="download-section">
          <a 
            href={downloadUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-download"
          >
            📥 리포트 다운로드
          </a>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
```

---

## 📥 Download Report

### Download Endpoint

```
GET /api/reports/download/:reportId
```

**Usage:**
```typescript
const downloadReport = (reportId: string) => {
  // Option 1: Direct link (browser will handle download)
  window.open(`/api/reports/download/${reportId}`, '_blank');
  
  // Option 2: Fetch and download programmatically
  fetch(`/api/reports/download/${reportId}`)
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });
};
```

---

## 📊 Report Data Aggregation

### How Data is Aggregated

The backend automatically aggregates data based on the date range:

#### Daily Report (1 day range)
- Shows detailed data for that specific day
- Individual task records
- Hour-by-hour breakdown (if available)

#### Weekly Report (7 day range)
- Aggregates totals across 7 days
- Shows daily trend in charts (7 data points)
- Weekly totals and averages:
  - Total tasks completed in week
  - Total hours worked in week
  - Average efficiency for week
  - Daily breakdown chart

#### Monthly Report (28-31 day range)
- Aggregates totals across entire month
- Shows daily trend in charts (30 data points)
- Monthly totals and averages:
  - Total tasks completed in month
  - Total hours worked in month
  - Average efficiency for month
  - Daily breakdown chart

---

## 🔍 Query Existing Reports

### List All Reports

```
GET /api/reports?page=1&limit=10&type=TASK_COMPLETION&status=COMPLETED
```

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 10
- `type` (optional): Filter by report type
- `status` (optional): Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)

**Response:**
```typescript
interface ReportListResponse {
  success: boolean;
  message: string;
  data: {
    items: Array<{
      _id: string;
      title: string;
      type: string;
      format: string;
      status: string;
      generatedAt: string;
      expiresAt: string;
      downloadCount: number;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}
```

### Get Report Details

```
GET /api/reports/:reportId
```

**Response:**
```typescript
interface ReportDetailResponse {
  success: boolean;
  message: string;
  data: {
    _id: string;
    title: string;
    type: string;
    format: string;
    parameters: {
      startDate: string;
      endDate: string;
    };
    filePath: string;
    fileSize: number;
    status: string;
    generatedBy: {
      _id: string;
      username: string;
      email: string;
    };
    generatedAt: string;
    expiresAt: string;
    downloadCount: number;
    createdAt: string;
  };
}
```

---

## ⚠️ Error Handling

### Common Errors

```typescript
// Handle errors properly
const generateReport = async () => {
  try {
    const response = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!result.success) {
      switch (result.error) {
        case 'VALIDATION_ERROR':
          alert('입력값을 확인해주세요.');
          break;
        case 'GENERATION_FAILED':
          alert('리포트 생성에 실패했습니다. 다시 시도해주세요.');
          break;
        case 'INTERNAL_SERVER_ERROR':
          alert('서버 오류가 발생했습니다.');
          break;
        default:
          alert(result.message);
      }
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('네트워크 오류가 발생했습니다.');
  }
};
```

---

## 📋 Report Content Summary

### TASK_COMPLETION Report Contains:
- ✅ **전체 작업 현황** (Sheet 1: Executive Summary)
  - Total tasks, completion rate, on-time rate
  - Task status distribution (Completed/Ongoing/Failed/Pending)
  - By-project summary
  - Device type utilization
- Task details (18 columns with all task fields)
- Recipe execution tracking
- Device utilization metrics
- Raw task data export

### WORKER_PERFORMANCE Report Contains:
- ✅ **작업자별 현황** (Sheet 2: Individual Worker Details)
  - Per-worker metrics (completed, failed, quality, efficiency)
  - Task status breakdown per worker
  - Top projects and device types per worker
- ✅ **작업자별 작업량** (Sheet 1 & 4)
  - Tasks completed per worker
  - Total hours worked
  - Productive hours vs. break time
  - Tasks per hour rate
- ✅ **작업자 생산성** (Sheet 1: Performance Rankings)
  - Performance score (0-100)
  - Worker rankings
  - Performance tiers (EXCELLENT/GOOD/AVERAGE/BELOW_AVERAGE/POOR)
  - Efficiency and quality metrics
- Device type proficiency per worker
- Raw worker data export

---

## 💡 Best Practices

1. **Always validate dates before sending**
   ```typescript
   const isValidDate = (date: Date) => date instanceof Date && !isNaN(date.getTime());
   ```

2. **Use proper date formatting**
   ```typescript
   // Always use yyyy-MM-dd format
   const dateStr = format(date, 'yyyy-MM-dd');
   ```

3. **Handle timezone correctly**
   ```typescript
   // Use date-fns or similar library to avoid timezone issues
   import { formatInTimeZone } from 'date-fns-tz';
   ```

4. **Provide user feedback**
   - Show loading state during generation
   - Display success/error messages
   - Show download link after completion

5. **Cache report list**
   - Implement pagination
   - Cache previously generated reports
   - Allow users to re-download existing reports

---

## 🔗 Related Documentation

- [REPORT_REQUIREMENTS_ANALYSIS.md](./REPORT_REQUIREMENTS_ANALYSIS.md) - Detailed requirements analysis
- [REPORT_GENERATION_STATUS.md](./REPORT_GENERATION_STATUS.md) - Implementation details (1,138 lines)
- [API_DOCUMENTATION_SUMMARY.md](./API_DOCUMENTATION_SUMMARY.md) - Full API reference

---

## 📞 Support

For backend API questions, contact the backend team or refer to:
- **API Postman Collection:** `Smart_Factory_API.postman_collection.json`
- **Backend Documentation:** `/docs` folder

---

**Last Updated:** December 15, 2025  
**Backend API Version:** 1.0  
**Status:** ✅ Ready for Integration
