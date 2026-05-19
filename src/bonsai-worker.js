import {
  InterruptableStoppingCriteria,
  pipeline,
  TextStreamer,
} from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Bonsai-1.7B-ONNX';

let generator;
let stoppingCriteria;

async function loadModel() {
  if (generator) {
    self.postMessage({ type: 'ready' });
    return;
  }

  stoppingCriteria = new InterruptableStoppingCriteria();
  generator = await pipeline('text-generation', MODEL_ID, {
    device: 'webgpu',
    dtype: 'q1',
    progress_callback: (progress) => {
      self.postMessage({
        type: 'loading',
        text: progress.status ?? 'Loading',
        progress: progress.progress,
      });
    },
  });

  self.postMessage({ type: 'ready' });
}

async function generate(prompt, history = []) {
  if (!generator) {
    await loadModel();
  }

  stoppingCriteria.reset();

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      self.postMessage({ type: 'token', text });
    },
  });

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Answer directly and concisely.',
    },
    ...history,
    {
      role: 'user',
      content: prompt,
    },
  ];

  await generator(messages, {
    max_new_tokens: 128,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.08,
    do_sample: true,
    streamer,
    stopping_criteria: stoppingCriteria,
  });

  self.postMessage({ type: 'done' });
}

self.addEventListener('message', async (event) => {
  try {
    if (event.data.type === 'load') {
      await loadModel();
    }

    if (event.data.type === 'generate') {
      await generate(event.data.prompt, event.data.history);
    }

    if (event.data.type === 'stop') {
      stoppingCriteria?.interrupt();
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
