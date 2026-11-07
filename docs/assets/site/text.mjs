// Runtime text for generated pages. The build (tools/sitebuild/copy.py) inlines the page's copy as
// <script type="application/json" id="page-copy">{"meta":{lang, locale, direction, routes}, "copy":{key: text}}</script>
// holding only the keys that the page's modules pass to the t and text functions as single-quoted string literals.

export function readCopy(id = 'page-copy', root = globalThis.document) {
  const node = root?.getElementById(id);
  if (!node) throw new Error('Missing page copy: #' + id);
  const data = JSON.parse(node.textContent);
  if (!data || typeof data.copy !== 'object' || typeof data.meta !== 'object') throw new Error('Invalid page copy: #' + id);
  return data;
}

export function createText(copy, locale) {
  const number = new Intl.NumberFormat(locale);
  return function text(key, values = {}) {
    if (!Object.hasOwn(copy, key)) throw new Error('Missing website copy: ' + key);
    return copy[key].replace(/\{(\w+)\}/g, (match, name) => typeof values[name] === 'number' ? number.format(values[name]) : String(values[name] ?? match));
  };
}
