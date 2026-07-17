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

  let lastCheckOk = false;
  let lastFocusedEl = null;

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

  function isConfigured() {
    return (
      typeof CONFIG !== "undefined" &&
      CONFIG.WEBAPP_URL &&
      CONFIG.WEBAPP_URL.indexOf("PASTE_YOUR") === -1
    );
  }

  // =====================================================================
  // Popup แจ้งผลการส่งใบลา
  // เรียกทุกครั้งที่กด "ส่งใบลา" ไม่ว่าผลจะสำเร็จหรือไม่ (ห้ามเงียบ)
  // แสดงรายการขั้นตอนทั้งหมด พร้อมไอคอนบอกว่าติดอยู่ที่ขั้นตอนไหน
  //   ✅ ผ่าน   ❌ ติดตรงนี้ (สาเหตุที่ส่งไม่สำเร็จ)   ⏳ ยังไม่ถึงขั้นตอนนี้
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
  // เรียกอัตโนมัติตอนโหลดหน้า และเมื่อกดปุ่ม "ทดสอบการเชื่อมต่ออีกครั้ง"
  // =====================================================================
  async function checkConnection() {
    if (!isConfigured()) {
      lastCheckOk = false;
      setConnStatus(
        "⚠️ ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js (ดู README.md)",
        "error"
      );
      return;
    }

    setConnStatus("🔄 กำลังตรวจสอบการเชื่อมต่อ...", "checking");

    try {
      const response = await fetch(CONFIG.WEBAPP_URL, { method: "GET" });
      const raw = await response.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        lastCheckOk = false;
        setConnStatus(
          "🔴 เชื่อมต่อไม่ได้: Apps Script ตอบกลับเป็นหน้าเว็บ ไม่ใช่ JSON (มักเกิดจาก \"Who has access\" ไม่ได้ตั้งเป็น Anyone ตอน Deploy)",
          "error"
        );
        return;
      }

      if (data && data.status === "ok") {
        lastCheckOk = true;
        setConnStatus("🟢 เชื่อมต่อสำเร็จ ระบบพร้อมรับข้อมูล", "ok");
      } else {
        lastCheckOk = false;
        setConnStatus(
          "🔴 Apps Script ตอบกลับผิดปกติ: " + (data && data.message ? data.message : "ไม่ทราบสาเหตุ"),
          "error"
        );
      }
    } catch (err) {
      lastCheckOk = false;
      setConnStatus(
        "🔴 เชื่อมต่อไม่ได้ (" + err.message + ") ตรวจสอบ URL ใน config.js และสถานะการ Deploy",
        "error"
      );
    }
  }

  if (recheckBtn) {
    recheckBtn.addEventListener("click", checkConnection);
  }

  checkConnection();

  function describeSubmitError(err) {
    if (err instanceof TypeError) {
      return (
        "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ (" + err.message + ") " +
        "สาเหตุที่พบบ่อย: ยังไม่ได้ Deploy Apps Script, URL ใน config.js ผิด, " +
        "หรือตั้งค่า \"Who has access\" ไม่ใช่ Anyone ตอน Deploy"
      );
    }
    return err.message;
  }

  // =====================================================================
  // ส่งฟอร์ม — ติดตามทีละขั้นตอน แล้วแสดง popup แจ้งผลเสมอ (ไม่เงียบ)
  // ขั้นตอนที่ติดตาม:
  //   1) ตรวจสอบข้อมูลในฟอร์ม
  //   2) เชื่อมต่อกับเซิร์ฟเวอร์ (Google Apps Script)
  //   3) เซิร์ฟเวอร์บันทึกข้อมูลลง Google Sheet
  // =====================================================================
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const steps = [
      { label: "ตรวจสอบข้อมูลในฟอร์ม", status: "pending" },
      { label: "เชื่อมต่อกับเซิร์ฟเวอร์ (Google Apps Script)", status: "pending" },
      { label: "เซิร์ฟเวอร์บันทึกข้อมูลลง Google Sheet", status: "pending" }
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

    // ---- ขั้นตอนที่ 2: ตรวจสอบว่าตั้งค่าเชื่อมต่อไว้หรือยัง ----
    if (!isConfigured()) {
      steps[1].status = "fail";
      showResultModal({
        success: false,
        title: "ยังไม่ได้ตั้งค่าระบบ",
        message: "ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js กรุณา deploy Google Apps Script ก่อน (ดู README.md)",
        steps: steps
      });
      setStatus(
        "ยังไม่ได้ตั้งค่า WEBAPP_URL ใน js/config.js กรุณา deploy Google Apps Script ก่อน (ดู README.md)",
        "error"
      );
      return;
    }

    submitBtn.disabled = true;
    setStatus("กำลังส่งข้อมูล...", "loading");

    const payload = {
      timestamp: new Date().toISOString(),
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

    try {
      // ใช้ Content-Type: text/plain เพื่อหลีกเลี่ยงปัญหา CORS preflight
      // กับ Google Apps Script Web App (ฝั่ง Apps Script จะอ่านค่าจาก e.postData.contents)
      const response = await fetch(CONFIG.WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      // ได้รับการตอบกลับจากเซิร์ฟเวอร์แล้ว = ขั้นตอนที่ 2 ผ่าน
      steps[1].status = "ok";

      const raw = await response.text();
      let result;
      try {
        result = JSON.parse(raw);
      } catch (parseErr) {
        steps[2].status = "fail";
        throw new Error(
          "เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (มักเกิดจากสิทธิ์การ Deploy ไม่ถูกต้อง เช่น \"Who has access\" ไม่ใช่ Anyone)"
        );
      }

      if (result && result.status === "error") {
        steps[2].status = "fail";
        throw new Error(result.message || "เกิดข้อผิดพลาดที่ฝั่งเซิร์ฟเวอร์ (Apps Script)");
      }

      steps[2].status = "ok";

      setStatus("✅ ส่งใบลาสำเร็จแล้ว ระบบได้บันทึกข้อมูลของท่านเรียบร้อย", "success");
      showResultModal({
        success: true,
        title: "ส่งใบลาสำเร็จ",
        message: "ระบบบันทึกข้อมูลของท่านลง Google Sheet เรียบร้อยแล้ว",
        steps: steps
      });

      form.reset();
      totalDaysEl.value = "";
      lastCheckOk = true;
      setConnStatus("🟢 เชื่อมต่อสำเร็จ ระบบพร้อมรับข้อมูล", "ok");
    } catch (err) {
      console.error(err);

      // fetch เองล้มเหลว (เช่น "Failed to fetch") แปลว่าไม่ถึงเซิร์ฟเวอร์เลย -> ขั้นตอน 2 คือจุดที่ติด
      if (steps[1].status === "pending") {
        steps[1].status = "fail";
      }

      const message = describeSubmitError(err);
      setStatus("❌ ส่งข้อมูลไม่สำเร็จ: " + message, "error");
      showResultModal({
        success: false,
        title: "ส่งใบลาไม่สำเร็จ",
        message: message,
        steps: steps
      });

      // ส่งไม่สำเร็จ -> ตรวจสอบการเชื่อมต่อซ้ำอัตโนมัติ เพื่อช่วยวินิจฉัยสาเหตุ
      checkConnection();
    } finally {
      submitBtn.disabled = false;
    }
  });

  form.addEventListener("reset", function () {
    setTimeout(() => {
      totalDaysEl.value = "";
      setStatus("", "");
    }, 0);
  });
})();
