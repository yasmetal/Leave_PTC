(function () {
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('.request-card');
  var empty = document.getElementById('emptyState');
  var list = document.getElementById('requestList');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var filter = chip.getAttribute('data-filter');
      var visibleCount = 0;
      cards.forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-status') === filter;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (empty) empty.hidden = visibleCount !== 0;
      if (list) list.hidden = visibleCount === 0;
    });
  });
})();
