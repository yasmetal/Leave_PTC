/**
 * ===========================================================================
 * ระบบใบลาออนไลน์ - Google Apps Script Backend
 * ===========================================================================
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet ใหม่ (สมุดงานเปล่า) ตั้งชื่อ เช่น "ฐานข้อมูลใบลา"
 * 2. เมนู Extensions > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งไฟล์ลงไปแทน
 * 4. กด Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. คัดลอก Web App URL ที่ได้ ไปวางใน js/config.js (ตัวแปร WEBAPP_URL)
 * รายละเอียดเพิ่มเติมดูที่ README.md
 * ===========================================================================
 */

const SHEET_NAME = "LeaveRequests";

const HEADERS = [
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

/**
 * รับข้อมูลจากฟอร์ม (POST) แล้วบันทึกลง Google Sheet
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "ไม่พบข้อมูลที่ส่งมา" });
    }

    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    sheet.appendRow([
      data.timestamp ? new Date(data.timestamp) : new Date(),
      data.fullName || "",
      data.employeeId || "",
      data.position || "",
      data.department || "",
      data.phone || "",
      data.leaveType || "",
      data.startDate || "",
      data.endDate || "",
      data.totalDays || "",
      data.reason || "",
      data.approver || "",
      data.signature || ""
    ]);

    return jsonResponse({ status: "ok", message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    // บันทึก error ไว้ใน Executions log (Apps Script > Executions) เพื่อตรวจสอบย้อนหลังได้
    console.error("doPost error: " + err.message + "\n" + err.stack);
    return jsonResponse({ status: "error", message: err.message });
  }
}

/**
 * ใช้ตรวจสอบว่า Web App ทำงานอยู่ (เปิด URL ตรงๆ ในเบราว์เซอร์เพื่อทดสอบ)
 */
function doGet(e) {
  return jsonResponse({
    status: "ok",
    message: "ระบบใบลาออนไลน์พร้อมใช้งาน (POST เท่านั้นสำหรับส่งข้อมูล)"
  });
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชันตรวจสอบตัวเอง (Self-test)
 * ใช้สำหรับ debug เมื่อสงสัยว่าระบบมีปัญหา โดยไม่ต้องผ่านหน้าเว็บ
 * วิธีใช้: เปิดไฟล์นี้ใน Apps Script editor > เลือกฟังก์ชัน "selfTest" ที่ dropdown ด้านบน > กด Run
 * แล้วดูผลลัพธ์ที่เมนู View > Logs (หรือ Ctrl+Enter)
 */
function selfTest() {
  console.log("=== เริ่มตรวจสอบระบบ ===");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log("✅ เข้าถึงสมุดงานได้: " + ss.getUrl());
  } catch (err) {
    console.error("❌ เข้าถึงสมุดงานไม่ได้: " + err.message);
    console.error("แก้ไข: สคริปต์นี้ต้อง Bound อยู่กับ Google Sheet (สร้างจากเมนู Extensions > Apps Script ในชีต)");
    return;
  }

  try {
    const sheet = getOrCreateSheet();
    console.log("✅ ชีต '" + SHEET_NAME + "' พร้อมใช้งาน จำนวนแถวปัจจุบัน: " + sheet.getLastRow());
  } catch (err) {
    console.error("❌ สร้าง/เข้าถึงชีตไม่ได้: " + err.message);
    return;
  }

  try {
    const fakeEvent = {
      postData: {
        contents: JSON.stringify({
          timestamp: new Date().toISOString(),
          fullName: "[SELFTEST] ทดสอบระบบ",
          department: "IT",
          phone: "0800000000",
          leaveType: "ทดสอบ",
          startDate: "2000-01-01",
          endDate: "2000-01-01",
          totalDays: "1 วัน",
          reason: "แถวนี้เกิดจาก selfTest() ลบออกได้เลย",
          approver: "-",
          signature: "selfTest"
        })
      }
    };
    const result = doPost(fakeEvent);
    console.log("✅ doPost ทำงานได้ปกติ ผลลัพธ์: " + result.getContent());
    console.log("ไปดูที่ Google Sheet ควรมีแถวใหม่ที่ขึ้นต้นด้วย [SELFTEST] — ลบแถวนั้นทิ้งได้เลยหลังตรวจสอบเสร็จ");
  } catch (err) {
    console.error("❌ doPost ทำงานผิดพลาด: " + err.message);
    return;
  }

  console.log("=== ตรวจสอบเสร็จสิ้น: ระบบฝั่ง Apps Script ทำงานปกติดี ===");
  console.log("หากหน้าเว็บยังส่งข้อมูลไม่ได้ ปัญหาน่าจะอยู่ที่การ Deploy (Who has access ต้องเป็น Anyone) ไม่ใช่โค้ด");
}
