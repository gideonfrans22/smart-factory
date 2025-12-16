import ExcelJS from "exceljs";

/**
 * Excel Formatting Service
 * Provides utilities for styling Excel reports with consistent formatting
 */

// ==================== COLOR CONSTANTS ====================

export const COLORS = {
  // Status colors
  SUCCESS: "FF92D050", // Green
  WARNING: "FFFFC000", // Yellow/Orange
  DANGER: "FFFF0000", // Red
  INFO: "FF4472C4", // Blue
  NEUTRAL: "FFD9D9D9", // Light Gray

  // Header colors
  HEADER_BG: "FF1F4E78", // Dark Blue
  HEADER_TEXT: "FFFFFFFF", // White

  // Background colors
  WHITE: "FFFFFFFF",
  LIGHT_GRAY: "FFF2F2F2",

  // Performance rating colors
  EXCELLENT: "FF00B050", // Dark Green
  GOOD: "FF92D050", // Light Green
  AVERAGE: "FFFFC000", // Yellow
  POOR: "FFFF0000", // Red

  // Proficiency colors
  EXPERT: "FF00B050", // Green
  PROFICIENT: "FF4472C4", // Blue
  COMPETENT: "FFFFC000", // Yellow
  NEEDS_TRAINING: "FFFF0000" // Red
};

// ==================== FORMATTING FUNCTIONS ====================

/**
 * Apply header styling to a row
 * Bold, dark blue background, white text, centered
 */
export function styleHeaderRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number
): void {
  const row = worksheet.getRow(rowNumber);

  for (let i = 1; i <= columnCount; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true, color: { argb: COLORS.HEADER_TEXT }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.HEADER_BG }
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  }

  row.height = 20;
}

/**
 * Apply alternating row colors for better readability
 */
export function applyAlternatingRows(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number
): void {
  for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const bgColor = rowNum % 2 === 0 ? COLORS.WHITE : COLORS.LIGHT_GRAY;

    for (let colNum = 1; colNum <= columnCount; colNum++) {
      const cell = row.getCell(colNum);
      if (!cell.fill || (cell.fill as any).fgColor?.argb === COLORS.WHITE) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor }
        };
      }
    }
  }
}

/**
 * Apply borders to a range of cells
 */
export function applyBorders(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): void {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }
  }
}

/**
 * Freeze header row and optionally first column
 */
export function freezePanes(
  worksheet: ExcelJS.Worksheet,
  freezeFirstColumn: boolean = false
): void {
  worksheet.views = [
    {
      state: "frozen",
      xSplit: freezeFirstColumn ? 1 : 0,
      ySplit: 1,
      topLeftCell: freezeFirstColumn ? "B2" : "A2"
    }
  ];
}

/**
 * Enable auto-filter on header row
 */
export function enableAutoFilter(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endCol: number
): void {
  worksheet.autoFilter = {
    from: { row: startRow, column: startCol },
    to: { row: startRow, column: endCol }
  };
}

/**
 * Auto-adjust column widths based on content
 */
export function autoAdjustColumnWidths(
  worksheet: ExcelJS.Worksheet,
  minWidth: number = 10,
  maxWidth: number = 50
): void {
  worksheet.columns.forEach((column) => {
    let maxLength = minWidth;

    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value?.toString() || "";
        maxLength = Math.max(maxLength, cellValue.length);
      });
    }

    column.width = Math.min(Math.max(maxLength + 2, minWidth), maxWidth);
  });
}

/**
 * Apply status color coding to a cell
 */
export function applyStatusColor(cell: ExcelJS.Cell, status: string): void {
  let color: string;

  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "DONE":
    case "SUCCESS":
      color = COLORS.SUCCESS;
      break;
    case "ONGOING":
    case "IN_PROGRESS":
    case "ACTIVE":
      color = COLORS.WARNING;
      break;
    case "FAILED":
    case "ERROR":
    case "CRITICAL":
      color = COLORS.DANGER;
      break;
    case "PENDING":
    case "WAITING":
      color = COLORS.NEUTRAL;
      break;
    default:
      return; // No color
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };
}

/**
 * Apply performance rating color coding
 */
export function applyPerformanceColor(
  cell: ExcelJS.Cell,
  rating: string
): void {
  let color: string;

  switch (rating.toUpperCase()) {
    case "EXCELLENT":
      color = COLORS.EXCELLENT;
      break;
    case "GOOD":
      color = COLORS.GOOD;
      break;
    case "AVERAGE":
      color = COLORS.AVERAGE;
      break;
    case "POOR":
      color = COLORS.POOR;
      break;
    default:
      return;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };
  cell.font = { color: { argb: COLORS.WHITE }, bold: true };
}

/**
 * Format number as percentage
 */
export function formatAsPercentage(cell: ExcelJS.Cell, value: number): void {
  cell.value = value / 100;
  cell.numFmt = "0.0%";
}

/**
 * Format number as duration (hours)
 */
export function formatAsDuration(cell: ExcelJS.Cell, seconds: number): void {
  const hours = seconds / 3600;
  cell.value = hours;
  cell.numFmt = "0.0h";
}

/**
 * Format as date/time
 */
export function formatAsDateTime(
  cell: ExcelJS.Cell,
  date: Date | string
): void {
  cell.value = new Date(date);
  cell.numFmt = "yyyy-mm-dd hh:mm";
}

/**
 * Format as date only
 */
export function formatAsDate(cell: ExcelJS.Cell, date: Date | string): void {
  cell.value = new Date(date);
  cell.numFmt = "yyyy-mm-dd";
}

/**
 * Apply conditional formatting for metrics
 * Green if >= threshold, Yellow if >= warningThreshold, Red otherwise
 */
export function applyConditionalFormatting(
  cell: ExcelJS.Cell,
  value: number,
  threshold: number = 90,
  warningThreshold: number = 70
): void {
  let color: string;

  if (value >= threshold) {
    color = COLORS.SUCCESS;
  } else if (value >= warningThreshold) {
    color = COLORS.WARNING;
  } else {
    color = COLORS.DANGER;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };
}

/**
 * Apply proficiency color coding
 */
export function applyProficiencyColor(
  cell: ExcelJS.Cell,
  proficiency: number
): void {
  let color: string;

  if (proficiency >= 95) {
    color = COLORS.EXPERT;
  } else if (proficiency >= 85) {
    color = COLORS.PROFICIENT;
  } else if (proficiency >= 70) {
    color = COLORS.COMPETENT;
  } else {
    color = COLORS.NEEDS_TRAINING;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color }
  };
  cell.font = { color: { argb: COLORS.WHITE }, bold: true };
}

// ==================== APPROVAL FORM ====================

/**
 * Generate side-by-side approval form in top-right corner
 * Format: Supervisor | Manager | Director
 * Fields: Name, Signature, Date
 */
export function createApprovalForm(
  worksheet: ExcelJS.Worksheet,
  startRow: number = 1,
  startCol: number = 10 // Column J
): void {
  const roles = ["Supervisor", "Manager", "Director"];
  const formWidth = 3; // 3 columns per role
  const formHeight = 5; // 5 rows total
  console.log(formHeight);

  // Title row
  worksheet.mergeCells(
    startRow,
    startCol,
    startRow,
    startCol + roles.length * formWidth - 1
  );
  const titleCell = worksheet.getCell(startRow, startCol);
  titleCell.value = "결재";
  titleCell.font = {
    bold: true,
    size: 12,
    color: { argb: COLORS.HEADER_TEXT }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "thin" },
    right: { style: "medium" }
  };

  // Create each role section
  let currentCol = startCol;
  roles.forEach((role, index) => {
    const colEnd = currentCol + formWidth - 1;

    // Role header
    worksheet.mergeCells(startRow + 1, currentCol, startRow + 1, colEnd);
    const roleCell = worksheet.getCell(startRow + 1, currentCol);
    roleCell.value = role;
    roleCell.font = { bold: true, size: 11 };
    roleCell.alignment = { vertical: "middle", horizontal: "center" };
    roleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.LIGHT_GRAY }
    };
    roleCell.border = {
      top: { style: "thin" },
      left: index === 0 ? { style: "medium" } : { style: "thin" },
      bottom: { style: "thin" },
      right:
        index === roles.length - 1 ? { style: "medium" } : { style: "thin" }
    };

    // Name field
    worksheet.mergeCells(startRow + 2, currentCol, startRow + 2, colEnd);
    const nameCell = worksheet.getCell(startRow + 2, currentCol);
    nameCell.value = "이름: _______________";
    nameCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    nameCell.border = {
      left: index === 0 ? { style: "medium" } : { style: "thin" },
      right:
        index === roles.length - 1 ? { style: "medium" } : { style: "thin" }
    };

    // Date field
    worksheet.mergeCells(startRow + 3, currentCol, startRow + 3, colEnd);
    const dateCell = worksheet.getCell(startRow + 3, currentCol);
    dateCell.value = "날짜: ________________";
    dateCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    dateCell.border = {
      left: index === 0 ? { style: "medium" } : { style: "thin" },
      right:
        index === roles.length - 1 ? { style: "medium" } : { style: "thin" }
    };

    // Approval checkbox
    worksheet.mergeCells(startRow + 4, currentCol, startRow + 4, colEnd);
    const approvalCell = worksheet.getCell(startRow + 4, currentCol);
    approvalCell.value = "☐ Approved";
    approvalCell.alignment = { vertical: "middle", horizontal: "center" };
    approvalCell.border = {
      top: { style: "thin" },
      left: index === 0 ? { style: "medium" } : { style: "thin" },
      bottom: { style: "medium" },
      right:
        index === roles.length - 1 ? { style: "medium" } : { style: "thin" }
    };

    currentCol += formWidth;
  });

  // Adjust row heights
  worksheet.getRow(startRow).height = 25;
  worksheet.getRow(startRow + 1).height = 20;
  worksheet.getRow(startRow + 2).height = 20;
  worksheet.getRow(startRow + 3).height = 20;
  worksheet.getRow(startRow + 4).height = 20;
}

// ==================== CHART HELPERS ====================

/**
 * Add a pie chart to the worksheet
 */
export function addPieChart(
  worksheet: ExcelJS.Worksheet,
  title: string,
  dataRange: string,
  labelsRange: string,
  position: { row: number; col: number },
  size: { width: number; height: number } = { width: 500, height: 300 }
): void {
  console.log(dataRange, labelsRange, size);

  // Note: ExcelJS has limited chart support, this is a placeholder
  // In production, you might need to use more advanced libraries or templates
  const chartNote = worksheet.getCell(position.row, position.col);
  chartNote.value = `[Chart: ${title} - Pie Chart]`;
  chartNote.font = { italic: true, color: { argb: COLORS.INFO } };
  chartNote.alignment = { vertical: "middle", horizontal: "center" };
}

/**
 * Add a line chart to the worksheet
 */
export function addLineChart(
  worksheet: ExcelJS.Worksheet,
  title: string,
  dataRange: string,
  position: { row: number; col: number },
  size: { width: number; height: number } = { width: 600, height: 300 }
): void {
  console.log(dataRange, size);

  const chartNote = worksheet.getCell(position.row, position.col);
  chartNote.value = `[Chart: ${title} - Line Chart]`;
  chartNote.font = { italic: true, color: { argb: COLORS.INFO } };
  chartNote.alignment = { vertical: "middle", horizontal: "center" };
}

/**
 * Add a bar chart to the worksheet
 */
export function addBarChart(
  worksheet: ExcelJS.Worksheet,
  title: string,
  dataRange: string,
  position: { row: number; col: number },
  size: { width: number; height: number } = { width: 600, height: 400 }
): void {
  console.log(dataRange, size);
  const chartNote = worksheet.getCell(position.row, position.col);
  chartNote.value = `[Chart: ${title} - Bar Chart]`;
  chartNote.font = { italic: true, color: { argb: COLORS.INFO } };
  chartNote.alignment = { vertical: "middle", horizontal: "center" };
}

/**
 * Add a column chart to the worksheet
 */
export function addColumnChart(
  worksheet: ExcelJS.Worksheet,
  title: string,
  dataRange: string,
  position: { row: number; col: number },
  size: { width: number; height: number } = { width: 600, height: 350 }
): void {
  console.log(dataRange, size);
  const chartNote = worksheet.getCell(position.row, position.col);
  chartNote.value = `[Chart: ${title} - Column Chart]`;
  chartNote.font = { italic: true, color: { argb: COLORS.INFO } };
  chartNote.alignment = { vertical: "middle", horizontal: "center" };
}

/**
 * Add a scatter plot to the worksheet
 */
export function addScatterPlot(
  worksheet: ExcelJS.Worksheet,
  title: string,
  dataRange: string,
  position: { row: number; col: number },
  size: { width: number; height: number } = { width: 500, height: 400 }
): void {
  console.log(dataRange, size);
  const chartNote = worksheet.getCell(position.row, position.col);
  chartNote.value = `[Chart: ${title} - Scatter Plot]`;
  chartNote.font = { italic: true, color: { argb: COLORS.INFO } };
  chartNote.alignment = { vertical: "middle", horizontal: "center" };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create a formatted text box / instruction box
 */
export function createInstructionBox(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  title: string,
  content: string[]
): void {
  // Merge cells for the box
  worksheet.mergeCells(startRow, startCol, endRow, endCol);
  const cell = worksheet.getCell(startRow, startCol);

  // Format content
  const formattedContent = [title, "", ...content].join("\n");
  cell.value = formattedContent;

  // Styling
  cell.font = { size: 10 };
  cell.alignment = {
    vertical: "top",
    horizontal: "left",
    wrapText: true,
    indent: 1
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF9F9F9" }
  };
  cell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
}

/**
 * Add a visual separator row
 */
export function addSeparatorRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
  text?: string
): void {
  const row = worksheet.getRow(rowNumber);

  if (text) {
    worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.HEADER_TEXT } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.INFO }
    };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  }

  row.height = 20;
}

/**
 * Format a cell with trend indicator
 */
export function addTrendIndicator(
  cell: ExcelJS.Cell,
  value: number,
  previousValue: number
): void {
  const percentChange = ((value - previousValue) / previousValue) * 100;
  const arrow = percentChange > 0 ? "↗" : percentChange < 0 ? "↘" : "→";
  const color =
    percentChange > 0
      ? COLORS.SUCCESS
      : percentChange < 0
      ? COLORS.DANGER
      : COLORS.INFO;

  cell.value = `${arrow} ${Math.abs(percentChange).toFixed(1)}%`;
  cell.font = { color: { argb: color }, bold: true };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

/**
 * Create a styled summary box
 */
export function createSummaryBox(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  width: number,
  height: number,
  title: string,
  data: { label: string; value: string | number }[]
): void {
  console.log(height);
  let currentRow = startRow;

  // Title
  worksheet.mergeCells(currentRow, startCol, currentRow, startCol + width - 1);
  const titleCell = worksheet.getCell(currentRow, startCol);
  titleCell.value = title;
  titleCell.font = {
    bold: true,
    size: 12,
    color: { argb: COLORS.HEADER_TEXT }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "thin" },
    right: { style: "medium" }
  };
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  // Data rows
  data.forEach((item, index) => {
    const isLast = index === data.length - 1;

    // Label cell
    const labelCell = worksheet.getCell(currentRow, startCol);
    labelCell.value = item.label;
    labelCell.font = { size: 10 };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    labelCell.border = {
      left: { style: "medium" },
      right: { style: "thin" },
      bottom: isLast ? { style: "medium" } : { style: "thin" }
    };

    // Value cells (merged)
    worksheet.mergeCells(
      currentRow,
      startCol + 1,
      currentRow,
      startCol + width - 1
    );
    const valueCell = worksheet.getCell(currentRow, startCol + 1);
    valueCell.value = item.value;
    valueCell.font = { bold: true, size: 10 };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "right",
      indent: 1
    };
    valueCell.border = {
      right: { style: "medium" },
      bottom: isLast ? { style: "medium" } : { style: "thin" }
    };

    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  });
}
