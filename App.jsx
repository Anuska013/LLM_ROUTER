import React, { useState, useMemo } from "react";
import "./App.css"; // Ensure you have Tailwind CSS set up
import openai from "openai"; // Ensure you have the OpenAI client installed


// Prompt Router Web App (single-file App component)
// - Tailwind CSS classes used for styling (assumes Tailwind installed)
// - Mock models and simulated latency/cost
// - Customizable routing rules (priority weighting: cost, latency, quality)
// - Shows chosen model, estimated latency, and cost per request
// - Export/Import rules as JSON

export default function App() {
  // --- Mock models (replace with real model data / API calls) ---
  const baseModels = [
    {
      id: "gpt-fast",
      name: "gpt-fast",
      quality: 6, // 1-10
      baseLatencyMs: 150, // median
      costPer1kTokens: 0.002, // USD per 1k tokens
    },
    {
      id: "gpt-balanced",
      name: "gpt-balanced",
      quality: 8,
      baseLatencyMs: 300,
      costPer1kTokens: 0.01,
    },
    {
      id: "gpt-high",
      name: "gpt-high",
      quality: 9.5,
      baseLatencyMs: 600,
      costPer1kTokens: 0.06,
    },
    {
      id: "gpt-special",
      name: "gpt-special",
      quality: 9.0,
      baseLatencyMs: 450,
      costPer1kTokens: 0.03,
    },
  ];

  // --- App state ---
  const [models] = useState(baseModels);
  const [prompt, setPrompt] = useState("Write a friendly product description for a wireless charger.");
  const [inputTokens, setInputTokens] = useState(40);
  const [maxTokens, setMaxTokens] = useState(120);
  const [priority, setPriority] = useState({ cost: 0.33, latency: 0.33, quality: 0.34 });
  const [history, setHistory] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null); // null -> auto-select
  const [isRunning, setIsRunning] = useState(false);
  const [rulesName, setRulesName] = useState("Default Rule Set");

  // Utility: compute score for a model given priorities
  function scoreModel(model, priorities) {
    // Lower cost and latency are better, higher quality is better
    // Normalize each metric across available models
    const costs = models.map((m) => m.costPer1kTokens);
    const latencies = models.map((m) => m.baseLatencyMs);
    const qualities = models.map((m) => m.quality);

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const minQuality = Math.min(...qualities);
    const maxQuality = Math.max(...qualities);

    // Normalized (0..1) where higher is better for all
    const normCost = maxCost === minCost ? 1 : 1 - (model.costPer1kTokens - minCost) / (maxCost - minCost);
    const normLatency = maxLatency === minLatency ? 1 : 1 - (model.baseLatencyMs - minLatency) / (maxLatency - minLatency);
    const normQuality = maxQuality === minQuality ? 1 : (model.quality - minQuality) / (maxQuality - minQuality);

    const combined = normCost * priorities.cost + normLatency * priorities.latency + normQuality * priorities.quality;
    return { combined, normCost, normLatency, normQuality };
  }

  // Auto-select best model according to current priorities
  const autoSelectedModel = useMemo(() => {
    const scored = models.map((m) => ({ m, s: scoreModel(m, priority) }));
    scored.sort((a, b) => b.s.combined - a.s.combined);
    return scored[0].m;
  }, [models, priority]);

  // Compute estimated latency and cost per request for chosen model
  function estimateForModel(model) {
    // Rough token counting: inputTokens + maxTokens (worst-case)
    const tokens = Math.max(1, inputTokens + Math.min(2000, maxTokens));
    const cost = (tokens / 1000) * model.costPer1kTokens; // USD
    const latencyMs = Math.round(model.baseLatencyMs + Math.random() * model.baseLatencyMs * 0.15); // simulate jitter
    return { tokens, cost: Number(cost.toFixed(6)), latencyMs };
  }

  // Run prompt (simulate); replace this with real API calls as needed
  async function runPrompt() {
    setIsRunning(true);
    const chosen = selectedModelId ? models.find((m) => m.id === selectedModelId) : autoSelectedModel;
    const estimate = estimateForModel(chosen);

    // Simulate latency (setTimeout)
    await new Promise((res) => setTimeout(res, estimate.latencyMs));

    // Fake result text generation
    const fakeTokensGenerated = Math.min(maxTokens, Math.round(Math.random() * maxTokens * 0.8) + 10);
    const responseText = `(${chosen.name}) Generated ~${fakeTokensGenerated} tokens. Example output:\n` +
      `"Introducing our easy-to-use wireless charger — fast, compact, and designed for daily life..."`;

    const actualCost = Number(((fakeTokensGenerated / 1000) * chosen.costPer1kTokens).toFixed(6));

    const record = {
      id: Date.now(),
      prompt: prompt.slice(0, 250),
      model: chosen.name,
      estimate,
      actual: { tokens: fakeTokensGenerated, cost: actualCost },
      timestamp: new Date().toISOString(),
      priorities: { ...priority },
      selectedManually: !!selectedModelId,
      rulesName,
      responseText,
    };

    setHistory((h) => [record, ...h].slice(0, 50));
    setIsRunning(false);
  }

  // Priority controls: sliders or quick presets
  function setPreset(preset) {
    if (preset === "cost") setPriority({ cost: 0.7, latency: 0.2, quality: 0.1 });
    if (preset === "latency") setPriority({ cost: 0.1, latency: 0.8, quality: 0.1 });
    if (preset === "quality") setPriority({ cost: 0.05, latency: 0.15, quality: 0.8 });
    if (preset === "balanced") setPriority({ cost: 0.33, latency: 0.33, quality: 0.34 });
  }

  // Import/export rules JSON
  function exportRules() {
    const payload = { name: rulesName, priority };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rulesName.replace(/\s+/g, "_") || "rules"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importRules(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        if (obj.priority) setPriority(obj.priority);
        if (obj.name) setRulesName(obj.name);
        alert("Imported rules successfully.");
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  }

  // Manual model selection toggle
  function clearManualSelection() {
    setSelectedModelId(null);
  }

  // Simple UI helpers
  function percent(n) {
    return Math.round(n * 100);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Prompt Router — Test prompts, routing, latency & cost</h1>
          <p className="text-sm text-gray-600 mt-1">Customize routing rules to prioritize cost, latency, or quality. This demo uses mocked models and simulated responses.</p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Prompt tester */}
          <section className="md:col-span-2 bg-white p-4 rounded-lg shadow">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">Prompt Tester</h2>
              <div className="text-sm text-gray-500">History saved locally (this session)</div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full mt-3 p-3 border rounded focus:outline-none focus:ring"
            />

            <div className="flex gap-3 mt-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                Input tokens
                <input type="number" min={1} value={inputTokens} onChange={(e) => setInputTokens(Number(e.target.value))} className="w-20 p-1 border rounded" />
              </label>

              <label className="flex items-center gap-2 text-sm">
                Max tokens
                <input type="number" min={1} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-20 p-1 border rounded" />
              </label>

              <label className="flex items-center gap-2 text-sm">
                Rules name
                <input value={rulesName} onChange={(e) => setRulesName(e.target.value)} className="w-48 p-1 border rounded" />
              </label>

              <div className="ml-auto flex items-center gap-2">
                <button onClick={exportRules} className="px-3 py-1 bg-sky-600 text-white rounded">Export rules</button>
                <label className="px-3 py-1 bg-gray-100 border rounded cursor-pointer">
                  Import
                  <input type="file" accept="application/json" onChange={importRules} className="hidden" />
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium text-sm">Routing priority (weights)</h4>
                <div className="mt-2 text-xs text-gray-600">Use sliders or quick presets</div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs">Cost ({percent(priority.cost)}%)</label>
                    <input type="range" min={0} max={1} step={0.01} value={priority.cost} onChange={(e) => setPriority((p) => ({ ...p, cost: Number(e.target.value) }))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs">Latency ({percent(priority.latency)}%)</label>
                    <input type="range" min={0} max={1} step={0.01} value={priority.latency} onChange={(e) => setPriority((p) => ({ ...p, latency: Number(e.target.value) }))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs">Quality ({percent(priority.quality)}%)</label>
                    <input type="range" min={0} max={1} step={0.01} value={priority.quality} onChange={(e) => setPriority((p) => ({ ...p, quality: Number(e.target.value) }))} className="w-full" />
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setPreset("cost")} className="px-2 py-1 bg-gray-100 rounded text-sm">Cost</button>
                    <button onClick={() => setPreset("latency")} className="px-2 py-1 bg-gray-100 rounded text-sm">Latency</button>
                    <button onClick={() => setPreset("quality")} className="px-2 py-1 bg-gray-100 rounded text-sm">Quality</button>
                    <button onClick={() => setPreset("balanced")} className="px-2 py-1 bg-gray-100 rounded text-sm">Balanced</button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium text-sm">Model selection</h4>
                <div className="mt-2 text-xs text-gray-600">Auto-selected model based on your routing priorities (or choose manually)</div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <input type="radio" checked={!selectedModelId} onChange={clearManualSelection} />
                    <div>
                      <div className="text-sm font-medium">Auto select</div>
                      <div className="text-xs text-gray-500">Best match: <strong>{autoSelectedModel.name}</strong></div>
                    </div>
                  </div>

                  <div className="divide-y">
                    {models.map((m) => {
                      const sc = scoreModel(m, priority);
                      const est = estimateForModel(m);
                      return (
                        <label key={m.id} className="flex items-center gap-3 py-2">
                          <input type="radio" checked={selectedModelId === m.id} onChange={() => setSelectedModelId(m.id)} />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-gray-500">Quality {m.quality} • Cost ${m.costPer1kTokens}/1k • Base latency {m.baseLatencyMs}ms</div>
                              </div>
                              <div className="text-right text-xs">
                                <div>Score: {sc.combined.toFixed(2)}</div>
                                <div>Est: {est.latencyMs}ms • ${est.cost}</div>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="text-sm text-gray-600">Selected model:</div>
              <div className="px-3 py-1 bg-white border rounded">{selectedModelId ? models.find((m)=>m.id===selectedModelId).name : `${autoSelectedModel.name} (auto)`}</div>

              <button onClick={runPrompt} disabled={isRunning} className={`ml-auto px-4 py-2 rounded text-white ${isRunning ? 'bg-gray-400' : 'bg-emerald-600'}`}>
                {isRunning ? 'Running...' : 'Run prompt'}
              </button>
            </div>

            {/* Recent results */}
            <div className="mt-4">
              <h3 className="font-semibold text-sm">Recent runs</h3>
              <div className="mt-2 space-y-2">
                {history.length === 0 && <div className="text-sm text-gray-500">No runs yet — try your first prompt.</div>}
                {history.map((r) => (
                  <div key={r.id} className="bg-white border rounded p-3">
                    <div className="flex justify-between">
                      <div className="text-sm font-medium">{r.model}</div>
                      <div className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Prompt: {r.prompt}</div>
                    <div className="text-xs mt-2 flex gap-3">
                      <div>Estimate: {r.estimate.latencyMs}ms • ${r.estimate.cost}</div>
                      <div>Actual: {r.actual.tokens} tokens • ${r.actual.cost}</div>
                      <div>Rules: {r.rulesName}</div>
                    </div>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-blue-600">View response</summary>
                      <pre className="text-xs whitespace-pre-wrap mt-2">{r.responseText}</pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* Right: model dashboard */}
          <aside className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold">Model dashboard</h3>
            <div className="mt-3 space-y-3">
              {models.map((m) => {
                const est = estimateForModel(m);
                return (
                  <div key={m.id} className="p-2 border rounded">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-500">Quality {m.quality}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>{est.latencyMs} ms</div>
                        <div>${est.cost} / request</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm">How routing works</h4>
              <p className="text-xs text-gray-600 mt-1">Each model has three normalized scores: cost (lower is better), latency (lower is better), and quality (higher is better). We compute a weighted sum using your priority weights and choose the model with the highest combined score. You can override by selecting a model manually.</p>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <div className="font-medium">Notes</div>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Cost estimates are rough — replace with real token counting and billing from your provider.</li>
                <li>Latency is simulated. Integrate real p95/p50 metrics from monitoring to route by real latency.</li>
                <li>Quality metrics are sample numbers — collect evaluation data (BLEU, human eval) to populate this field.</li>
              </ul>
            </div>
          </aside>
        </main>

        <footer className="mt-6 text-sm text-gray-600">Want me to turn this into a full repo (Vite + Tailwind + server integration)? Tell me which provider (OpenAI, Anthropic, etc.) and I will scaffold API call examples and server-side cost logging.</footer>

      </div>
    </div>
  );
}