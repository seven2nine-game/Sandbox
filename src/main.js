import './style.css';

const app = document.querySelector('#app');
const basePath =
  import.meta.env.BASE_URL === './'
    ? new URL(import.meta.env.PROD ? '../' : '/', import.meta.url).pathname
    : new URL(import.meta.env.BASE_URL, window.location.origin).pathname;

const routes = {
  '/': renderHome,
  '/bonsai': renderBonsai,
};

const pageBackground =
  'min-h-screen bg-[#121417] bg-[linear-gradient(135deg,rgba(60,96,91,0.2),transparent_36rem)] text-[#eef2f8]';
const panelCard = 'rounded-lg border border-[#313a43] bg-[#1c2228] text-[#f8fbff]';
const eyebrow = 'mb-2 text-xs font-bold uppercase tracking-normal text-[#98c6b5]';
const pageTitle =
  'm-0 text-[clamp(2.4rem,7vw,5rem)] leading-[0.98] tracking-normal text-white';
const compactTitle =
  'm-0 text-[clamp(1.8rem,5vw,3.2rem)] leading-[0.98] tracking-normal text-white';
const messageBase =
  'max-w-[46rem] rounded-lg border border-[#35404a] bg-[#20272e] px-4 py-3 text-[#edf4f8]';
const messageUser = 'justify-self-end bg-[#26342f]';
const buttonClass =
  'min-h-10 rounded-lg border-0 bg-[#98c6b5] px-4 font-bold text-[#101417] disabled:cursor-not-allowed disabled:bg-[#303942] disabled:text-[#7a858f]';

function routePath(path) {
  return `${basePath.replace(/\/$/, '')}${path}`;
}

function currentRoutePath() {
  const pathname = window.location.pathname;
  if (!pathname.startsWith(basePath)) return pathname;

  const relativePath = pathname.slice(basePath.length).replace(/^\/+/, '');
  return relativePath === '' || relativePath === 'index.html' ? '/' : `/${relativePath}`;
}

function navigate(path) {
  window.history.pushState({}, '', routePath(path));
  render();
}

function render() {
  const route = routes[currentRoutePath()] ?? renderNotFound;
  route();
}

function linkHandler(event) {
  const link = event.target.closest('a[data-route]');
  if (!link) return;
  event.preventDefault();
  navigate(link.dataset.route);
}

window.addEventListener('popstate', render);
document.addEventListener('click', linkHandler);

function renderHome() {
  document.title = 'Sandbox';
  app.innerHTML = `
    <main class="${pageBackground} grid place-items-center p-8">
      <section class="w-full max-w-[42rem]">
        <h1 class="${pageTitle}">Sandbox</h1>
        <nav class="mt-8 grid gap-3" aria-label="Available test pages">
          <a class="${panelCard} flex items-center justify-between gap-4 p-4 no-underline" href="${routePath('/bonsai')}" data-route="/bonsai">
            <span>
              <strong class="block">Bonsai WebGPU Test</strong>
              <small class="mt-1 block leading-[1.4] text-[#aeb8c4]">Run onnx-community/Bonsai-1.7B-ONNX in the browser.</small>
            </span>
            <span aria-hidden="true">→</span>
          </a>
        </nav>
      </section>
    </main>
  `;
}

function renderNotFound() {
  document.title = 'Not found';
  app.innerHTML = `
    <main class="${pageBackground} grid place-items-center p-8">
      <section class="w-full max-w-[42rem]">
        <p class="${eyebrow}">404</p>
        <h1 class="${pageTitle}">Page not found</h1>
        <a class="${panelCard} mt-6 inline-block px-4 py-3 no-underline" href="${routePath('/')}" data-route="/">Back to entries</a>
      </section>
    </main>
  `;
}

function renderBonsai() {
  document.title = 'Bonsai WebGPU Test';
  app.innerHTML = `
    <main class="${pageBackground} grid grid-rows-[auto_1fr] gap-4 p-4">
      <header class="mx-auto flex w-full max-w-[62rem] items-end justify-between gap-4">
        <a class="text-[#aeb8c4] no-underline" href="${routePath('/')}" data-route="/">Entries</a>
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

  setupBonsaiPage();
}

function setupBonsaiPage() {
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

  const setStatus = (text) => {
    status.textContent = text;
  };

  const setControls = () => {
    loadButton.disabled = loading || ready;
    promptInput.disabled = !ready || generating;
    sendButton.disabled = !ready || generating || promptInput.value.trim().length === 0;
    stopButton.disabled = !generating;
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

  const handleWorkerMessage = (event) => {
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
  };

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
    if (worker) {
      worker.terminate();
      worker = null;
    }
    loading = false;
    ready = false;
    generating = false;
    activeMessage = null;
    conversation = [];
    pendingPrompt = '';
    pendingResponse = '';
    setStatus('Model not loaded');
    messages.innerHTML = `
      <article class="${messageBase}">
        <strong class="mb-1 block text-[0.82rem] text-[#98c6b5]">Bonsai</strong>
        <p class="m-0 whitespace-pre-wrap leading-[1.55]">Load the model in a WebGPU-enabled browser to generate locally.</p>
      </article>
    `;
    setControls();
  });

  setControls();
}

render();
