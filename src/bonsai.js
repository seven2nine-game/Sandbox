import './style.css';
import { buttonClass, compactTitle, eyebrow, messageBase, messageUser, pageBackground } from './ui.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="${pageBackground} grid grid-rows-[auto_1fr] gap-4 p-4">
    <header class="mx-auto flex w-full max-w-[62rem] items-end justify-between gap-4">
      <a class="text-[#aeb8c4] no-underline" href="../">Entries</a>
      <div>
        <p class="${eyebrow}">WebGPU local inference</p>
        <h1 class="${compactTitle}">Bonsai WebGPU Test</h1>
      </div>
    </header>

    <section class="mx-auto grid min-h-0 w-full max-w-[62rem] grid-rows-[auto_1fr_auto] overflow-hidden rounded-lg border border-[#2f3842] bg-[#181d22]" aria-live="polite">
      <div id="status" class="border-b border-[#2f3842] bg-[#111519] px-4 py-3 text-[#b9c6d3]">Model not loaded</div>
      <div id="messages" class="grid min-h-[22rem] content-start gap-3 overflow-auto p-4">
        <article class="${messageBase}">
          <strong class="mb-1 block text-[0.82rem] text-[#98c6b5]">Bonsai</strong>
          <p class="m-0 whitespace-pre-wrap leading-[1.55]">Load the model in a WebGPU-enabled browser to generate locally.</p>
        </article>
      </div>
      <form id="composer" class="grid gap-3 border-t border-[#2f3842] p-4">
        <textarea id="prompt" class="w-full resize-y rounded-lg border border-[#35404a] bg-[#111519] p-3 text-[#f8fbff] disabled:text-[#8995a1]" rows="3" placeholder="Enter a short prompt" disabled></textarea>
        <div class="flex flex-wrap gap-2">
          <button id="load" class="${buttonClass}" type="button">Load model</button>
          <button id="send" class="${buttonClass}" type="submit" disabled>Generate</button>
          <button id="stop" class="${buttonClass}" type="button" disabled>Stop</button>
          <button id="reset" class="${buttonClass}" type="button">Reset</button>
        </div>
      </form>
    </section>
  </main>
`;

const status = document.querySelector('#status');
const messages = document.querySelector('#messages');
const composer = document.querySelector('#composer');
const promptInput = document.querySelector('#prompt');
const loadButton = document.querySelector('#load');
const sendButton = document.querySelector('#send');
const stopButton = document.querySelector('#stop');
const resetButton = document.querySelector('#reset');

let worker;
let loading = false;
let ready = false;
let generating = false;
let activeMessage;
let conversation = [];
let pendingPrompt = '';
let pendingResponse = '';
let disposed = false;

const setStatus = (text) => {
  status.textContent = text;
};

const setControls = () => {
  loadButton.disabled = loading || ready;
  promptInput.disabled = !ready || generating;
  sendButton.disabled = !ready || generating || promptInput.value.trim().length === 0;
  stopButton.disabled = !generating;
};

const terminateWorker = () => {
  if (!worker) return;
  worker.terminate();
  worker = null;
};

const resetRuntimeState = ({ clearConversation = false } = {}) => {
  loading = false;
  ready = false;
  generating = false;
  activeMessage = null;
  pendingPrompt = '';
  pendingResponse = '';
  if (clearConversation) {
    conversation = [];
  }
  setStatus('Model not loaded');
  setControls();
};

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('./bonsai-worker.js', import.meta.url), {
    type: 'module',
  });
  worker.addEventListener('message', handleWorkerMessage);
  return worker;
};

const appendMessage = (role, text = '') => {
  const article = document.createElement('article');
  article.className = role === 'user' ? `${messageBase} ${messageUser}` : messageBase;
  article.innerHTML = `<strong class="mb-1 block text-[0.82rem] text-[#98c6b5]">${role === 'user' ? 'You' : 'Bonsai'}</strong><p class="m-0 whitespace-pre-wrap leading-[1.55]"></p>`;
  article.querySelector('p').textContent = text;
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
};

function handleWorkerMessage(event) {
  if (disposed) return;

  const { type, text, progress, error } = event.data;

  if (type === 'loading') {
    const percent = typeof progress === 'number' ? ` ${Math.round(progress)}%` : '';
    setStatus(`${text}${percent}`);
  }

  if (type === 'ready') {
    loading = false;
    ready = true;
    setStatus('Model loaded');
    setControls();
    promptInput.focus();
  }

  if (type === 'token' && activeMessage) {
    const paragraph = activeMessage.querySelector('p');
    paragraph.textContent += text;
    pendingResponse += text;
    messages.scrollTop = messages.scrollHeight;
  }

  if (type === 'done') {
    conversation = [
      ...conversation,
      { role: 'user', content: pendingPrompt },
      { role: 'assistant', content: pendingResponse.trim() },
    ].slice(-6);
    pendingPrompt = '';
    pendingResponse = '';
    generating = false;
    activeMessage = null;
    setStatus('Generation complete');
    setControls();
  }

  if (type === 'error') {
    loading = false;
    generating = false;
    activeMessage = null;
    pendingPrompt = '';
    pendingResponse = '';
    setStatus(error);
    setControls();
  }
}

loadButton.addEventListener('click', () => {
  if (!navigator.gpu) {
    setStatus('This browser does not support WebGPU');
    return;
  }
  loading = true;
  setStatus('Loading model');
  setControls();
  ensureWorker().postMessage({ type: 'load' });
});

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt || !ready || generating) return;

  appendMessage('user', prompt);
  activeMessage = appendMessage('assistant');
  const history = conversation.slice(-6);
  pendingPrompt = prompt;
  pendingResponse = '';
  promptInput.value = '';
  generating = true;
  setStatus('Generating');
  setControls();
  ensureWorker().postMessage({ type: 'generate', prompt, history });
});

promptInput.addEventListener('input', setControls);

stopButton.addEventListener('click', () => {
  ensureWorker().postMessage({ type: 'stop' });
  setStatus('Stopping');
});

resetButton.addEventListener('click', () => {
  terminateWorker();
  resetRuntimeState({ clearConversation: true });
  messages.innerHTML = `
    <article class="${messageBase}">
      <strong class="mb-1 block text-[0.82rem] text-[#98c6b5]">Bonsai</strong>
      <p class="m-0 whitespace-pre-wrap leading-[1.55]">Load the model in a WebGPU-enabled browser to generate locally.</p>
    </article>
  `;
});

window.addEventListener('pagehide', (event) => {
  terminateWorker();
  if (event.persisted) {
    resetRuntimeState();
    return;
  }
  disposed = true;
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    disposed = false;
    resetRuntimeState();
  }
});

setControls();
