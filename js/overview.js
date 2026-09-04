(function () {
  "use strict";

  var loadingState = document.getElementById("loadingState");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var retryBtn = document.getElementById("retryBtn");
  var overviewArea = document.getElementById("overviewArea");
  var monthLabel = document.getElementById("monthLabel");
  var monthTableLabel = document.getElementById("monthTableLabel");
  var byTypeMonthLabel = document.getElementById("byTypeMonthLabel");
  var byTypeChart = document.getElementById("byTypeChart");
  var noTypeData = document.getElementById("noTypeData");
  var monthListBody = document.getElementById("monthListBody");
  var totalsBody = document.getElementById("totalsBody");
  var prevMonthBtn = document.getElementById("prevMonthBtn");
  var nextMonthBtn = document.getElementById("nextMonthBtn");

  var BAR_COLORS = ["var(--primary)", "var(--accent)", "var(--primary-dark)", "#94a3b8", "#f59e0b", "#10b981"];

  var selectedMonth = null; // "yyyy-MM" ของเดือนที่กำลังดูอยู่ (อัปเดตจากค่าที่เซิร์ฟเวอร์ยืนยันกลับมาเสมอ)

  function showOnly(el) {
    [overviewArea, loadingState, errorState].forEach(function (e) {
      if (e) e.hidden = e !== el;
    });
  }

  function currentYm() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  function shiftMonth(ym, delta) {
    var parts = ym.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = new Date(y, m + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function monthNameShort(ym) {
    if (!ym) return "";
    var parts = ym.split("-");
    var months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    var m = parseInt(parts[1], 10) - 1;
    var y = parseInt(parts[0], 10) + 543;
    return (months[m] || "") + " " + y;
  }

  function monthLabelThai(ym) {
    return ym ? ("เดือน" + monthNameShort(ym) + " · ทุกแผนก") : "";
  }

  function renderByType(byType) {
    var entries = Object.keys(byType || {}).map(function (k) { return { type: k, days: byType[k] }; });
    entries.sort(function (a, b) { return b.days - a.days; });

    byTypeChart.innerHTML = "";
    if (entries.length === 0) {
      noTypeData.hidden = false;
      return;
    }
    noTypeData.hidden = true;

    var max = Math.max.apply(null, entries.map(function (e) { return e.days; }));

    entries.forEach(function (e, i) {
      var pct = max > 0 ? Math.round((e.days / max) * 100) : 0;
      var row = document.createElement("div");
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:0.86rem;margin-bottom:4px;">' +
          "<span>" + LeaveCommon.escapeHtml(e.type) + "</span>" +
          '<span class="text-muted">' + e.days + " วัน</span>" +
        "</div>" +
        '<div style="height:8px;border-radius:999px;background:#eef2f7;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:' + BAR_COLORS[i % BAR_COLORS.length] + ';"></div>' +
        "</div>";
      byTypeChart.appendChild(row);
    });
  }

  function renderMonthList(list) {
    monthListBody.innerHTML = "";
    if (!list || list.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="5" class="text-muted" style="text-align:center;padding:20px;">ไม่มีใครลาในเดือนนี้</td>';
      monthListBody.appendChild(tr);
      return;
    }
    list.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + LeaveCommon.escapeHtml(r.fullName) + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(r.department || "-") + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(LeaveCommon.formatDateRange(r.startDate, r.endDate)) + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(r.leaveType || "-") + "</td>" +
        "<td>" + LeaveCommon.statusBadgeHtml(r.status) + "</td>";
      monthListBody.appendChild(tr);
    });
  }

  function renderTotalsByPerson(list) {
    totalsBody.innerHTML = "";
    if (!list || list.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="3" class="text-muted" style="text-align:center;padding:20px;">ยังไม่มีคำขอที่อนุมัติแล้วในระบบ</td>';
      totalsBody.appendChild(tr);
      return;
    }
    list.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + LeaveCommon.escapeHtml(p.fullName || "-") + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(p.department || "-") + "</td>" +
        "<td>" + p.count + " ครั้ง</td>";
      totalsBody.appendChild(tr);
    });
  }

  function updateNavButtons() {
    var atCurrentMonth = selectedMonth >= currentYm();
    nextMonthBtn.disabled = atCurrentMonth;
    nextMonthBtn.style.opacity = atCurrentMonth ? "0.4" : "";
    nextMonthBtn.style.cursor = atCurrentMonth ? "not-allowed" : "";
  }

  async function load(month) {
    showOnly(loadingState);
    var result = await LeaveAPI.apiGet("overview", month ? { month: month } : undefined);
    if (!result.ok) {
      errorText.textContent = result.message;
      showOnly(errorState);
      return;
    }
    var data = result.data;
    selectedMonth = data.month;

    monthLabel.textContent = monthLabelThai(data.month);
    monthTableLabel.textContent = monthNameShort(data.month);
    byTypeMonthLabel.textContent = monthNameShort(data.month);

    document.getElementById("statTotal").textContent = data.counts.total;
    document.getElementById("statPending").textContent = data.counts.pending;
    document.getElementById("statApproved").textContent = data.counts.approved;
    document.getElementById("statRejected").textContent = data.counts.rejected;

    renderByType(data.byType);
    renderMonthList(data.monthRequests);
    renderTotalsByPerson(data.totalsByPerson);
    updateNavButtons();

    showOnly(overviewArea);
  }

  prevMonthBtn.addEventListener("click", function () {
    load(shiftMonth(selectedMonth || currentYm(), -1));
  });
  nextMonthBtn.addEventListener("click", function () {
    if (nextMonthBtn.disabled) return;
    load(shiftMonth(selectedMonth || currentYm(), 1));
  });
  retryBtn.addEventListener("click", function () { load(selectedMonth); });

  load();
})();
