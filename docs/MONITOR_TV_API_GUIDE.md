# Monitor TV Display - API Integration Guide

## 📺 Overview

This guide provides complete API documentation for implementing the Monitor-TV Display with 6 auto-rotating slides showing real-time factory metrics.

**All data is REAL from database** - no dummy data!

---

## 🎯 API Endpoints Summary

| Slide | Endpoint | Purpose |
|-------|----------|---------|
| Slide 1 | `GET /api/dashboard/monitor-overview` | Overall metrics (task progress, compliance, productivity, errors, equipment, workers) |
| Slide 2 | `GET /api/dashboard/task-status-distribution` | Task status donut chart |
| Slide 2 | `GET /api/tasks` | Task list table |
| Slide 3 | `GET /api/dashboard/monitor-overview` | Device error frequency |
| Slide 3 | `GET /api/devices/monitor-layout/:id` | Equipment map grid layout |
| Slide 4 | `GET /api/dashboard/monitor-overview` | Alert summary |
| Slide 4 | `GET /api/alerts?status=PENDING&limit=10` | Recent alerts list |
| Slide 5-6 | `GET /api/dashboard/monitor-overview` | Worker metrics |
| Slide 5-6 | `GET /api/devices/monitor-layout/:id` | Worker-device assignments |

---

## 📊 Slide 1: 전체 현황 (Overall Status)

### Primary Endpoint
```typescript
GET /api/dashboard/monitor-overview
```

### Response Structure
```typescript
{
  success: true,
  data: {
    // 전체 작업 진행률 (Total Task Progress)
    taskProgress: {
      percentage: 75,      // 75%
      completed: 75,       // 완료 작업 수
      total: 100          // 전체 작업 수
    },
    
    // 남기 준수율 (Deadline Compliance)
    deadlineCompliance: {
      percentage: 85,      // 85%
      onTime: 85,         // 정시 납품 수
      total: 100          // 남기 완료 수
    },
    
    // 생산성 현황 (Productivity Status)
    productivity: {
      daily: {
        current: 20,       // 일간 작업 (현재)
        target: 50,        // 목표
        percentage: 40     // 50% (20/50)
      },
      weekly: {
        current: 65,       // 주간 작업
        target: 100,
        percentage: 65     // 65%
      },
      monthly: {
        current: 120,      // 월간 작업
        target: 150,
        percentage: 80     // 80%
      }
    },
    
    // 에러 현황 (Error Status - for Pie Chart)
    errors: {
      categories: [
        { name: "장비결함", count: 10, percentage: 40 },
        { name: "소재불량", count: 9, percentage: 30 },
        { name: "통제인지", count: 8, percentage: 20 },
        { name: "기타", count: 7, percentage: 10 }
      ],
      total: 34
    },
    
    // 장비 가동률 (Equipment Utilization)
    equipmentUtilization: {
      percentage: 50,      // 50%
      online: 20,         // 가동 장비 수
      offline: 10,
      maintenance: 5,
      error: 5,
      total: 40           // 총 장비 수
    },
    
    // 작업인원 (Workers)
    workers: {
      current: 7,         // 7명
      capacity: 10,       // 10명 (capacity)
      percentage: 70,     // 70%
      active: 1,          // 작업중
      idle: 6             // 대기중
    },
    
    // Additional metrics
    alerts: { ... },
    deviceErrorFrequency: [ ... ],
    timestamp: "2025-12-06T05:01:03.000Z"
  }
}
```

### Frontend Implementation
```typescript
import { dashboardApi } from '@/api/clients/dashboardClient';

// Fetch overall metrics
const fetchSlide1Data = async () => {
  const response = await dashboardApi.getMonitorOverview();
  
  return {
    taskProgress: response.taskProgress,
    deadlineCompliance: response.deadlineCompliance,
    productivity: response.productivity,
    errors: response.errors,
    equipmentUtilization: response.equipmentUtilization,
    workers: response.workers
  };
};
```

---

## 📋 Slide 2: 작업 현황 (Task Status)

### Endpoints

#### 1. Task Status Distribution (Donut Chart)
```typescript
GET /api/dashboard/task-status-distribution
```

**Response:**
```typescript
{
  success: true,
  data: {
    total: 100,
    distribution: [
      { status: "COMPLETED", count: 50, percentage: 50 },
      { status: "ONGOING", count: 30, percentage: 30 },
      { status: "PENDING", count: 20, percentage: 20 }
    ]
  }
}
```

#### 2. Task List Table
```typescript
GET /api/tasks?page=1&limit=10&sortBy=deadline&sortOrder=asc
```

**Response:**
```typescript
{
  success: true,
  data: {
    items: [
      {
        _id: "...",
        title: "2nd TRSUT PACK JIG",        // 작업번호/제품명
        recipeSnapshot: {
          name: "K2 HeadRack Jig",          // 제품명
          dwgNo: "LH-D25-08-245"            // 공정명/도면번호
        },
        productSnapshot: {
          customerName: "LG"                 // 고객사
        },
        workerId: {
          name: "김소은"                     // 담당자
        },
        stepOrder: 1,                        // 순서
        status: "ONGOING",                   // 상태
        deadline: "2025-12-01T00:00:00Z",   // 남기일
        progress: 60,                        // 진행률 (%)
        priority: "HIGH"                     // 우선순위
      }
    ],
    pagination: { ... }
  }
}
```

### Frontend Implementation
```typescript
const fetchSlide2Data = async () => {
  const [statusDist, taskList] = await Promise.all([
    dashboardApi.getTaskStatusDistribution(),
    taskApi.getTasks({ page: 1, limit: 10, sortBy: 'deadline' })
  ]);
  
  return {
    donutChart: statusDist,
    taskTable: taskList.items
  };
};
```

---

## 🔧 Slide 3: 장비 현황 (Equipment Status)

### Endpoints

#### 1. Equipment Utilization & Error Frequency
```typescript
GET /api/dashboard/monitor-overview
```

**Use these fields:**
```typescript
{
  equipmentUtilization: {
    percentage: 75,  // 현재 장비 가동률
    online: 43,      // 전체 장비 수
    offline: 13      // 비가동 장비 수
  },
  
  // 에러 장비 빈도 (Pie Chart)
  deviceErrorFrequency: [
    { deviceTypeName: "MCT", errorCount: 12, percentage: 40 },
    { deviceTypeName: "CNC", errorCount: 8, percentage: 30 },
    { deviceTypeName: "T/M", errorCount: 3, percentage: 30 }
  ]
}
```

#### 2. Equipment Map Layout
```typescript
GET /api/grid-layouts?isMonitorDisplay=true
```

**Response:**
```typescript
{
  success: true,
  data: {
    items: [
      {
        _id: "layout123",
        name: "Main Factory Layout",
        isMonitorDisplay: true,  // ← Only layouts with this=true shown on TV
        columns: 12,
        rows: 10,
        devices: [ ... ]
      }
    ]
  }
}
```

Then fetch layout details:
```typescript
GET /api/devices/monitor-layout/:layoutId
```

**Response:**
```typescript
{
  success: true,
  data: {
    layout: {
      _id: "...",
      name: "Main Factory Layout",
      devices: [
        {
          deviceId: {
            _id: "...",
            name: "5.MCT(5.4)",
            status: "ONLINE",
            deviceType: { name: "MCT" },
            currentTask: {
              _id: "...",
              title: "Task Name",
              status: "ONGOING"
            },
            currentUser: {
              _id: "...",
              name: "홍길동"  // Worker using this device
            }
          },
          row: 2,
          col: 3,
          rowSpan: 1,
          colSpan: 1
        }
      ]
    },
    summary: {
      totalDevices: 40,
      onlineDevices: 30,
      offlineDevices: 10
    }
  }
}
```

### Frontend Implementation
```typescript
const fetchSlide3Data = async () => {
  // Get overview metrics
  const overview = await dashboardApi.getMonitorOverview();
  
  // Get monitor layout (first one with isMonitorDisplay=true)
  const layouts = await gridLayoutApi.getLayouts({ isMonitorDisplay: true });
  const monitorLayoutId = layouts.items[0]._id;
  
  // Get layout details with devices
  const equipmentMap = await deviceApi.getMonitorLayout(monitorLayoutId);
  
  return {
    utilization: overview.equipmentUtilization,
    errorFrequency: overview.deviceErrorFrequency,
    equipmentGrid: equipmentMap.layout
  };
};
```

---

## 🚨 Slide 4: 에러&이슈 현황 (Errors & Issues)

### Endpoints

#### 1. Alert Summary
```typescript
GET /api/dashboard/monitor-overview
```

**Use alerts field:**
```typescript
{
  alerts: {
    total: 18,              // 전체 알림
    unconfirmed: 5,         // 미확인
    inProgress: 3,          // 처리중
    resolved: 10,           // 처리완료
    avgResponseTime: 12,    // 평균 응답 시간 (minutes)
    resolutionRate: 33      // 해결률 (%)
  }
}
```

#### 2. Recent Alerts List
```typescript
GET /api/alerts?status=PENDING&limit=10&sortBy=createdAt&sortOrder=desc
```

**Response:**
```typescript
{
  success: true,
  data: {
    items: [
      {
        _id: "...",
        type: "EQUIPMENT_FAILURE",  // 장비결함
        severity: "HIGH",
        status: "PENDING",           // 미확인
        message: "5. MCT(5.4) 장비 오류",
        deviceId: {
          name: "5.MCT(5.4)"
        },
        createdAt: "2025-12-05T16:00:04Z"
      },
      {
        type: "MATERIAL_DEFECT",     // 소재불량
        severity: "MEDIUM",
        status: "ACKNOWLEDGED",      // 처리중
        message: "소재 불량 감지",
        createdAt: "2025-12-05T15:00:04Z"
      }
    ]
  }
}
```

### Frontend Implementation
```typescript
const fetchSlide4Data = async () => {
  const [overview, recentAlerts] = await Promise.all([
    dashboardApi.getMonitorOverview(),
    alertApi.getAlerts({ status: 'PENDING', limit: 10 })
  ]);
  
  return {
    summary: overview.alerts,
    errorPieChart: overview.errors,
    recentAlerts: recentAlerts.items.map(alert => ({
      type: alert.type,
      device: alert.deviceId?.name,
      status: alert.status,
      time: alert.createdAt
    }))
  };
};
```

---

## 👷 Slide 5-6: 작업자 현황 (Worker Status)

### Endpoints

#### 1. Worker Metrics
```typescript
GET /api/dashboard/monitor-overview
```

**Use workers field:**
```typescript
{
  workers: {
    current: 7,    // 현재 작업인원
    capacity: 10,  // 총 인원 (capacity)
    percentage: 70,
    active: 1,     // 작업중
    idle: 6        // 대기중
  }
}
```

#### 2. Equipment Map with Workers
```typescript
GET /api/devices/monitor-layout/:layoutId
```

**Shows which worker is using which device:**
```typescript
{
  layout: {
    devices: [
      {
        deviceId: {
          name: "5.MCT(5.4)",
          status: "ONLINE",
          currentUser: {
            _id: "...",
            name: "홍길동",         // ← Worker name
            username: "worker01"
          },
          currentTask: {
            title: "작업명",
            status: "ONGOING"
          }
        }
      }
    ]
  }
}
```

### Frontend Implementation
```typescript
const fetchSlide5Data = async () => {
  const overview = await dashboardApi.getMonitorOverview();
  
  // Get layout with worker assignments
  const layouts = await gridLayoutApi.getLayouts({ isMonitorDisplay: true });
  const equipmentMap = await deviceApi.getMonitorLayout(layouts.items[0]._id);
  
  return {
    workerCount: overview.workers,
    deviceAssignments: equipmentMap.layout.devices.map(d => ({
      deviceName: d.deviceId.name,
      workerName: d.deviceId.currentUser?.name || "Available",
      taskName: d.deviceId.currentTask?.title || "-",
      status: d.deviceId.status
    }))
  };
};
```

---

## 🔄 Real-Time Updates (WebSocket)

### Connection Setup
```typescript
import io from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
  transports: ['websocket']
});

// Listen to real-time events
socket.on('device:update', (data) => {
  console.log('Device updated:', data);
  // Update equipment map in Slide 3, 5, 6
});

socket.on('task:update', (data) => {
  console.log('Task updated:', data);
  // Update task progress in Slide 1, 2
});

socket.on('alert:new', (data) => {
  console.log('New alert:', data);
  // Update alerts in Slide 1, 4
});

socket.on('kpi:update', (data) => {
  console.log('KPI updated:', data);
  // Update metrics in Slide 1
});
```

### Events Reference
| Event | When Triggered | Update Slides |
|-------|----------------|---------------|
| `device:update` | Device status changes, worker login/logout | 3, 5, 6 |
| `task:update` | Task status/progress changes | 1, 2 |
| `alert:new` | New alert created | 1, 4 |
| `alert:update` | Alert status changes | 4 |
| `kpi:update` | KPI data updated | 1 |

---

## 🎬 Auto-Rotating Slides Implementation

### React Example
```typescript
import { useState, useEffect } from 'react';

const MonitorTVDisplay = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const SLIDE_DURATION = 10000; // 10 seconds per slide
  const TOTAL_SLIDES = 6;
  
  // Auto-rotate slides
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, SLIDE_DURATION);
    
    return () => clearInterval(interval);
  }, []);
  
  // Fetch data for current slide
  useEffect(() => {
    fetchSlideData(currentSlide);
  }, [currentSlide]);
  
  const fetchSlideData = async (slideIndex: number) => {
    switch(slideIndex) {
      case 0: return fetchSlide1Data();
      case 1: return fetchSlide2Data();
      case 2: return fetchSlide3Data();
      case 3: return fetchSlide4Data();
      case 4:
      case 5: return fetchSlide5Data();
    }
  };
  
  return (
    <div className="monitor-tv-container">
      {currentSlide === 0 && <Slide1Overall />}
      {currentSlide === 1 && <Slide2TaskStatus />}
      {currentSlide === 2 && <Slide3Equipment />}
      {currentSlide === 3 && <Slide4Alerts />}
      {currentSlide === 4 && <Slide5Workers />}
      {currentSlide === 5 && <Slide6Workers />}
    </div>
  );
};
```

### Keyboard Controls (Development)
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    } else if (e.key === 'ArrowLeft') {
      setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
    } else if (e.key === ' ') {
      // Pause/Resume auto-rotation
      setIsPaused((prev) => !prev);
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## 🎨 Styling Recommendations

### Full-Screen Display
```css
.monitor-tv-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  padding: 2rem;
  overflow: hidden;
}

.slide {
  width: 100%;
  height: 100%;
  display: grid;
  gap: 1.5rem;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Responsive Grid for Metrics
```css
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
}
```

---

## 📱 API Client Example

### Create `dashboardClient.ts`
```typescript
import apiClient from "../enhancedApiClient";
import type {
  MonitorOverviewAPIResponse,
  TaskStatusDistributionAPIResponse
} from "@/api_spec/types/dashboard";

export const dashboardApi = {
  // Get monitor overview
  getMonitorOverview: async (): Promise<MonitorOverviewAPIResponse> => {
    const response = await apiClient.get<MonitorOverviewAPIResponse>(
      "/dashboard/monitor-overview"
    );
    if (!response.data.success) {
      throw new Error("Failed to get monitor overview");
    }
    return response.data;
  },
  
  // Get task status distribution
  getTaskStatusDistribution: async (): Promise<TaskStatusDistributionAPIResponse> => {
    const response = await apiClient.get<TaskStatusDistributionAPIResponse>(
      "/dashboard/task-status-distribution"
    );
    if (!response.data.success) {
      throw new Error("Failed to get task status distribution");
    }
    return response.data;
  }
};
```

---

## 🔐 Authentication

Monitor-TV endpoints are **PUBLIC** (no authentication required) for easy display setup.

If you need to restrict access, add authentication:

```typescript
import { authenticateToken } from '../middleware/auth';

router.get("/monitor-overview", authenticateToken, dashboardController.getMonitorOverview);
```

---

## ⚙️ Configuration

### Productivity Targets

Currently hardcoded in `dashboardController.ts`:
```typescript
const dailyTarget = 50;
const weeklyTarget = 100;
const monthlyTarget = 150;
```

**To make configurable**, create system settings table or use environment variables.

### Worker Capacity

Currently hardcoded:
```typescript
const workerCapacity = 10;
```

**To make dynamic**, add `capacity` field to organization settings.

---

## 🐛 Troubleshooting

### Issue: Data not updating
**Solution**: Check WebSocket connection
```typescript
socket.on('connect', () => console.log('WebSocket connected'));
socket.on('disconnect', () => console.log('WebSocket disconnected'));
```

### Issue: Layout not showing on Monitor-TV
**Solution**: Ensure `isMonitorDisplay: true` in GridLayout
```typescript
PATCH /api/grid-layouts/:id
{ "isMonitorDisplay": true }
```

### Issue: Worker not showing on device
**Solution**: Worker must login to device first
```typescript
POST /api/devices/:deviceId/worker-login
Headers: { Authorization: "Bearer <worker_token>" }
```

---

## 📊 Performance Tips

1. **Cache monitor overview data** (refresh every 30 seconds)
2. **Use WebSocket for real-time updates** instead of polling
3. **Prefetch next slide data** while current slide is displaying
4. **Optimize images** in equipment map (use WebP format)
5. **Lazy load** alert history and task tables

---

## 🚀 Deployment Checklist

- [ ] Set `CORS_ORIGIN` to include Monitor-TV URL
- [ ] Configure WebSocket endpoint in frontend
- [ ] Set auto-rotation interval (recommended: 10-15 seconds)
- [ ] Test on target display resolution (4K TV recommended)
- [ ] Enable full-screen mode on startup
- [ ] Set up layout with `isMonitorDisplay: true`
- [ ] Test real-time updates via WebSocket
- [ ] Configure productivity targets
- [ ] Set worker capacity

---

## 📞 Support

For issues or questions:
- Backend API: Check `src/controllers/dashboardController.ts`
- WebSocket: Check `src/config/websocket.ts`
- Types: Check `api_spec/types/dashboard.ts`

**Last Updated**: December 6, 2025

고객 정보 표시 (department 필드 포함) - 최근 추가
Auto-pagination - 스크롤 대신 페이지 분할
Connection status indicator - 실시간 연결 상태 표시
Progress indicators - 슬라이드 진행 상태 표시
last updated - 12월 15일, 2025