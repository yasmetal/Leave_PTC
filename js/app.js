(function () {
  "use strict";

  const form = document.getElementById("leaveForm");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const totalDaysEl = document.getElementById("totalDays");
  const submitBtn = document.getElementById("submitBtn");
  const statusMsg = document.getElementById("statusMsg");
  const connStatus = document.getElementById("connStatus");
  const recheckBtn = document.getElementById("recheckBtn");

  // ---- องค์ประกอบของ popup แจ้งผลการส่ง ----
  const resultModal = document.getElementById("resultModal");
  const modalIcon = document.getElementById("modalIcon");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const modalSteps = document.getElementById("modalSteps");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalActions = document.getElementById("modalActions");

  let lastFocusedEl = null;

  // ---- จำข้อมูลผู้ใช้ครั้งก่อน (ถ้ามี) เพื่อความสะดวก ไม่ใช่การล็อกอิน ----
  (function prefillFromIdentity() {
    const identity = window.LeaveCommon && LeaveCommon.getIdentity();
    if (!identity) return;
    const fullNameEl = document.getElementById("fullName");
    const employeeIdEl = document.getElementById("employeeId");
    if (fullNameEl && !fullNameEl.value) fullNameEl.value = identity.fullName || "";
    if (employeeIdEl && !employeeIdEl.value) employeeIdEl.value = identity.employeeId || "";
  })();

  // ---- คำนวณจำนวนวันลาอัตโนมัติ ----
  function calcDays() {
    const start = startDateEl.value;
    const end = endDateEl.value;
    if (!start || !end) {
      totalDaysEl.value = "";
      return;
    }
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    const diffMs = endDate - startDate;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays < 1) {
      totalDaysEl.value = "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา";
      totalDaysEl.style.color = "#dc2626";
    } else {
      totalDaysEl.value = diffDays + " วัน";
      totalDaysEl.style.color = "";
    }
  }

  startDateEl.addEventListener("change", calcDays);
  endDateEl.addEventListener("change", calcDays);

  function setStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = "status-msg" + (type ? " " + type : "");
  }

  function setConnStatus(text, type) {
    if (!connStatus) return;
    connStatus.textContent = text;
    connStatus.className = "conn-status " + type;
  }

  // =====================================================================
  // Popup แจ้งผลการส่งใบลา
  // =====================================================================
  function renderSteps(steps) {
    modalSteps.innerHTML = "";
    steps.forEach(function (step) {
      const li = document.createElement("li");
      let icon = "⏳";
      let cls = "step-pending";
      if (step.status === "ok") {
        icon = "✅";
        cls = "step-ok";
      } else if (step.status === "fail") {
        icon = "❌";
        cls = "step-fail";
      }
      li.className = cls;
      li.innerHTML =
        '<span class="step-icon">' + icon + "</span><span>" + step.label + "</span>";
      modalSteps.appendChild(li);
    });
  }

  function showResultModal(opts) {
    modalIcon.textContent = opts.success ? "✅" : "❌";
    modalTitle.textContent = opts.title;
    modalMessage.textContent = opts.message;
    renderSteps(opts.steps || []);

    if (modalActions) {
      modalActions.innerHTML = "";
      if (opts.success) {
        const link = document.createElement("a");
        link.href = "my-requests.html";
        link.className = "btn btn-secondary";
        link.textContent = "ดูสถานะใบลา";
        modalActions.appendChild(link);
      }
    }

    lastFocusedEl = document.activeElement;
    resultModal.hidden = false;
    document.body.style.overflow = "hidden";
    modalCloseBtn.focus();
  }

  function closeResultModal() {
    resultModal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  modalCloseBtn.addEventListener("click", closeResultModal);
  resultModal.addEventListener("click", function (e) {
    if (e.target === resultModal) closeResultModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !resultModal.hidden) closeResultModal();
  });

  // =====================================================================
  // ตรวจสอบการเชื่อมต่อกับ Google Apps Script Web App
  // =====================================================================
  async function checkConnection() {
    if (!window.LeaveAPI || !LeaveAPI.isConfigured()) {
      setConnStatus("⚠️ ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js (ดู README.md)", "error");
      return;
    }

    setConnStatus("🔄 กำลังตรวจสอบการเชื่อมต่อ...", "checking");

    const result = await LeaveAPI.apiGet("health");
    if (result.ok) {
      setConnStatus("🟢 เชื่อมต่อสำเร็จ ระบบพร้อมรับข้อมูล", "ok");
    } else {
      setConnStatus("🔴 " + result.message, "error");
    }
  }

  if (recheckBtn) {
    recheckBtn.addEventListener("click", checkConnection);
  }

  checkConnection();

  // =====================================================================
  // ส่งฟอร์ม — ติดตามทีละขั้นตอน แล้วแสดง popup แจ้งผลเสมอ (ไม่เงียบ)
  // =====================================================================
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const steps = [
      { label: "ตรวจสอบข้อมูลในฟอร์ม", status: "pending" },
      { label: "ส่งข้อมูลไปเซิร์ฟเวอร์และบันทึกลง Google Sheet", status: "pending" }
    ];

    // ---- ขั้นตอนที่ 1: ตรวจสอบข้อมูล ----
    if (!form.checkValidity()) {
      form.reportValidity();
      steps[0].status = "fail";
      showResultModal({
        success: false,
        title: "กรอกข้อมูลไม่ครบ",
        message: "กรุณากรอกข้อมูลในช่องที่มีเครื่องหมาย * ให้ครบถ้วนก่อนส่งใบลา",
        steps: steps
      });
      return;
    }

    const start = startDateEl.value;
    const end = endDateEl.value;
    if (new Date(end) < new Date(start)) {
      steps[0].status = "fail";
      showResultModal({
        success: false,
        title: "วันที่ไม่ถูกต้อง",
        message: "วันที่สิ้นสุดการลาต้องไม่ก่อนวันที่เริ่มลา กรุณาแก้ไขแล้วลองใหม่",
        steps: steps
      });
      return;
    }
    steps[0].status = "ok";

    if (!window.LeaveAPI || !LeaveAPI.isConfigured()) {
      steps[1].status = "fail";
      showResultModal({
        success: false,
        title: "ยังไม่ได้ตั้งค่าระบบ",
        message: "ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js กรุณา deploy Google Apps Script ก่อน (ดู README.md)",
        steps: steps
      });
      return;
    }

    submitBtn.disabled = true;
    setStatus("กำลังส่งข้อมูล...", "loading");

    const payload = {
      fullName: document.getElementById("fullName").value.trim(),
      employeeId: document.getElementById("employeeId").value.trim(),
      position: document.getElementById("position").value.trim(),
      department: document.getElementById("department").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      leaveType: document.getElementById("leaveType").value,
      startDate: start,
      endDate: end,
      totalDays: totalDaysEl.value,
      reason: document.getElementById("reason").value.trim(),
      approver: document.getElementById("approver").value.trim(),
      signature: document.getElementById("signature").value.trim()
    };

    const result = await LeaveAPI.apiPost("submit", payload);
    submitBtn.disabled = false;

    if (!result.ok) {
      steps[1].status = "fail";
      setStatus("❌ ส่งข้อมูลไม่สำเร็จ: " + result.message, "error");
      showResultModal({
        success: false,
        title: "ส่งใบลาไม่สำเร็จ",
        message: result.message,
        steps: steps
      });
      checkConnection();
      return;
    }

    steps[1].status = "ok";
    setStatus("✅ ส่งใบลาสำเร็จแล้ว ระบบได้บันทึกข้อมูลของท่านเรียบร้อย", "success");
    showResultModal({
      success: true,
      title: "ส่งใบลาสำเร็จ",
      message: "ระบบบันทึกข้อมูลของท่านลง Google Sheet เรียบร้อยแล้ว รหัสคำขอ: " + (result.data && result.data.id ? result.data.id : "-"),
      steps: steps
    });

    // จำชื่อ-รหัสพนักงานไว้ในเครื่องนี้ (ไม่ใช่การล็อกอิน) เพื่อให้หน้า "สถานะของฉัน" ใช้ค้นหาให้อัตโนมัติ
    if (window.LeaveCommon) {
      LeaveCommon.setIdentity({ fullName: payload.fullName, employeeId: payload.employeeId });
    }

    form.reset();
    totalDaysEl.value = "";
    setConnStatus("🟢 เชื่อมต่อสำเร็จ ระบบพร้อมรับข้อมูล", "ok");

    // เติมชื่อ-รหัสพนักงานกลับเข้าไปหลังเคลียร์ฟอร์ม เพื่อความสะดวกถ้าต้องยื่นซ้ำ
    const fullNameEl = document.getElementById("fullName");
    const employeeIdEl = document.getElementById("employeeId");
    if (fullNameEl) fullNameEl.value = payload.fullName;
    if (employeeIdEl) employeeIdEl.value = payload.employeeId;
  });

  form.addEventListener("reset", function () {
    setTimeout(() => {
      totalDaysEl.value = "";
      setStatus("", "");
    }, 0);
  });
})();
