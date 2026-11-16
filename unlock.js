const form = document.querySelector('#unlock-form');
const input = document.querySelector('#password');
const status = document.querySelector('#status');
const submit = form.querySelector('[type=submit]');
const show = document.querySelector('.show-password');
const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
show.addEventListener('click', () => {
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  show.textContent = visible ? '隐藏' : '显示';
  show.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
  show.setAttribute('aria-pressed', String(visible));
});
let frame;
let pendingDocument = null;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  status.className = '';
  if (!globalThis.crypto?.subtle) {
    status.textContent = '请使用 HTTPS 链接或本地预览地址打开惊喜。';
    return;
  }
  submit.disabled = true;
  status.textContent = '正在为你打开生日礼物馆…';
  let plain;
  try {
    let payload = window.BIRTHDAY_PAYLOAD;
    if (!payload) {
      const response = await fetch('payload.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('network');
      payload = await response.json();
    }
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: payload.hash, iterations: payload.iterations, salt: fromBase64(payload.salt) }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv), tagLength: 128 }, key, fromBase64(payload.ciphertext));
  } catch (error) {
    status.className = 'error';
    status.textContent = error.name === 'OperationError' ? '暗号还差一点点，再试一次吧。' : '惊喜暂时没有送达，请刷新后再试。';
    submit.disabled = false;
    input.focus();
    return;
  }
  input.value = '';
  document.body.classList.add('is-opening');
  await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450));
  frame = document.createElement('iframe');
  frame.className = 'birthday-frame';
  frame.title = '你的生日礼物馆';
  frame.setAttribute('sandbox', 'allow-scripts');
  pendingDocument = new TextDecoder().decode(plain);
  frame.srcdoc = '<!doctype html><html><body><script>window.addEventListener("message",function receive(event){if(event.source!==parent||event.data?.type!=="birthday:document")return;document.open();document.write(event.data.html);document.close();});parent.postMessage({type:"birthday:document-ready"},"*");<\/script></body></html>';
  document.body.append(frame);
  document.querySelector('#gate').hidden = true;
  document.title = '六份偏爱 · 生日礼物馆';
  frame.focus();
});
window.addEventListener('message', event => {
  if (!frame || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'birthday:document-ready' && pendingDocument) {
    frame.contentWindow.postMessage({type:'birthday:document',html:pendingDocument},'*');
  }
  if (event.data === 'birthday:lock') location.reload();
  if (event.data?.type === 'birthday:ready') {
    pendingDocument = null;
    let opened = [];
    try { opened = JSON.parse(sessionStorage.getItem('birthday-atelier-opened-v2') || '[]'); } catch {}
    frame.contentWindow.postMessage({ type: 'birthday:restore', opened: Array.isArray(opened) ? opened : [] }, '*');
  }
  if (event.data?.type === 'birthday:progress' && Array.isArray(event.data.opened)) {
    const opened = event.data.opened.filter(id => typeof id === 'string' && /^[a-z-]{1,40}$/.test(id)).slice(0, 6);
    try { sessionStorage.setItem('birthday-atelier-opened-v2', JSON.stringify(opened)); } catch {}
  }
});
