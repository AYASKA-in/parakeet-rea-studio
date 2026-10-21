'use strict';
// Local examples only. No API calls, storage, cookies or analytics.
const examples={
 audio:{label:'A question you might hear',question:'What if our API receives the same request twice?',answer:'Use an idempotency key for requests that change state. Store the result against that key, so a retry can return the previous result instead of repeating the operation. Define an expiry and handle concurrent duplicates.'},
 screen:{label:'A visible SQL practice question',question:'Count completed orders for each customer.',answer:'Filter completed orders before grouping. This assumes orders has customer_id and status columns, and a completed status value.',code:"SELECT customer_id, COUNT(*) AS completed_orders\nFROM orders\nWHERE status = 'completed'\nGROUP BY customer_id;"},
 coding:{label:'A coding practice question',question:'Find the first repeated value in a list.',answer:'For hashable values, keep a set of values already seen. Return the first duplicate encountered; return None if there is none. Average time O(n), extra space O(n).',code:'def first_duplicate(values):\n    seen = set()\n    for value in values:\n        if value in seen:\n            return value\n        seen.add(value)\n    return None'}
};
const buttons=[...document.querySelectorAll('[data-example]')];
for(const button of buttons)button.addEventListener('click',()=>{
 const example=examples[button.dataset.example];if(!example)return;
 for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));
 document.querySelector('#example-label').textContent=example.label;
 document.querySelector('#example-question').textContent=example.question;
 document.querySelector('#example-answer').textContent=example.answer;
 const code=document.querySelector('#example-code');code.hidden=!example.code;code.querySelector('code').textContent=example.code||'';
});
const dialog=document.querySelector('#image-preview');
if(dialog&&typeof dialog.showModal==='function'){
 const image=document.querySelector('#preview-image'),caption=document.querySelector('#preview-caption');
 for(const link of document.querySelectorAll('[data-preview]'))link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();image.src=link.getAttribute('href');image.alt=link.querySelector('img')?.alt||'Parakeet Studio interface';caption.textContent=link.dataset.caption||'';dialog.showModal();
 });
 document.querySelector('#preview-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
}
for(const link of document.querySelectorAll('.mobile-nav a'))link.addEventListener('click',()=>{document.querySelector('.mobile-nav').open=false;});
