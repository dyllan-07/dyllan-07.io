// Site-only: turns the scrapbook into a finished, look-but-don't-touch book.
// The local copy in ~/Documents/amy-scrapbook doesn't load this file, so it stays editable.
// Loaded before the scrapbook's own script, which is why it can step in front of storage.
(function () {
  "use strict";

  // Always show the built-in pages (book-content.js), never edits saved in this browser
  // from an earlier visit — those stay untouched in storage, just ignored here.
  var getItem = Storage.prototype.getItem, setItem = Storage.prototype.setItem;
  function isBookKey(k) { return typeof k === 'string' && k.indexOf('forPooksBook:') === 0; }
  Storage.prototype.getItem = function (k) { return isBookKey(k) ? null : getItem.apply(this, arguments); };
  Storage.prototype.setItem = function (k) { if (!isBookKey(k)) return setItem.apply(this, arguments); };

  // No editing tools, photos sit still, and empty pages don't show writing prompts.
  var style = document.createElement('style');
  style.textContent =
    '.photo-library, .book-tools{ display: none !important; }' +
    '.scrap-photo{ pointer-events: none !important; cursor: default !important; }' +
    '.page-text{ cursor: default !important; }' +
    '.page-text:empty:before{ content: none !important; }';
  document.head.appendChild(style);

  // Nothing can be dropped onto a page. Capturing at the window runs before the pages' own handlers.
  ['dragover', 'drop'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (e.target.closest && e.target.closest('.page-face')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.page-text').forEach(function (el) {
      el.contentEditable = 'false';
      el.removeAttribute('data-placeholder');
    });
  });
})();
