// ChatGPT set 4 — piece 3 of ??: استبدال قسم عرض الصورة داخل الحلقة
// Received via Hilal, 2026-11-24 11:01 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete.
// NOTE (agent): the block re-states the `const sprite = ...` line
// that piece 2 said to leave as is — read together, the block replaces
// the region FROM that line through the backgroundPosition line, once
// (keeping both declarations would be a duplicate-const SyntaxError).
// Behaviour vs the live code: identical — the _h guard now keys on
// sprite.sheetIndex (0/1, same values as the old sheet-B comparison),
// and backgroundPosition is the same -cell*CDW value.

/* ----- sprite selection: original pose order ----- */

const sprite = getCamelSprite(
  uu,
  i % CAMEL_VARIANTS
);

if (d._h !== sprite.sheetIndex) {

  d.style.backgroundImage =
    'url(' + sprite.sheet + ')';

  d._h = sprite.sheetIndex;
}

d.style.backgroundPosition =
  (-sprite.cell * CDW) + 'px 0px';
