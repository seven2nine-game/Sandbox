import './style.css';
import { pageBackground, pageTitle, panelCard } from './ui.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="${pageBackground} grid place-items-center p-8">
    <section class="w-full max-w-[42rem]">
      <h1 class="${pageTitle}">Sandbox</h1>
      <nav class="mt-8 grid gap-3" aria-label="Available test pages">
        <a class="${panelCard} flex items-center justify-between gap-4 p-4 no-underline" href="./bonsai/">
          <span>
            <strong class="block">Bonsai WebGPU Test</strong>
            <small class="mt-1 block leading-[1.4] text-[#aeb8c4]">Run onnx-community/Bonsai-1.7B-ONNX in the browser.</small>
          </span>
          <span aria-hidden="true">→</span>
        </a>
        <a class="${panelCard} flex items-center justify-between gap-4 p-4 no-underline" href="./sheepdog/">
          <span>
            <strong class="block">Sheepdog Rush</strong>
            <small class="mt-1 block leading-[1.4] text-[#aeb8c4]">Play a two-player sheep herding game in portrait mode.</small>
          </span>
          <span aria-hidden="true">→</span>
        </a>
      </nav>
    </section>
  </main>
`;
