(function () {
  "use strict";

  var lookupCard = document.getElementById("lookupCard");
  var lookupForm = document.getElementById("lookupForm");
  var lookupNameInput = document.getElementById("lookupName");
  var dataArea = document.getElementById("dataArea");
  var lookupNameLabel = document.getElementById("lookupNameLabel");
  var changeIdentityBtn = document.getElementById("changeIdentityBtn");
  var requestList = document.getElementById("requestList");
  var emptyState = document.getElementById("emptyState");
  var emptyTitle = document.getElementById("emptyTitle");
  var emptyText = document.getElementById("emptyText");
  var loadingState = document.getElementById("loadingState");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var retryBtn = document.getElementById("retryBtn");
  var chips = document.querySelectorAll(".chip");

  var currentData = [];
  var currentName = "";

  function showOnly(el) {
    [lookupCard, dataArea, loadingState, errorState].forEach(function (e) {
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

  function renderCard(item) {
    var a = document.createElement("a");
    a.className = "request-card";
    a.setAttribute("data-status", item.status || "รออนุมัติ");
    a.href = "request-detail.html?id=" + encodeURIComponent(item.id);

    var metaExtra = "";
    if (item.status === "รออนุมัติ") {
      metaExtra = "ยื่นเมื่อ " + LeaveCommon.formatDateShort(item.submittedAt) + " · รออนุมัติจาก" + LeaveCommon.escapeHtml(item.approver || "หัวหน้างาน");
    } else if (item.status === "อนุมัติแล้ว") {
      metaExtra = "อนุมัติโดย" + LeaveCommon.escapeHtml(item.decidedBy || "-") + " · " + LeaveCommon.formatDateShort(item.decidedAt);
    } else if (item.status === "ไม่อนุมัติ") {
      metaExtra = "ไม่อนุมัติโดย" + LeaveCommon.escapeHtml(item.decidedBy || "-") + (item.decisionNote ? " · " + LeaveCommon.escapeHtml(item.decisionNote) : "");
    } else if (item.status === "ยกเลิกแล้ว") {
      metaExtra = "ยกเลิกแล้ว";
    }

    a.innerHTML =
      '<div class="request-card-top">' +
        '<span class="request-card-type">' + leaveIconFor(item.leaveType) + " " + LeaveCommon.escapeHtml(item.leaveType || "-") + "</span>" +
        LeaveCommon.statusBadgeHtml(item.status) +
      "</div>" +
      '<div class="request-card-meta">' +
        "<span>" + LeaveCommon.escapeHtml(LeaveCommon.formatDateRange(item.startDate, item.endDate)) + "</span>" +
        "<span>· " + LeaveCommon.escapeHtml(item.totalDays || "-") + "</span>" +
      "</div>" +
      '<div class="request-card-name">' + metaExtra + "</div>";

    return a;
  }

  function renderList(data) {
    currentData = data;
    requestList.innerHTML = "";
    data.forEach(function (item) {
      requestList.appendChild(renderCard(item));
    });
    applyFilter(getActiveFilter());
  }

  function getActiveFilter() {
    var active = document.querySelector(".chip.active");
    return active ? active.getAttribute("data-filter") : "all";
  }

  function applyFilter(filter) {
    var cards = requestList.querySelectorAll(".request-card");
    var visible = 0;
    cards.forEach(function (card) {
      var match = filter === "all" || card.getAttribute("data-status") === filter;
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    var hasAny = currentData.length > 0;
    emptyState.hidden = visible !== 0;
    requestList.hidden = visible === 0;
    if (!hasAny) {
      emptyTitle.textContent = "ยังไม่เคยยื่นใบลา";
      emptyText.textContent = "เริ่มยื่นใบลาแรกของคุณได้เลย";
    } else {
      emptyTitle.textContent = "ไม่พบใบลาในหมวดนี้";
      emptyText.textContent = "ลองเลือกตัวกรองอื่น หรือยื่นใบลาใหม่";
    }
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      applyFilter(chip.getAttribute("data-filter"));
    });
  });

  async function loadData(name) {
    currentName = name;
    showOnly(loadingState);
    var result = await LeaveAPI.apiGet("list", { name: name });
    if (!result.ok) {
      errorText.textContent = result.message;
      showOnly(errorState);
      return;
    }
    lookupNameLabel.textContent = "กำลังแสดงใบลาของ: " + name;
    renderList(result.data || []);
    showOnly(dataArea);
  }

  lookupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = lookupNameInput.value.trim();
    if (!name) return;
    LeaveCommon.setIdentity({ fullName: name, employeeId: "" });
    loadData(name);
  });

  changeIdentityBtn.addEventListener("click", function () {
    LeaveCommon.clearIdentity();
    lookupNameInput.value = "";
    showOnly(lookupCard);
    lookupNameInput.focus();
  });

  retryBtn.addEventListener("click", function () {
    if (currentName) loadData(currentName);
  });

  // ---- เริ่มต้น ----
  (function init() {
    var identity = LeaveCommon.getIdentity();
    if (identity && identity.fullName) {
      loadData(identity.fullName);
    } else {
      showOnly(lookupCard);
    }
  })();
})();
