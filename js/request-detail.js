(function () {
  "use strict";

  var loadingState = document.getElementById("loadingState");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var detailArea = document.getElementById("detailArea");
  var cancelRow = document.getElementById("cancelRow");
  var cancelBtn = document.getElementById("cancelBtn");
  var confirmCancelBtn = document.getElementById("confirmCancelBtn");
  var cancelMessage = document.getElementById("cancelMessage");

  function getIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function showOnly(el) {
    [detailArea, loadingState, errorState].forEach(function (e) {
      if (e) e.hidden = e !== el;
    });
  }

  function leaveIconFor(type) {
    if (!type) return "📄";
    if (type.indexOf("ป่วย") !== -1) return "🤒";
    if (type.indexOf("กิจ") !== -1) return "🏠";
    if (type.indexOf("พักร้อน") !== -1) return "🏖️";
    if (type.indexOf("คลอด") !== -1) return "👶";
    if (type.indexOf("บวช") !== -1) return "🙏";
    return "📄";
  }

  function buildTimeline(item) {
    var steps = [];
    steps.push({
      cls: "done",
      title: "ยื่นคำขอลา",
      meta: LeaveCommon.escapeHtml(item.fullName) + " · " + LeaveCommon.formatDateTime(item.submittedAt)
    });

    if (item.status === "รออนุมัติ") {
      steps.push({
        cls: "current",
        title: "รอการอนุมัติจากหัวหน้างาน",
        meta: LeaveCommon.escapeHtml(item.approver || "หัวหน้างาน") + " · คาดว่าจะตอบกลับภายใน 1–2 วันทำการ"
      });
      steps.push({ cls: "", title: "บันทึกลงระบบวันลา", meta: "จะดำเนินการหลังอนุมัติ", muted: true });
    } else if (item.status === "อนุมัติแล้ว") {
      steps.push({
        cls: "done",
        title: "อนุมัติโดย " + LeaveCommon.escapeHtml(item.decidedBy || "-"),
        meta: LeaveCommon.formatDateTime(item.decidedAt)
      });
      steps.push({ cls: "done", title: "บันทึกลงระบบวันลาเรียบร้อย", meta: "" });
    } else if (item.status === "ไม่อนุมัติ") {
      steps.push({
        cls: "rejected",
        title: "ไม่อนุมัติโดย " + LeaveCommon.escapeHtml(item.decidedBy || "-"),
        meta: LeaveCommon.formatDateTime(item.decidedAt) + (item.decisionNote ? " · เหตุผล: " + LeaveCommon.escapeHtml(item.decisionNote) : "")
      });
    } else if (item.status === "ยกเลิกแล้ว") {
      steps.push({
        cls: "rejected",
        title: "ยกเลิกคำขอ",
        meta: LeaveCommon.formatDateTime(item.decidedAt) + (item.decisionNote ? " · " + LeaveCommon.escapeHtml(item.decisionNote) : "")
      });
    }

    var timeline = document.getElementById("timeline");
    timeline.innerHTML = "";
    steps.forEach(function (step) {
      var li = document.createElement("li");
      li.className = step.cls || "";
      li.innerHTML =
        '<span class="dot" aria-hidden="true"></span>' +
        '<div class="tl-title"' + (step.muted ? ' style="color:var(--muted);"' : "") + ">" + step.title + "</div>" +
        '<div class="tl-meta">' + step.meta + "</div>";
      timeline.appendChild(li);
    });
  }

  function render(item) {
    document.title = (item.leaveType || "รายละเอียด") + " | Phattha Packdee";
    document.getElementById("leaveTypeTitle").textContent = leaveIconFor(item.leaveType) + " " + (item.leaveType || "-");
    document.getElementById("metaLine").textContent =
      "ยื่นเมื่อ " + LeaveCommon.formatDateShort(item.submittedAt) + " · รหัสคำขอ " + item.id;
    document.getElementById("statusBadgeHolder").innerHTML = LeaveCommon.statusBadgeHtml(item.status);

    document.getElementById("dFullName").textContent = item.fullName + (item.employeeId ? " (" + item.employeeId + ")" : "");
    document.getElementById("dDepartment").textContent = item.department || "-";
    document.getElementById("dDateRange").textContent = LeaveCommon.formatDateRange(item.startDate, item.endDate);
    document.getElementById("dTotalDays").textContent = item.totalDays || "-";
    document.getElementById("dPhone").textContent = item.phone || "-";
    document.getElementById("dApprover").textContent = item.approver || "-";
    document.getElementById("dReason").textContent = item.reason || "-";

    buildTimeline(item);

    cancelRow.hidden = item.status !== "รออนุมัติ";
    cancelMessage.textContent =
      "คำขอลาวันที่ " + LeaveCommon.formatDateRange(item.startDate, item.endDate) +
      " จะถูกยกเลิก และหัวหน้างานจะได้รับแจ้งเตือน การกระทำนี้ไม่สามารถย้อนกลับได้";

    showOnly(detailArea);
  }

  var currentItem = null;

  async function load() {
    var id = getIdFromUrl();
    if (!id) {
      errorText.textContent = "ไม่พบรหัสคำขอในลิงก์นี้ กรุณากลับไปหน้าสถานะใบลาแล้วเลือกรายการใหม่";
      showOnly(errorState);
      return;
    }
    showOnly(loadingState);
    var result = await LeaveAPI.apiGet("detail", { id: id });
    if (!result.ok) {
      errorText.textContent = result.message;
      showOnly(errorState);
      return;
    }
    currentItem = result.data;
    render(currentItem);
  }

  cancelBtn.addEventListener("click", function () {
    LeaveCommon.openModal("cancelModal");
  });

  confirmCancelBtn.addEventListener("click", async function () {
    if (!currentItem) return;
    confirmCancelBtn.disabled = true;
    confirmCancelBtn.textContent = "กำลังยกเลิก...";
    var identity = LeaveCommon.getIdentity();
    var result = await LeaveAPI.apiPost("cancel", {
      id: currentItem.id,
      cancelledBy: (identity && identity.fullName) || currentItem.fullName
    });
    confirmCancelBtn.disabled = false;
    confirmCancelBtn.textContent = "ยืนยันยกเลิก";
    LeaveCommon.closeModal("cancelModal");

    if (!result.ok) {
      LeaveCommon.showToast("ยกเลิกไม่สำเร็จ: " + result.message);
      return;
    }
    LeaveCommon.showToast("ยกเลิกคำขอลาแล้ว");
    load();
  });

  load();
})();
