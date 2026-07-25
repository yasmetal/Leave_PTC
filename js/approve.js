(function () {
  "use strict";

  var loadingState = document.getElementById("loadingState");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var retryBtn = document.getElementById("retryBtn");
  var pendingArea = document.getElementById("pendingArea");
  var pendingList = document.getElementById("pendingList");
  var emptyPending = document.getElementById("emptyPending");
  var recentCard = document.getElementById("recentCard");
  var recentBody = document.getElementById("recentBody");

  var approverIdentityLine = document.getElementById("approverIdentityLine");
  var changeApproverBtn = document.getElementById("changeApproverBtn");
  var approverNameInput = document.getElementById("approverNameInput");
  var saveApproverBtn = document.getElementById("saveApproverBtn");

  var decideMessage = document.getElementById("decideMessage");
  var decideNoteField = document.getElementById("decideNoteField");
  var decideNote = document.getElementById("decideNote");
  var decideNoteError = document.getElementById("decideNoteError");
  var confirmDecideBtn = document.getElementById("confirmDecideBtn");

  var pendingCache = [];
  var activeDecision = null; // { id, decision, fullName }

  function leaveIconFor(type) {
    if (!type) return "📄";
    if (type.indexOf("ป่วย") !== -1) return "🤒";
    if (type.indexOf("กิจ") !== -1) return "🏠";
    if (type.indexOf("พักร้อน") !== -1) return "🏖️";
    if (type.indexOf("คลอด") !== -1) return "👶";
    if (type.indexOf("บวช") !== -1) return "🙏";
    return "📄";
  }

  function initials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    return (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
  }

  // ---------------- Approver identity ----------------
  function refreshApproverLine() {
    var identity = LeaveCommon.getApproverIdentity();
    if (identity && identity.name) {
      approverIdentityLine.textContent = "กำลังพิจารณาในนาม: " + identity.name;
      changeApproverBtn.textContent = "เปลี่ยนชื่อผู้อนุมัติ";
    } else {
      approverIdentityLine.textContent = "ยังไม่ได้ตั้งชื่อผู้อนุมัติ — ระบบต้องใช้ชื่อนี้บันทึกว่าใครเป็นผู้ตัดสินใจ";
      changeApproverBtn.textContent = "ตั้งค่าชื่อผู้อนุมัติ";
    }
  }

  function openApproverModal() {
    var identity = LeaveCommon.getApproverIdentity();
    approverNameInput.value = (identity && identity.name) || "";
    LeaveCommon.openModal("approverModal");
    approverNameInput.focus();
  }

  changeApproverBtn.addEventListener("click", openApproverModal);

  saveApproverBtn.addEventListener("click", function () {
    var name = approverNameInput.value.trim();
    if (!name) { approverNameInput.focus(); return; }
    LeaveCommon.setApproverIdentity({ name: name });
    refreshApproverLine();
    LeaveCommon.closeModal("approverModal");
  });

  // ---------------- Render pending queue ----------------
  function renderPending(data) {
    pendingCache = data;
    pendingList.innerHTML = "";

    if (data.length === 0) {
      emptyPending.hidden = false;
      pendingList.hidden = true;
      return;
    }
    emptyPending.hidden = true;
    pendingList.hidden = false;

    data.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "12px";
      card.setAttribute("data-id", item.id);

      card.innerHTML =
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div style="display:flex;gap:12px;">' +
            '<span class="avatar" aria-hidden="true" style="width:42px;height:42px;font-size:0.85rem;">' + LeaveCommon.escapeHtml(initials(item.fullName)) + '</span>' +
            '<div>' +
              '<div style="font-weight:700;">' + LeaveCommon.escapeHtml(item.fullName) + ' <span class="text-muted" style="font-weight:400;font-size:0.82rem;">· ' + LeaveCommon.escapeHtml(item.department || "-") + '</span></div>' +
              '<div style="font-size:0.9rem;margin-top:2px;">' + leaveIconFor(item.leaveType) + ' ' + LeaveCommon.escapeHtml(item.leaveType || "-") + ' · ' + LeaveCommon.escapeHtml(LeaveCommon.formatDateRange(item.startDate, item.endDate)) + ' (' + LeaveCommon.escapeHtml(item.totalDays || "-") + ')</div>' +
              '<div class="text-muted" style="font-size:0.82rem;margin-top:4px;">' + LeaveCommon.escapeHtml(item.reason || "-") + '</div>' +
            '</div>' +
          '</div>' +
          LeaveCommon.statusBadgeHtml(item.status) +
        '</div>' +
        '<div class="btn-row">' +
          '<a href="request-detail.html?id=' + encodeURIComponent(item.id) + '" class="btn btn-secondary btn-sm">ดูรายละเอียด</a>' +
          '<button type="button" class="btn btn-danger btn-sm" data-action="rejected">ไม่อนุมัติ</button>' +
          '<button type="button" class="btn btn-success btn-sm" data-action="approved">อนุมัติ</button>' +
        '</div>';

      card.querySelector('[data-action="rejected"]').addEventListener("click", function () {
        openDecideModal(item, "rejected");
      });
      card.querySelector('[data-action="approved"]').addEventListener("click", function () {
        openDecideModal(item, "approved");
      });

      pendingList.appendChild(card);
    });
  }

  function openDecideModal(item, decision) {
    var identity = LeaveCommon.getApproverIdentity();
    if (!identity || !identity.name) {
      openApproverModal();
      LeaveCommon.showToast("กรุณาตั้งชื่อผู้อนุมัติก่อน");
      return;
    }

    activeDecision = { id: item.id, decision: decision, fullName: item.fullName };
    document.getElementById("decideTitle").textContent =
      decision === "approved" ? "อนุมัติคำขอนี้?" : "ไม่อนุมัติคำขอนี้";
    decideMessage.textContent =
      (decision === "approved" ? "ยืนยันการอนุมัติคำขอลาของ " : "โปรดระบุเหตุผลเพื่อแจ้งให้ ") +
      item.fullName +
      (decision === "approved" ? "" : " ทราบ");
    decideNoteField.hidden = decision !== "rejected";
    decideNote.value = "";
    decideNoteField.classList.remove("has-error");
    confirmDecideBtn.className = "btn " + (decision === "approved" ? "btn-primary" : "btn-danger");
    confirmDecideBtn.textContent = decision === "approved" ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ";

    LeaveCommon.openModal("decideModal");
  }

  confirmDecideBtn.addEventListener("click", async function () {
    if (!activeDecision) return;

    if (activeDecision.decision === "rejected" && !decideNote.value.trim()) {
      decideNoteField.classList.add("has-error");
      decideNote.focus();
      return;
    }

    var identity = LeaveCommon.getApproverIdentity();
    confirmDecideBtn.disabled = true;
    confirmDecideBtn.textContent = "กำลังบันทึก...";

    var result = await LeaveAPI.apiPost("decide", {
      id: activeDecision.id,
      decision: activeDecision.decision,
      decidedBy: identity.name,
      note: decideNote.value.trim()
    });

    confirmDecideBtn.disabled = false;
    confirmDecideBtn.textContent = activeDecision.decision === "approved" ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ";
    LeaveCommon.closeModal("decideModal");

    if (!result.ok) {
      LeaveCommon.showToast("บันทึกไม่สำเร็จ: " + result.message);
      return;
    }

    LeaveCommon.showToast(
      (activeDecision.decision === "approved" ? "อนุมัติคำขอของ " : "ไม่อนุมัติคำขอของ ") + activeDecision.fullName + " แล้ว"
    );
    activeDecision = null;
    loadAll();
  });

  // ---------------- Recent decisions ----------------
  function renderRecent(recent) {
    var decided = recent.filter(function (r) { return r.status !== "รออนุมัติ"; }).slice(0, 5);
    if (decided.length === 0) {
      recentCard.hidden = true;
      return;
    }
    recentCard.hidden = false;
    recentBody.innerHTML = "";
    decided.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + LeaveCommon.escapeHtml(r.fullName) + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(r.leaveType || "-") + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(LeaveCommon.formatDateRange(r.startDate, r.endDate)) + "</td>" +
        "<td>" + LeaveCommon.statusBadgeHtml(r.status) + "</td>";
      recentBody.appendChild(tr);
    });
  }

  function showOnly(el) {
    [pendingArea, loadingState, errorState].forEach(function (e) {
      if (e) e.hidden = e !== el;
    });
  }

  async function loadAll() {
    showOnly(loadingState);
    var pendingResult = await LeaveAPI.apiGet("pending");
    if (!pendingResult.ok) {
      errorText.textContent = pendingResult.message;
      showOnly(errorState);
      return;
    }
    renderPending(pendingResult.data || []);
    showOnly(pendingArea);

    var overviewResult = await LeaveAPI.apiGet("overview");
    if (overviewResult.ok && overviewResult.data && overviewResult.data.recent) {
      renderRecent(overviewResult.data.recent);
    }
  }

  retryBtn.addEventListener("click", loadAll);

  refreshApproverLine();
  loadAll();
})();
