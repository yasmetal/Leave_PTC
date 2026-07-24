/* Shared helpers used across every page of the mockup.
   This is a UI/UX prototype: no real backend calls, only local mock data
   and small in-page interactions so the flows feel real when clicked. */

function showToast(message) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
}

function openModal(id) {
  var m = document.getElementById(id);
  if (m) m.hidden = false;
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) m.hidden = true;
}

document.addEventListener('click', function (e) {
  var overlay = e.target.closest ? e.target.closest('.modal-overlay') : null;
  if (overlay && e.target === overlay) overlay.hidden = true;
});
