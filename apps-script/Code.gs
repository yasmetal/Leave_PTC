/**
 * ===========================================================================
 * ระบบใบลาออนไลน์ - Google Apps Script Backend (v2)
 * ===========================================================================
 * v2 เพิ่มการรองรับ: สถานะคำขอ (รออนุมัติ/อนุมัติแล้ว/ไม่อนุมัติ/ยกเลิกแล้ว),
 * หน้าสถานะของฉัน, หน้าอนุมัติ, หน้ารายละเอียด และหน้าภาพรวม
 *
 * วิธีใช้งาน (สำคัญ — ต้องทำทุกครั้งที่ไฟล์นี้เปลี่ยน):
 * 1. เปิด Apps Script ของโปรเจกต์ (Extensions > Apps Script จากใน Google Sheet เดิม)
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งไฟล์ลงไปแทน
 * 3. กด Save (ไอคอนแผ่นดิสก์)
 * 4. กด Deploy > Manage deployments > ไอคอนดินสอ (แก้ไข) > Version: "New version" > Deploy
 *    (แก้โค้ดอย่างเดียวไม่พอ ต้องสร้างเวอร์ชันใหม่ทุกครั้ง ไม่เช่นนั้น URL เดิมจะยังรันโค้ดเก่าอยู่)
 * ระบบจะเพิ่มคอลัมน์ใหม่ต่อท้ายคอลัมน์เดิมในชีตที่มีอยู่แล้วโดยอัตโนมัติ
 * (ไม่กระทบข้อมูลเก่าที่เคยบันทึกไว้)
 * ===========================================================================
 */

const SHEET_NAME = "LeaveRequests";

// คอลัมน์เดิม (คงลำดับเดิมไว้เพื่อไม่กระทบข้อมูลที่มีอยู่แล้วในชีต)
const BASE_HEADERS = [
  "เวลาที่บันทึก",
  "ชื่อ-นามสกุล",
  "รหัสพนักงาน",
  "ตำแหน่ง",
  "แผนก",
  "เบอร์ติดต่อ",
  "ประเภทการลา",
  "วันที่เริ่มลา",
  "วันที่สิ้นสุดลา",
  "จำนวนวันลา",
  "เหตุผล",
  "ผู้อนุมัติ",
  "ผู้ยื่นคำร้อง (ลงชื่อ)"
];

// คอลัมน์ใหม่ (v2) — จะถูกเพิ่มต่อท้ายคอลัมน์ที่มีอยู่แล้วโดยอัตโนมัติ
const EXT_HEADERS = [
  "รหัสคำขอ",
  "สถานะ",
  "ผู้ตัดสินใจ",
  "วันที่ตัดสินใจ",
  "หมายเหตุการตัดสินใจ"
];

const ALL_HEADERS = BASE_HEADERS.concat(EXT_HEADERS);

// แปลงชื่อคอลัมน์ (ภาษาไทย) <-> ชื่อฟิลด์ที่ใช้คุยกับหน้าเว็บ
const FIELD_BY_HEADER = {
  "เวลาที่บันทึก": "timestamp",
  "ชื่อ-นามสกุล": "fullName",
  "รหัสพนักงาน": "employeeId",
  "ตำแหน่ง": "position",
  "แผนก": "department",
  "เบอร์ติดต่อ": "phone",
  "ประเภทการลา": "leaveType",
  "วันที่เริ่มลา": "startDate",
  "วันที่สิ้นสุดลา": "endDate",
  "จำนวนวันลา": "totalDays",
  "เหตุผล": "reason",
  "ผู้อนุมัติ": "approver",
  "ผู้ยื่นคำร้อง (ลงชื่อ)": "signature",
  "รหัสคำขอ": "id",
  "สถานะ": "status",
  "ผู้ตัดสินใจ": "decidedBy",
  "วันที่ตัดสินใจ": "decidedAt",
  "หมายเหตุการตัดสินใจ": "decisionNote"
};

const STATUS_PENDING = "รออนุมัติ";
const STATUS_APPROVED = "อนุมัติแล้ว";
const STATUS_REJECTED = "ไม่อนุมัติ";
const STATUS_CANCELLED = "ยกเลิกแล้ว";

// ---------------------------------------------------------------------------
// Entry points ของ Web App
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "ไม่พบข้อมูลที่ส่งมา" });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action || "submit";

    switch (action) {
      case "submit":
        return jsonResponse(handleSubmit(data));
      case "decide":
        return jsonResponse(handleDecide(data));
      case "cancel":
        return jsonResponse(handleCancel(data));
      default:
        return jsonResponse({ status: "error", message: "ไม่รู้จักคำสั่ง action: " + action });
    }
  } catch (err) {
    console.error("doPost error: " + err.message + "\n" + err.stack);
    return jsonResponse({ status: "error", message: err.message });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || "health";

    switch (action) {
      case "health":
        return jsonResponse({
          status: "ok",
          message: "ระบบใบลาออนไลน์พร้อมใช้งาน v2 (list / detail / pending / overview / POST submit,decide,cancel)"
        });
      case "list":
        return jsonResponse(handleList(params));
      case "detail":
        return jsonResponse(handleDetail(params));
      case "pending":
        return jsonResponse(handlePending(params));
      case "overview":
        return jsonResponse(handleOverview(params));
      default:
        return jsonResponse({ status: "error", message: "ไม่รู้จักคำสั่ง action: " + action });
    }
  } catch (err) {
    console.error("doGet error: " + err.message + "\n" + err.stack);
    return jsonResponse({ status: "error", message: err.message });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleSubmit(data) {
  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const id = generateRequestId();
  const now = new Date();

  const values = {
    timestamp: data.timestamp ? new Date(data.timestamp) : now,
    fullName: data.fullName || "",
    employeeId: data.employeeId || "",
    position: data.position || "",
    department: data.department || "",
    phone: data.phone || "",
    leaveType: data.leaveType || "",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    totalDays: data.totalDays || "",
    reason: data.reason || "",
    approver: data.approver || "",
    signature: data.signature || "",
    id: id,
    status: STATUS_PENDING,
    decidedBy: "",
    decidedAt: "",
    decisionNote: ""
  };

  sheet.appendRow(buildRowArray(map, values));

  return { status: "ok", message: "บันทึกข้อมูลสำเร็จ", id: id };
}

function handleDecide(data) {
  if (!data.id) return { status: "error", message: "ไม่พบรหัสคำขอ (id)" };
  if (data.decision !== "approved" && data.decision !== "rejected") {
    return { status: "error", message: "decision ต้องเป็น approved หรือ rejected" };
  }
  if (data.decision === "rejected" && !(data.note || "").trim()) {
    return { status: "error", message: "กรุณาระบุเหตุผลเมื่อไม่อนุมัติ" };
  }

  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const found = findRowById(sheet, map, data.id);
  if (!found) return { status: "error", message: "ไม่พบคำขอรหัส " + data.id };

  const currentStatus = found.obj.status || STATUS_PENDING;
  if (currentStatus !== STATUS_PENDING) {
    return {
      status: "error",
      message: "คำขอนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: " + currentStatus + ")"
    };
  }

  const newStatus = data.decision === "approved" ? STATUS_APPROVED : STATUS_REJECTED;
  const now = new Date();

  setCell(sheet, map, found.rowIndex, "status", newStatus);
  setCell(sheet, map, found.rowIndex, "decidedBy", data.decidedBy || "");
  setCell(sheet, map, found.rowIndex, "decidedAt", now);
  setCell(sheet, map, found.rowIndex, "decisionNote", data.note || "");

  return { status: "ok", message: "บันทึกผลการพิจารณาสำเร็จ", id: data.id, newStatus: newStatus };
}

function handleCancel(data) {
  if (!data.id) return { status: "error", message: "ไม่พบรหัสคำขอ (id)" };

  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const found = findRowById(sheet, map, data.id);
  if (!found) return { status: "error", message: "ไม่พบคำขอรหัส " + data.id };

  const currentStatus = found.obj.status || STATUS_PENDING;
  if (currentStatus !== STATUS_PENDING) {
    return {
      status: "error",
      message: "ไม่สามารถยกเลิกคำขอที่ดำเนินการแล้วได้ (สถานะปัจจุบัน: " + currentStatus + ")"
    };
  }

  const now = new Date();
  setCell(sheet, map, found.rowIndex, "status", STATUS_CANCELLED);
  setCell(sheet, map, found.rowIndex, "decidedBy", data.cancelledBy || "ผู้ยื่นคำร้อง");
  setCell(sheet, map, found.rowIndex, "decidedAt", now);
  setCell(sheet, map, found.rowIndex, "decisionNote", "ยกเลิกโดยผู้ยื่นคำร้อง");

  return { status: "ok", message: "ยกเลิกคำขอสำเร็จ", id: data.id };
}

function handleList(params) {
  const name = (params.name || "").trim().toLowerCase();
  const employeeId = (params.employeeId || "").trim().toLowerCase();
  if (!name && !employeeId) {
    return { status: "error", message: "กรุณาระบุ name หรือ employeeId" };
  }

  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const rows = readAllRequests(sheet, map);

  const filtered = rows.filter(function (r) {
    const matchName = name && (r.fullName || "").trim().toLowerCase() === name;
    const matchEmpId = employeeId && (r.employeeId || "").trim().toLowerCase() === employeeId;
    return matchName || matchEmpId;
  });

  sortByTimestampDesc(filtered);

  return { status: "ok", data: filtered.map(toSummary) };
}

function handleDetail(params) {
  const id = params.id;
  if (!id) return { status: "error", message: "กรุณาระบุ id" };

  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const found = findRowById(sheet, map, id);
  if (!found) return { status: "error", message: "ไม่พบคำขอรหัส " + id };

  return { status: "ok", data: toDetail(found.obj) };
}

function handlePending(params) {
  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const rows = readAllRequests(sheet, map);

  const pending = rows.filter(function (r) {
    const status = r.status || STATUS_PENDING;
    return status === STATUS_PENDING;
  });

  sortByTimestampDesc(pending);

  const limit = Math.min(parseInt(params.limit, 10) || 200, 500);
  return { status: "ok", data: pending.slice(0, limit).map(toSummary) };
}

function handleOverview(params) {
  const sheet = getOrCreateSheet();
  const map = getHeaderMap(sheet);
  const rows = readAllRequests(sheet, map);

  const now = new Date();
  const tz = Session.getScriptTimeZone();
  const targetMonth = params.month || Utilities.formatDate(now, tz, "yyyy-MM");

  const inMonth = rows.filter(function (r) {
    const d = r.startDate || dateToYmd(r.timestamp, tz);
    return typeof d === "string" && d.indexOf(targetMonth) === 0;
  });

  const counts = { total: inMonth.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  const byType = {};

  inMonth.forEach(function (r) {
    const status = r.status || STATUS_PENDING;
    if (status === STATUS_PENDING) counts.pending++;
    else if (status === STATUS_APPROVED) counts.approved++;
    else if (status === STATUS_REJECTED) counts.rejected++;
    else if (status === STATUS_CANCELLED) counts.cancelled++;

    const type = r.leaveType || "อื่นๆ";
    const days = parseFloat(r.totalDays) || 0;
    byType[type] = (byType[type] || 0) + (days || 1);
  });

  const recentAll = rows.slice();
  sortByTimestampDesc(recentAll);

  return {
    status: "ok",
    data: {
      month: targetMonth,
      counts: counts,
      byType: byType,
      recent: recentAll.slice(0, 10).map(toSummary)
    }
  };
}

// ---------------------------------------------------------------------------
// Sheet / header helpers
// ---------------------------------------------------------------------------

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ALL_HEADERS);
    sheet.getRange(1, 1, 1, ALL_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, ALL_HEADERS.length);
  } else {
    ensureExtraHeaders(sheet);
  }

  return sheet;
}

// เพิ่มคอลัมน์ใหม่ (v2) ต่อท้าย ถ้าชีตเดิมยังไม่มี — ไม่กระทบคอลัมน์/ข้อมูลเดิม
function ensureExtraHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = EXT_HEADERS.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length === 0) return;

  const startCol = lastCol + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  sheet.getRange(1, startCol, 1, missing.length).setFontWeight("bold");
}

function getHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach(function (h, i) {
    if (h) map[h] = i + 1; // 1-based column index
  });
  return map;
}

// สร้างแถวข้อมูล (array) ให้ตรงกับตำแหน่งคอลัมน์จริงในชีต ไม่ว่าจะเรียงลำดับอย่างไร
function buildRowArray(map, valuesByField) {
  const width = Object.keys(map).length;
  const row = new Array(width).fill("");
  Object.keys(map).forEach(function (header) {
    const field = FIELD_BY_HEADER[header];
    if (field && Object.prototype.hasOwnProperty.call(valuesByField, field)) {
      row[map[header] - 1] = valuesByField[field];
    }
  });
  return row;
}

function setCell(sheet, map, rowIndex, field, value) {
  const header = Object.keys(FIELD_BY_HEADER).find(function (h) { return FIELD_BY_HEADER[h] === field; });
  const col = header && map[header];
  if (!col) return;
  sheet.getRange(rowIndex, col).setValue(value);
}

function readAllRequests(sheet, map) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headerByCol = {};
  Object.keys(map).forEach(function (h) { headerByCol[map[h]] = h; });

  const results = [];
  values.forEach(function (rowArr, i) {
    // ข้ามแถวว่างสนิท (เช่น เผลอเว้นบรรทัด)
    const isBlank = rowArr.every(function (v) { return v === "" || v === null; });
    if (isBlank) return;

    const obj = { rowIndex: i + 2 };
    rowArr.forEach(function (val, colIdx) {
      const header = headerByCol[colIdx + 1];
      const field = header && FIELD_BY_HEADER[header];
      if (field) obj[field] = val;
    });
    results.push(obj);
  });

  // เติมรหัสคำขอ (id) ให้แถวเก่าที่ยื่นไว้ก่อนอัปเดตนี้ (ไม่เคยมี id) โดยอัตโนมัติ
  // เพื่อให้จัดการผ่านหน้าเว็บใหม่ (สถานะ/อนุมัติ/รายละเอียด) ได้เหมือนคำขอใหม่ทุกประการ
  results.forEach(function (obj) {
    if (!obj.id) {
      const newId = generateRequestId();
      obj.id = newId;
      setCell(sheet, map, obj.rowIndex, "id", newId);
    }
  });

  return results;
}

function findRowById(sheet, map, id) {
  const rows = readAllRequests(sheet, map);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return { rowIndex: rows[i].rowIndex, obj: rows[i] };
  }
  return null;
}

function sortByTimestampDesc(rows) {
  rows.sort(function (a, b) {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
}

function toSummary(r) {
  return {
    id: r.id || "",
    fullName: r.fullName || "",
    department: r.department || "",
    leaveType: r.leaveType || "",
    startDate: r.startDate || "",
    endDate: r.endDate || "",
    totalDays: r.totalDays || "",
    reason: r.reason || "",
    status: r.status || STATUS_PENDING,
    submittedAt: r.timestamp || "",
    approver: r.approver || "",
    decidedBy: r.decidedBy || "",
    decidedAt: r.decidedAt || "",
    decisionNote: r.decisionNote || ""
  };
}

function toDetail(r) {
  const summary = toSummary(r);
  summary.employeeId = r.employeeId || "";
  summary.position = r.position || "";
  summary.phone = r.phone || "";
  summary.signature = r.signature || "";
  return summary;
}

function dateToYmd(d, tz) {
  if (!d) return "";
  try {
    return Utilities.formatDate(new Date(d), tz, "yyyy-MM-dd");
  } catch (err) {
    return "";
  }
}

function generateRequestId() {
  const tz = Session.getScriptTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, "yyMMdd-HHmmss");
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return "LR-" + stamp + "-" + rand;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Self-test — รันตรงจาก Apps Script editor (เลือกฟังก์ชัน selfTest แล้วกด Run)
// ทดสอบ submit -> list -> pending -> detail -> decide -> overview ครบวงจร
// โดยไม่ต้องผ่านหน้าเว็บเลย ดูผลลัพธ์ที่ View > Logs
// ---------------------------------------------------------------------------
function selfTest() {
  console.log("=== เริ่มตรวจสอบระบบ v2 ===");

  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log("✅ เข้าถึงสมุดงานได้: " + ss.getUrl());
  } catch (err) {
    console.error("❌ เข้าถึงสมุดงานไม่ได้: " + err.message);
    console.error("แก้ไข: สคริปต์นี้ต้อง Bound อยู่กับ Google Sheet (สร้างจากเมนู Extensions > Apps Script ในชีต)");
    return;
  }

  let sheet;
  try {
    sheet = getOrCreateSheet();
    console.log("✅ ชีต '" + SHEET_NAME + "' พร้อมใช้งาน จำนวนแถวปัจจุบัน: " + sheet.getLastRow());
    console.log("   คอลัมน์ทั้งหมด: " + Object.keys(getHeaderMap(sheet)).join(", "));
  } catch (err) {
    console.error("❌ สร้าง/เข้าถึงชีตไม่ได้: " + err.message);
    return;
  }

  let testId;
  try {
    const result = handleSubmit({
      fullName: "[SELFTEST] ทดสอบระบบ",
      employeeId: "TEST-000",
      department: "IT",
      phone: "0800000000",
      leaveType: "ทดสอบ",
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      totalDays: "1 วัน",
      reason: "แถวนี้เกิดจาก selfTest() ลบออกได้เลย",
      approver: "-",
      signature: "selfTest"
    });
    testId = result.id;
    console.log("✅ handleSubmit ทำงานได้ปกติ id=" + testId);
  } catch (err) {
    console.error("❌ handleSubmit ทำงานผิดพลาด: " + err.message);
    return;
  }

  try {
    const listResult = handleList({ name: "[SELFTEST] ทดสอบระบบ" });
    console.log("✅ handleList พบ " + listResult.data.length + " รายการ");
  } catch (err) {
    console.error("❌ handleList ทำงานผิดพลาด: " + err.message);
  }

  try {
    const pendingResult = handlePending({});
    const foundInPending = pendingResult.data.some(function (r) { return r.id === testId; });
    console.log(foundInPending ? "✅ handlePending เจอคำขอทดสอบในคิวรออนุมัติ" : "❌ handlePending ไม่เจอคำขอทดสอบ (ควรเจอ)");
  } catch (err) {
    console.error("❌ handlePending ทำงานผิดพลาด: " + err.message);
  }

  try {
    const detailResult = handleDetail({ id: testId });
    console.log(detailResult.status === "ok" ? "✅ handleDetail คืนค่าถูกต้อง" : "❌ handleDetail ผิดพลาด: " + detailResult.message);
  } catch (err) {
    console.error("❌ handleDetail ทำงานผิดพลาด: " + err.message);
  }

  try {
    const decideResult = handleDecide({ id: testId, decision: "approved", decidedBy: "[SELFTEST] หัวหน้า" });
    console.log(decideResult.status === "ok" ? "✅ handleDecide (approve) ทำงานได้ปกติ" : "❌ handleDecide ผิดพลาด: " + decideResult.message);

    const doubleDecide = handleDecide({ id: testId, decision: "rejected", decidedBy: "x", note: "x" });
    console.log(doubleDecide.status === "error" ? "✅ ป้องกันการตัดสินใจซ้ำได้ถูกต้อง" : "❌ ควรห้ามตัดสินใจคำขอที่ตัดสินแล้วซ้ำ");
  } catch (err) {
    console.error("❌ handleDecide ทำงานผิดพลาด: " + err.message);
  }

  try {
    const overviewResult = handleOverview({ month: "2000-01" });
    console.log("✅ handleOverview ทำงานได้ปกติ total=" + overviewResult.data.counts.total);
  } catch (err) {
    console.error("❌ handleOverview ทำงานผิดพลาด: " + err.message);
  }

  console.log("=== ตรวจสอบเสร็จสิ้น ===");
  console.log("ไปดูที่ Google Sheet จะมีแถวทดสอบขึ้นต้นด้วย [SELFTEST] — ลบแถวนั้นทิ้งได้เลยหลังตรวจสอบเสร็จ");
  console.log("หากหน้าเว็บยังใช้งานไม่ได้ทั้งที่ selfTest ผ่านหมด ปัญหาน่าจะอยู่ที่การ Deploy (ต้องกด Version: New version ทุกครั้งที่แก้โค้ด, Who has access ต้องเป็น Anyone)");
}
