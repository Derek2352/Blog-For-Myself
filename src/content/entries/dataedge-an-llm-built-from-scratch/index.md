---
# Written Jul 2026 from Derek's own design-and-debugging document.
# Two things checked rather than copied: the document claims GQA "reduces
# KV-cache memory by up to 8x", but 32 query heads to 8 key/value heads is a 4x
# reduction — the entry says 4x. And the 2.5B figure is a design target, not
# something that was trained; the page is explicit that what ran is the micro
# prototype. Withheld: the five source files in full, and the scale-up roadmap
# (GPU migration, 1-1.5T tokens, SFT/DPO, GGUF export), which is intent rather
# than work.
title: "DataEdge — an LLM built from scratch"
category: "creative-ai"
date: 2026-07-28
updated: 2026-07-28
summary: "A decoder-only transformer written by hand in PyTorch — GQA, RoPE, SwiGLU, RMSNorm — specialised for data analytics and designed to run offline on a phone. Architected at 2.5B parameters; prototyped small enough to train on a laptop CPU, then debugged until it stopped answering with blank lines."
note: "Loss fell for five epochs, exactly as promised. Then I typed a question and it answered with nothing at all."
cover: "./images/cover.svg"
# Drawn cover rather than the placeholder plate: see the `art:` section in README.md.
# Replaced automatically the day a real cover.jpg lands beside this file.
art: "model-graph"
gallery: []
tags: ["llm", "pytorch", "python", "ai-infrastructure"]
links: []
# links:
#   - label: "GitHub — DataEdge"
#     url: "https://"
featured: false
draft: false
---

## What it was

Not a fine-tune, and not a wrapper around somebody else's weights. **DataEdge** is the
transformer itself — attention, positional encoding, activation, normalisation, all written
out in PyTorch — aimed at one job: a data-analytics assistant that runs offline on hardware
people already own. A phone, or a PC old enough to have been given up on.

Narrowness is the whole strategy. English only, and analytics only: SQL generation, Pandas
manipulation, JSON parsing, statistical reasoning. That isn't modesty, it's arithmetic. A
32,000-token vocabulary tuned for English and code instead of a 128,000-token multilingual
one hands back roughly 200 million parameters, and every one of those is RAM you don't have
on a phone. Dense rather than mixture-of-experts for the same reason: MoE spikes memory at
exactly the moment a mobile device can least afford it.

The design sits at about **2.5 billion parameters**, which at 4-bit quantisation lands around
1.3–1.5 GB — small enough to hold on a handset and answer with no network at all. I should be
straight about what that means, though. 2.5B is the architecture's target, not something I
trained. What actually ran is the same model at toy scale: four layers, hidden size 256, ten
thousand synthetic text-to-SQL pairs, five epochs, on a CPU. Enough to prove the thing
assembles, trains and generates. Nowhere near enough to be good at anything.

## What I did

Every architectural choice had to earn its place against a memory budget:

- **Grouped-Query Attention**, 32 query heads sharing 8 key/value heads — a 4× cut in
  KV-cache during generation, which is the memory that actually grows while a model is
  talking.
- **RoPE** for position, because rotary embeddings extrapolate past the context length they
  were trained on rather than falling apart at the boundary.
- **SwiGLU** instead of GELU, a measured win on code and mathematical reasoning — the only
  two things this model is for.
- **Pre-norm RMSNorm**, cheaper than LayerNorm and steadier in training.
- **Weight tying** between the token embedding and the output head, worth about 81 million
  parameters at full scale for no measurable loss.
- **No bias terms** in the linear layers, PaLM/Llama style, for stability.

Then the chain: Gretel's synthetic text-to-SQL corpus down to ten thousand question/query
pairs, a ByteLevelBPE tokenizer trained on that corpus, next-token pre-training on the CPU,
and a sampling loop for inference.

And then five failures, which is where the actual education was.

**The rotary embedding wouldn't broadcast.** `The size of tensor a (4) must match the size of
tensor b (141)` — sequence length colliding with head count, because the frequency tensor had
the wrong rank. The fix is one line, and took considerably longer than one line suggests:

```python
# wanted: [1, seq_len, 1, head_dim // 2]
freqs_complex = freqs_complex.unsqueeze(0).unsqueeze(2)
```

**Then it repeated itself forever.** `GROUP BY_ GROUP BY_ GROUP BY_`. I assumed
undertraining and was wrong: I was decoding with `argmax`, so the model took the single
likeliest token every step and walked straight into a loop it had no way to leave.
Temperature sampling, top-k/top-p filtering and a repetition penalty fixed it without
touching the weights.

**Then it fused the two languages it knew.** `SELECT customer_id, pd.mean()` — SQL and Pandas
welded into one confident, meaningless answer. At this size the model had nothing telling it
where one domain stopped, so I put explicit boundaries in the data: `<SQL_QUESTION>`,
`<SQL_QUERY>`, `<PYTHON>`.

**Then the weights wouldn't load.** A state-dict size mismatch, because `train.py` was
running at hidden size 256 while `chat.py` built a 512 shell to pour them into. Two files
independently holding the same configuration, with nothing making them agree.

**Then it went silent, which I'd never have guessed.** Prompts came back blank, or as an
endless newline loop on token 203. Nothing was wrong with the model, the training loop or the
data. The tokenizer had never registered `<SQL_QUESTION>` as a token, so it was splitting it
into fourteen separate ASCII characters. My prompts were arriving as roughly sixty tokens of
character-level noise, and a four-layer model responded in the only sensible way available to
it: by predicting whitespace. The fix was to register the tags properly as special tokens,
build the prompt from explicit IDs rather than from a string, and refuse to let it open with
a blank:

```python
if i == 0:  # its favourite first move is silence — take that away
    next_token_logits[0, ID_NEWLINE] -= 50.0
    next_token_logits[0, 225] -= 50.0  # space
```

## What I learned

The silent failure taught me the most, and not about transformers. Nothing was broken where
the symptom appeared. The output was empty, so I looked at generation; generation was fine.
Then the weights, the loss curve, the learning rate, the data. The fault was in the
tokenizer, three layers upstream, and every plausible theory I had pointed somewhere else.
Debugging a model turns out to be mostly the discipline of not trusting the place the error
showed up.

The repetition loop was a smaller version of the same lesson. A model that repeats itself
looks undertrained, and mine wasn't — it was decoded badly. Behaviour that reads as a
capability problem is often a parameter you chose without noticing you were choosing.

Then the unglamorous one: two files holding the same configuration will drift, and the only
thing that caught it was a shape error at load time. Anything that has to agree in two places
eventually won't.

And the reason to do this at all. I've read about attention many times over. Writing it —
deciding head dimensions, watching a KV-cache genuinely shrink when key/value heads are
shared, having RoPE refuse to broadcast — moved it from something I could describe to
something I understand. The route from here is clear enough: a GPU, real corpora, alignment,
then a quantised export for the phone. But the finished model was never the part I wanted.

## How it felt

Watching the loss fall for the first time is genuinely thrilling, and it is also a trap. Five
epochs of a number going down, everything behaving exactly as the textbook promised — and
then I typed a question and got back an empty line. Not an error. Not a wrong answer. A model
that had trained perfectly and had nothing whatsoever to say. I have never been so
comprehensively defeated by whitespace.

The domain mashup was the funny one. `SELECT customer_id, pd.mean()` is nonsense, but it is
*confident* nonsense — the syntax of the only two languages I'd ever shown it, sitting in one
statement, entirely certain it had answered the question. Hard to stay annoyed at something
for combining everything it knows.

What stays with me is how this changed what "AI project" means to me. Everything else on this
site sits on top of models other people built. This one is a few hundred lines of my own in a
folder on my desktop, producing something barely coherent — and I would take that over a
polished result from a tool I couldn't open up.
