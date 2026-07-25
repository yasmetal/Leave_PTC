/**
 * ตัวช่วยที่ใช้ร่วมกันทุกหน้า: toast, modal, การจำตัวตนแบบเบา ๆ (ไม่มีระบบล็อกอินจริง),
 * และตัวช่วยแสดงผลสถานะ/วันที่
 */
(function (global) {
  "use strict";

  // ---------------- Toast ----------------
  function showToast(message) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  // ---------------- Modal ----------------
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) m.hidden = false;
  }
  function closeModal(id) {
    var m = document.getElementById(id);
    if (m) m.hidden = true;
  }
  document.addEventListener("click", function (e) {
    var overlay = e.target.closest ? e.target.closest(".modal-overlay") : null;
    if (overlay && e.target === overlay) overlay.hidden = true;
  });

  // ---------------- ระบบจำตัวตนแบบเบา (เก็บใน localStorage เครื่องนี้เท่านั้น) ----------------
  // หมายเหตุ: ระบบนี้ "ไม่ใช่" ระบบล็อกอิน/ยืนยันตัวตนจริง — ใครก็พิมพ์ชื่อได้
  // ใช้เพื่อความสะดวกในการกรองข้อมูล "ของฉัน" เท่านั้น
  var IDENTITY_KEY = "ptc_leave_identity_v1";
  var APPROVER_KEY = "ptc_leave_approver_identity_v1";

  function getIdentity() {
    try {
      var raw = localStorage.getItem(IDENTITY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setIdentity(obj) {
    try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function clearIdentity() {
    try { localStorage.removeItem(IDENTITY_KEY); } catch (e) {}
  }

  function getApproverIdentity() {
    try {
      var raw = localStorage.getItem(APPROVER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setApproverIdentity(obj) {
    try { localStorage.setItem(APPROVER_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function clearApproverIdentity() {
    try { localStorage.removeItem(APPROVER_KEY); } catch (e) {}
  }

  // ---------------- แสดงผลสถานะ ----------------
  var STATUS_BADGE_CLASS = {
    "รออนุมัติ": "badge-pending",
    "อนุมัติแล้ว": "badge-approved",
    "ไม่อนุมัติ": "badge-rejected",
    "ยกเลิกแล้ว": "badge-cancelled"
  };

  function statusBadgeHtml(status) {
    var cls = STATUS_BADGE_CLASS[status] || "badge-pending";
    var label = status || "รออนุมัติ";
    return '<span class="badge ' + cls + '">' + escapeHtml(label) + "</span>";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDateShort(isoOrYmd) {
    if (!isoOrYmd) return "";
    var d = new Date(isoOrYmd);
    if (isNaN(d.getTime())) return String(isoOrYmd);
    var months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    var buddhistYear = d.getFullYear() + 543;
    return d.getDate() + " " + months[d.getMonth()] + " " + buddhistYear;
  }

  function formatDateRange(startYmd, endYmd) {
    if (!startYmd) return "";
    if (!endYmd || endYmd === startYmd) return formatDateShort(startYmd);
    return formatDateShort(startYmd) + " – " + formatDateShort(endYmd);
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return formatDateShort(iso) + " เวลา " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  global.LeaveCommon = {
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    getIdentity: getIdentity,
    setIdentity: setIdentity,
    clearIdentity: clearIdentity,
    getApproverIdentity: getApproverIdentity,
    setApproverIdentity: setApproverIdentity,
    clearApproverIdentity: clearApproverIdentity,
    statusBadgeHtml: statusBadgeHtml,
    escapeHtml: escapeHtml,
    formatDateShort: formatDateShort,
    formatDateRange: formatDateRange,
    formatDateTime: formatDateTime
  };

  // เผื่อไฟล์เก่ายังเรียกฟังก์ชันตรง ๆ แบบ global (backward compat กับ onclick="openModal(...)")
  global.showToast = showToast;
  global.openModal = openModal;
  global.closeModal = closeModal;
})(window);
