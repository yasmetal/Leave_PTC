(function () {
  "use strict";

  var loadingState = document.getElementById("loadingState");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var retryBtn = document.getElementById("retryBtn");
  var overviewArea = document.getElementById("overviewArea");
  var monthLabel = document.getElementById("monthLabel");
  var byTypeChart = document.getElementById("byTypeChart");
  var noTypeData = document.getElementById("noTypeData");
  var recentBody = document.getElementById("recentBody");

  var BAR_COLORS = ["var(--primary)", "var(--accent)", "var(--primary-dark)", "#94a3b8", "#f59e0b", "#10b981"];

  function showOnly(el) {
    [overviewArea, loadingState, errorState].forEach(function (e) {
      if (e) e.hidden = e !== el;
    });
  }

  function monthLabelThai(ym) {
    if (!ym) return "";
    var parts = ym.split("-");
    var months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    var m = parseInt(parts[1], 10) - 1;
    var y = parseInt(parts[0], 10) + 543;
    return "เดือน" + (months[m] || "") + " " + y + " · ทุกแผนก";
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

  function renderRecent(recent) {
    recentBody.innerHTML = "";
    if (!recent || recent.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="5" class="text-muted" style="text-align:center;padding:20px;">ยังไม่มีคำขอลาในระบบ</td>';
      recentBody.appendChild(tr);
      return;
    }
    recent.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + LeaveCommon.escapeHtml(r.fullName) + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(r.department || "-") + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(LeaveCommon.formatDateRange(r.startDate, r.endDate)) + "</td>" +
        "<td>" + LeaveCommon.escapeHtml(r.leaveType || "-") + "</td>" +
        "<td>" + LeaveCommon.statusBadgeHtml(r.status) + "</td>";
      recentBody.appendChild(tr);
    });
  }

  async function load() {
    showOnly(loadingState);
    var result = await LeaveAPI.apiGet("overview");
    if (!result.ok) {
      errorText.textContent = result.message;
      showOnly(errorState);
      return;
    }
    var data = result.data;
    monthLabel.textContent = monthLabelThai(data.month);
    document.getElementById("statTotal").textContent = data.counts.total;
    document.getElementById("statPending").textContent = data.counts.pending;
    document.getElementById("statApproved").textContent = data.counts.approved;
    document.getElementById("statRejected").textContent = data.counts.rejected;
    renderByType(data.byType);
    renderRecent(data.recent);
    showOnly(overviewArea);
  }

  retryBtn.addEventListener("click", load);
  load();
})();
