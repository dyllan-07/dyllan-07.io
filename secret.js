// A quiet "who are you?" at the foot of the page. The right answer opens /for-<answer>/.
// Only a SHA-256 hash of the answer lives here, so the page source doesn't give it away.
(function () {
  var ANSWER_HASH = 'd70c443f2c69068c436866e3c88b0d246cfadcb8617a96fa6ea66967d7b7d1cc';

  var css = '' +
    '.whoami{padding:4.5rem 0 5rem;font-family:"DM Mono",monospace;font-size:0.78rem;font-weight:300;' +
      'letter-spacing:0.07em;text-transform:lowercase;color:var(--text-2);}' +
    '.whoami [hidden]{display:none !important;}' +
    '.whoami button{all:unset;cursor:pointer;opacity:0.45;transition:opacity 400ms ease;}' +
    '.whoami button:hover,.whoami button:focus-visible{opacity:1;}' +
    '.whoami form{display:inline-flex;align-items:baseline;gap:0.6em;}' +
    '.whoami input{font:inherit;letter-spacing:inherit;color:var(--text);background:none;border:none;' +
      'border-bottom:1px solid var(--border);padding:0 0 2px;width:9rem;outline:none;}' +
    '.whoami input:focus{border-bottom-color:var(--text-2);}' +
    '.whoami.wrong form{animation:whoami-shake 400ms ease;}' +
    '@keyframes whoami-shake{20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}' +
    'body.whoami-leaving .wrap{opacity:0;transition:opacity 600ms ease;}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.className = 'whoami';
  box.innerHTML =
    '<button type="button">who are you?</button>' +
    '<form hidden><label for="whoamiInput">who are you?</label>' +
    '<input id="whoamiInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></form>';
  document.querySelector('.wrap').appendChild(box);

  var button = box.querySelector('button');
  var form = box.querySelector('form');
  var input = box.querySelector('input');

  button.addEventListener('click', function () {
    button.hidden = true;
    form.hidden = false;
    input.focus();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      form.hidden = true;
      button.hidden = false;
      button.focus();
    }
  });

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var answer = input.value.trim().toLowerCase();
    if (!answer) return;
    sha256(answer).then(function (hash) {
      if (hash === ANSWER_HASH) {
        document.body.classList.add('whoami-leaving');
        setTimeout(function () { location.href = '/for-' + encodeURIComponent(answer) + '/'; }, 600);
      } else {
        input.value = '';
        box.classList.remove('wrong');
        void box.offsetWidth; // restart the shake
        box.classList.add('wrong');
      }
    });
  });
})();
