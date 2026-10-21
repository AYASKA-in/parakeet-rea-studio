// Explicit one-action capture: no dialog, focus change, or persisted pixels.
export async function captureScreenshotAnswer(bridge, defaultQuestion = '', {signal, displayId = ''} = {}) {
  if (signal?.aborted) return null;
  const captured = await bridge.captureScreenshot({displayId});
  if (signal?.aborted) return null;
  await bridge.validateScreenshot({captureId:captured.captureId});
  if (signal?.aborted) return null;
  return {imageDataUrl:captured.dataUrl, captureId:captured.captureId, screenQuality:'detail', question:defaultQuestion || 'Read the entire visible screenshot from top to bottom and solve its main question. For coding, identify the language, required interface, constraints and examples; provide an efficient complete solution with time and space complexity and check edge cases. If essential text is unreadable or missing, ask for it instead of guessing.'};
}

// Screen content is transient: captured only after an explicit action and never persisted.
export async function reviewScreenshot(bridge, defaultQuestion = '', {signal} = {}) {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#screen-analysis-dialog'), image = $('#screen-preview-image'), surface = $('#screen-preview-surface'), selection = $('#screen-crop-selection');
  const displaySelect = $('#screen-display');
  let rectangle = null, start = null, captured = null, busy = false, closed = false, receivedAt = 0;
  const form = dialog.querySelector('form');
  const showError = message => { $('#screen-error').textContent = message; $('#screen-error').hidden = false; };
  const invalidate = message => { captured = null; image.removeAttribute('src'); reset(); $('#screen-preview-label').textContent = 'No current screenshot.'; $('#screen-send').disabled = true; showError(message); };
  const caption = () => {
    if (!captured) return;
    const age = performance.now() - receivedAt;
    if (age >= captured.expiresInMs) { invalidate('Screenshot expired. Refresh it and review the new image before sending.'); return; }
    $('#screen-preview-label').textContent = `${captured.displayName} · ${captured.width} × ${captured.height} px · captured ${new Date(captured.capturedAt).toLocaleTimeString()} · ${Math.floor(age / 1000)}s old (expires after 2 minutes)`;
  };
  $('#screen-question').value = defaultQuestion || 'Read the screenshot and answer the visible question. For coding, explain the approach and provide a correct solution.';
  const reset = () => { rectangle = null; start = null; selection.hidden = true; $('#screen-crop-status').textContent = 'Whole screen selected. Drag over the preview to select a region.'; };
  const capture = async () => {
    if (busy || closed) return;
    busy = true; $('#screen-send').disabled = true; $('#screen-refresh').disabled = true; displaySelect.disabled = true;
    $('#screen-error').hidden = true;
    try {
      const result = await bridge.captureScreenshot({ displayId: displaySelect.value });
      if (closed) return;
      captured = result; receivedAt = performance.now(); image.src = result.dataUrl; await image.decode(); reset(); caption();
    } catch (error) { invalidate(error.message || 'Screen capture failed.'); }
    finally { busy = false; if (!closed) { $('#screen-send').disabled = !captured; $('#screen-refresh').disabled = false; displaySelect.disabled = false; } }
  };
  const point = event => {
    const bounds = image.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };
  const down = event => { if (!captured || busy) return; start = point(event); surface.setPointerCapture(event.pointerId); };
  const move = event => {
    if (!start) return;
    const end = point(event); rectangle = { x: Math.min(start.x,end.x), y: Math.min(start.y,end.y), width: Math.abs(end.x-start.x), height: Math.abs(end.y-start.y) };
    Object.assign(selection.style, { left: `${rectangle.x * 100}%`, top: `${rectangle.y * 100}%`, width: `${rectangle.width * 100}%`, height: `${rectangle.height * 100}%` }); selection.hidden = false;
  };
  const up = () => { start = null; if (!rectangle || rectangle.width < .01 || rectangle.height < .01) reset(); else $('#screen-crop-status').textContent = 'Selected region only will be sent. Use Clear crop to send the whole screen.'; };
  const keyboardCrop = event => {
    if(!captured || busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='Escape'){reset();return;}
    rectangle ||= {x:.25,y:.25,width:.5,height:.5};
    const horizontal=['ArrowLeft','ArrowRight'].includes(event.key),delta=['ArrowLeft','ArrowUp'].includes(event.key)?-.05:.05;
    if(event.key!=='Enter') {
      if(event.shiftKey){const dimension=horizontal?'width':'height',position=horizontal?'x':'y';rectangle[dimension]=Math.max(.05,Math.min(1-rectangle[position],rectangle[dimension]+delta));}
      else {const position=horizontal?'x':'y',dimension=horizontal?'width':'height';rectangle[position]=Math.max(0,Math.min(1-rectangle[dimension],rectangle[position]+delta));}
    }
    Object.assign(selection.style,{left:rectangle.x*100+'%',top:rectangle.y*100+'%',width:rectangle.width*100+'%',height:rectangle.height*100+'%'});selection.hidden=false;
    $('#screen-crop-status').textContent='Selected region: '+Math.round(rectangle.width*100)+'% wide by '+Math.round(rectangle.height*100)+'% high. Only this region will be sent.';
  };
  surface.tabIndex=0;surface.setAttribute('role','group');surface.setAttribute('aria-label','Screenshot crop. Enter selects the center. Arrow keys move the crop; Shift plus arrows resize. Escape clears the crop.');
  surface.addEventListener('keydown',keyboardCrop);
  surface.addEventListener('pointerdown',down); surface.addEventListener('pointermove',move); surface.addEventListener('pointerup',up); surface.addEventListener('pointercancel',up);
  displaySelect.addEventListener('change',capture); $('#screen-refresh').addEventListener('click',capture); $('#screen-clear-crop').addEventListener('click',reset);
  const submit = async event => {
    if (event.submitter?.id !== 'screen-send') return;
    event.preventDefault();
    if (!captured || busy) return;
    busy = true; $('#screen-send').disabled = true;
    try { await bridge.validateScreenshot({ captureId: captured.captureId }); if (!closed && captured) dialog.close('confirm'); }
    catch (error) { if (!closed) invalidate(error.message || 'Refresh the screenshot before sending.'); }
    finally { busy = false; if (!closed) $('#screen-send').disabled = !captured; }
  };
  form.addEventListener('submit',submit);
  const timer = setInterval(caption, 1000);
  const unsubscribe = bridge.onDisplaysChanged?.(() => {
    if (closed) return;
    invalidate('Display configuration changed. Reopen screen analysis to select a display and review a fresh image.');
  });
  const cancel=()=>{closed=true;if(dialog.open)dialog.close('cancel');};
  signal?.addEventListener('abort',cancel,{once:true});
  const remove = () => { surface.removeEventListener('keydown',keyboardCrop);surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',up);surface.removeEventListener('pointercancel',up);displaySelect.removeEventListener('change',capture);$('#screen-refresh').removeEventListener('click',capture);$('#screen-clear-crop').removeEventListener('click',reset); };
  try {
    if(signal?.aborted)return null;
    const displays = await bridge.listDisplays(); displaySelect.replaceChildren();
    if(closed)return null;
    for (const display of displays) { const option = document.createElement('option');option.value=display.id;option.textContent=`${display.name}${display.primary ? ' (primary)' : ''} · ${display.width} × ${display.height}`;displaySelect.appendChild(option);if(display.primary)displaySelect.value=display.id; }
    await capture();
    if(closed)return null;
    if (bridge.windowControl) await bridge.windowControl('show');
    if(closed)return null;
    dialog.returnValue='cancel';dialog.showModal();
    const result = await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
    if (result !== 'confirm' || !captured || busy) return null;
    const quality = $('#screen-quality').value;
    const maxSide = quality === 'fast' ? 1600 : quality === 'detail' ? 3840 : 2560;
    const region = rectangle || { x:0, y:0, width:1, height:1 };
    const x=Math.floor(region.x*image.naturalWidth), y=Math.floor(region.y*image.naturalHeight);
    const width=Math.max(1,Math.min(image.naturalWidth-x,Math.round(region.width*image.naturalWidth)));
    const height=Math.max(1,Math.min(image.naturalHeight-y,Math.round(region.height*image.naturalHeight)));
    const scale=Math.min(1,maxSide/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',quality === 'fast' ? .8 : quality === 'detail' ? .94 : .88);
    return { imageDataUrl:dataUrl,screenQuality:quality,captureId:captured.captureId,question:$('#screen-question').value.trim() || 'Answer the question visible in the screenshot.' };
  } finally { closed=true;remove();form.removeEventListener('submit',submit);signal?.removeEventListener('abort',cancel);clearInterval(timer);unsubscribe?.();image.removeAttribute('src');captured=null;rectangle=null;reset(); }
}
