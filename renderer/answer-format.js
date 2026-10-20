// Deliberately limited formatting: code fences become DOM nodes; no HTML is parsed.
export function renderAnswerText(container, text) {
  const fragment = document.createDocumentFragment();
  const chunks = String(text || '').split('```');
  chunks.forEach((chunk, index) => {
    if (!(index % 2)) { fragment.appendChild(document.createTextNode(chunk)); return; }
    const newline = chunk.indexOf('\n');
    const label = newline >= 0 ? chunk.slice(0, newline).trim() : '';
    const body = newline >= 0 ? chunk.slice(newline + 1) : chunk;
    const block = document.createElement('pre'); const code = document.createElement('code');
    if (/^[\w+#.-]{1,30}$/.test(label)) code.dataset.language = label;
    code.textContent = body; block.appendChild(code); fragment.appendChild(block);
  });
  container.replaceChildren(fragment);
}
