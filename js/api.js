/**
 * ตัวช่วยเรียก API ของ Google Apps Script Web App (ใช้ร่วมกันทุกหน้า)
 * ต้องโหลดหลัง js/config.js เสมอ (ใช้ตัวแปร CONFIG.WEBAPP_URL)
 */
(function (global) {
  "use strict";

  function isConfigured() {
    return (
      typeof CONFIG !== "undefined" &&
      CONFIG.WEBAPP_URL &&
      CONFIG.WEBAPP_URL.indexOf("PASTE_YOUR") === -1
    );
  }

  function describeNetworkError(err) {
    if (err instanceof TypeError) {
      return (
        "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ (" + err.message + ") " +
        "สาเหตุที่พบบ่อย: ยังไม่ได้ Deploy Apps Script เวอร์ชันล่าสุด, URL ใน config.js ผิด, " +
        "หรือตั้งค่า \"Who has access\" ไม่ใช่ Anyone ตอน Deploy"
      );
    }
    return err.message;
  }

  /**
   * เรียก doGet ของ Apps Script ด้วย action + query params
   * คืนค่าเป็น { ok: true, data: ... } หรือ { ok: false, message: "..." } เสมอ (ไม่ throw)
   */
  async function apiGet(action, params) {
    if (!isConfigured()) {
      return { ok: false, message: "ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js (ดู README.md)" };
    }
    const usp = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const url = CONFIG.WEBAPP_URL + "?" + usp.toString();

    try {
      const response = await fetch(url, { method: "GET" });
      const raw = await response.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch (parseErr) {
        return {
          ok: false,
          message: "เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (มักเกิดจาก \"Who has access\" ไม่ได้ตั้งเป็น Anyone ตอน Deploy หรือยังไม่ได้ Deploy เวอร์ชันใหม่)"
        };
      }
      if (json && json.status === "ok") {
        return { ok: true, data: json.data, raw: json };
      }
      return { ok: false, message: (json && json.message) || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" };
    } catch (err) {
      return { ok: false, message: describeNetworkError(err) };
    }
  }

  /**
   * เรียก doPost ของ Apps Script ด้วย action + payload
   * ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight (Apps Script อ่านจาก e.postData.contents)
   */
  async function apiPost(action, payload) {
    if (!isConfigured()) {
      return { ok: false, message: "ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js (ดู README.md)" };
    }
    const body = Object.assign({ action: action }, payload || {});

    try {
      const response = await fetch(CONFIG.WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
      const raw = await response.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch (parseErr) {
        return {
          ok: false,
          message: "เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (มักเกิดจากสิทธิ์การ Deploy ไม่ถูกต้อง หรือยังไม่ได้ Deploy เวอร์ชันใหม่)"
        };
      }
      if (json && json.status === "ok") {
        return { ok: true, data: json, raw: json };
      }
      return { ok: false, message: (json && json.message) || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" };
    } catch (err) {
      return { ok: false, message: describeNetworkError(err) };
    }
  }

  global.LeaveAPI = { apiGet: apiGet, apiPost: apiPost, isConfigured: isConfigured };
})(window);
