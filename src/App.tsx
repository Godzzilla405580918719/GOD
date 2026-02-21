import { FormEvent, useEffect, useMemo, useState } from 'react';
import { defaultTasks, runAutomation } from './automation';
import { defaultLlmSettings, requestChatCompletion, testConnector } from './llm';
import { ApprovalRequest, AuditEntry, AutomationTask, LlmSettings, Message } from './types';

const SETTINGS_KEY = 'god-llm-settings-v1';
const TASKS_KEY = 'god-automation-tasks-v1';
const REQUESTS_KEY = 'god-elevation-requests-v1';
const AUDIT_KEY = 'god-elevation-audit-v1';

type ConnectorPreset = 'ollama' | 'openai' | 'gemini';

const PRESET_CONFIG: Record<ConnectorPreset, Pick<LlmSettings, 'endpoint' | 'model'>> = {
  ollama: {
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: 'tinyllama'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash'
  }
};

function buildAttachBookmarklet(appUrl: string): string {
  const script = `(()=>{const APP_URL=${JSON.stringify(appUrl)};const ID='god-attach-root';const old=document.getElementById(ID);if(old){old.remove();return;}const host=document.createElement('div');host.id=ID;host.style.cssText='position:fixed;right:16px;bottom:16px;width:min(420px,95vw);height:min(72vh,720px);z-index:2147483647;border:1px solid #334155;border-radius:12px;overflow:hidden;box-shadow:0 16px 44px rgba(2,6,23,.55);background:#020617;resize:both;';const bar=document.createElement('div');bar.style.cssText='height:34px;background:#0f172a;color:#e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;font:12px Segoe UI,sans-serif;';bar.textContent='GOD';const close=document.createElement('button');close.textContent='×';close.style.cssText='border:none;background:transparent;color:#e5e7eb;font-size:18px;line-height:1;cursor:pointer;';close.onclick=()=>host.remove();bar.appendChild(close);const frame=document.createElement('iframe');frame.src=APP_URL;frame.style.cssText='width:100%;height:calc(100% - 34px);border:none;background:#020617;';host.appendChild(bar);host.appendChild(frame);document.body.appendChild(host);let drag=false,dx=0,dy=0;bar.addEventListener('mousedown',e=>{drag=true;const r=host.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;});window.addEventListener('mousemove',e=>{if(!drag)return;host.style.left=Math.max(0,e.clientX-dx)+'px';host.style.top=Math.max(0,e.clientY-dy)+'px';host.style.right='auto';host.style.bottom='auto';});window.addEventListener('mouseup',()=>{drag=false;});})();`;
  return `javascript:${script}`;
}

function newMessage(role: Message['role'], content: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    newMessage('assistant', 'GOD online. I can assist with planning, coding, and safe automation flows.')
  ]);
  const [prompt, setPrompt] = useState('');
  const [pastedPageText, setPastedPageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<AutomationTask[]>(defaultTasks);
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(defaultLlmSettings);
  const [connectorPreset, setConnectorPreset] = useState<ConnectorPreset>('ollama');
  const [testingConnector, setTestingConnector] = useState(false);
  const [connectorStatus, setConnectorStatus] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCommand, setNewTaskCommand] = useState('');
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestCommand, setRequestCommand] = useState('');
  const [floatMode, setFloatMode] = useState(false);
  const [miniAttach, setMiniAttach] = useState(false);
  const [ultraMiniAttach, setUltraMiniAttach] = useState(false);
  const [fullScreenFloat, setFullScreenFloat] = useState(false);
  const [floatPosition, setFloatPosition] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [attachStatus, setAttachStatus] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<LlmSettings>;
      setLlmSettings((prev) => ({
        endpoint: parsed.endpoint ?? prev.endpoint,
        model:
          (parsed.model === 'llama3.1' || parsed.model === 'mistral') &&
          (parsed.endpoint ?? prev.endpoint).includes('localhost:11434')
            ? 'tinyllama'
            : (parsed.model ?? prev.model),
        apiKey: parsed.apiKey?.trim() ? parsed.apiKey : prev.apiKey,
        systemPrompt: parsed.systemPrompt ?? prev.systemPrompt
      }));
    } catch {
      localStorage.removeItem(SETTINGS_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(llmSettings));
  }, [llmSettings]);

  useEffect(() => {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AutomationTask[];
      const sanitized = parsed.filter((task) => task.id && task.name && task.command);
      if (sanitized.length > 0) {
        setTasks(sanitized);
      }
    } catch {
      localStorage.removeItem(TASKS_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const raw = localStorage.getItem(REQUESTS_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ApprovalRequest[];
      const sanitized = parsed.filter((request) => request.id && request.title && request.command);
      setPendingRequests(sanitized);
    } catch {
      localStorage.removeItem(REQUESTS_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(pendingRequests));
  }, [pendingRequests]);

  useEffect(() => {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuditEntry[];
      const sanitized = parsed.filter((entry) => entry.id && entry.requestId && entry.title);
      setAuditLog(sanitized);
    } catch {
      localStorage.removeItem(AUDIT_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog));
  }, [auditLog]);

  useEffect(() => {
    if (!dragging || !floatMode) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const horizontalOverflow = ultraMiniAttach ? 260 : miniAttach ? 220 : fullScreenFloat ? 0 : 140;
      const verticalOverflow = ultraMiniAttach ? 320 : miniAttach ? 260 : fullScreenFloat ? 0 : 140;
      const minX = -horizontalOverflow;
      const maxX = window.innerWidth - 120 + horizontalOverflow;
      const minY = ultraMiniAttach ? -180 : miniAttach ? -120 : fullScreenFloat ? 0 : -36;
      const maxY = window.innerHeight - 80 + verticalOverflow;
      const nextX = Math.max(minX, Math.min(maxX, event.clientX - dragOffset.x));
      const nextY = Math.max(minY, Math.min(maxY, event.clientY - dragOffset.y));
      setFloatPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      setDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragOffset.x, dragOffset.y, dragging, floatMode, miniAttach, ultraMiniAttach, fullScreenFloat]);

  useEffect(() => {
    if (llmSettings.endpoint.includes('generativelanguage.googleapis.com')) {
      setConnectorPreset('gemini');
      return;
    }

    if (llmSettings.endpoint.includes('api.openai.com')) {
      setConnectorPreset('openai');
      return;
    }

    if (llmSettings.endpoint.includes('localhost:11434')) {
      setConnectorPreset('ollama');
    }
  }, [llmSettings.endpoint]);

  const status = useMemo(() => {
    const enabled = tasks.filter((task) => task.enabled).length;
    return `${enabled} task${enabled === 1 ? '' : 's'} | Automation-Only Mode ✅`;
  }, [tasks]);

  const extractFirstUrl = (value: string): string | null => {
    const match = value.match(/https?:\/\/[^\s]+/i);
    return match?.[0] ?? null;
  };

  const htmlToText = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    return (doc.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
  };

  const buildGroundedPromptFromUrl = async (
    originalPrompt: string,
    manualPageText: string
  ): Promise<{ promptForModel: string; blockerMessage?: string }> => {
    const pasted = manualPageText.trim();
    if (pasted.length > 0) {
      const clipped = pasted.slice(0, 16000);
      return {
        promptForModel: `${originalPrompt}\n\nGrounding content (pasted by user):\n${clipped}\n\nImportant: Answer ONLY using the grounding content above. If an answer is not present, respond: "Not found in provided page content."`
      };
    }

    const url = extractFirstUrl(originalPrompt);
    if (!url) {
      return { promptForModel: originalPrompt };
    }

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        return {
          promptForModel: originalPrompt,
          blockerMessage: `I couldn’t read that webpage directly (HTTP ${response.status}). Paste the page text here and I’ll answer from it exactly.`
        };
      }

      const html = await response.text();
      const pageText = htmlToText(html);
      if (!pageText || pageText.length < 120) {
        return {
          promptForModel: originalPrompt,
          blockerMessage:
            'I couldn’t extract readable text from that webpage (possibly login/CORS-protected). Paste the page text here and I’ll answer precisely from it.'
        };
      }

      const clipped = pageText.slice(0, 12000);
      const promptForModel = `${originalPrompt}\n\nGrounding content from URL:\n${clipped}\n\nImportant: Answer ONLY using the grounding content above. If an answer is not present, respond: "Not found in provided page content."`;
      return { promptForModel };
    } catch {
      return {
        promptForModel: originalPrompt,
        blockerMessage:
          'I can’t access that webpage from the browser environment (likely CORS/auth restriction). Paste the page text here and I will answer without making things up.'
      };
    }
  };

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || busy) {
      return;
    }

    const lower = trimmed.toLowerCase();
    const blocked = ['admin rights', 'administrator rights', 'privilege escalation', 'reverse engineer'];
    const matchedBlocked = blocked.filter((token) => lower.includes(token));
    let safetyNote: Message | null = null;
    if (matchedBlocked.length > 0) {
      const request: ApprovalRequest = {
        id: crypto.randomUUID(),
        title: 'Prompt-based elevated troubleshooting request',
        command: trimmed,
        source: 'prompt',
        createdAt: new Date().toISOString()
      };
      setPendingRequests((prev) => [request, ...prev]);
      safetyNote = newMessage(
        'system',
        `Safety note: matched review keywords (${matchedBlocked.join(', ')}). Request was queued for manual approval, but this run continues in classroom mode.`
      );
    }

    const userMessage = newMessage('user', trimmed);
    const baseMessages = safetyNote ? [...messages, safetyNote, userMessage] : [...messages, userMessage];
    setBusy(true);
    setMessages(baseMessages);
    setPrompt('');
    let automationOutput: string[] = [];

    try {
      automationOutput = await runAutomation(trimmed, tasks);
      const { promptForModel, blockerMessage } = await buildGroundedPromptFromUrl(trimmed, pastedPageText);
      if (blockerMessage) {
        const fallbackTrace = automationOutput.length
          ? ['', 'Automation trace:', ...automationOutput.map((line) => `- ${line}`)].join('\n')
          : '';
        setMessages((prev) => [...prev, newMessage('assistant', `${blockerMessage}${fallbackTrace}`)]);
        return;
      }

      const modelMessages = [...messages, newMessage('user', promptForModel)];
      const modelResponse = await requestChatCompletion(modelMessages, llmSettings);
      const response = [modelResponse, '', 'Automation trace:', ...automationOutput.map((line) => `- ${line}`)].join(
        '\n'
      );
      setMessages((prev) => [...prev, newMessage('assistant', response)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connector error.';
      const fallbackTrace = automationOutput.length
        ? ['', 'Automation trace (fallback mode):', ...automationOutput.map((line) => `- ${line}`)].join('\n')
        : '';
      setMessages((prev) => [
        ...prev,
        newMessage(
          'assistant',
          `Model response unavailable. Running automation-only mode for this request.\n\n${message}${fallbackTrace}`
        )
      ]);
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, enabled: !task.enabled } : task)));
  };

  const addTask = () => {
    const name = newTaskName.trim();
    const command = newTaskCommand.trim();
    if (!name || !command) {
      return;
    }

    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        command,
        enabled: true
      }
    ]);
    setNewTaskName('');
    setNewTaskCommand('');
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const resetTasksToDefaults = () => {
    setTasks(defaultTasks.map((task) => ({ ...task })));
    setNewTaskName('');
    setNewTaskCommand('');
  };

  const applyPreset = (preset: ConnectorPreset) => {
    setConnectorPreset(preset);
    const values = PRESET_CONFIG[preset];
    setLlmSettings((prev) => ({
      ...prev,
      endpoint: values.endpoint,
      model: values.model
    }));
    setConnectorStatus(`Preset loaded: ${preset}`);
  };

  const runConnectorTest = async () => {
    if (testingConnector) {
      return;
    }

    setTestingConnector(true);
    setConnectorStatus('Testing connector...');

    try {
      const result = await testConnector(llmSettings);
      setConnectorStatus(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connector test error.';
      setConnectorStatus(message);
    } finally {
      setTestingConnector(false);
    }
  };

  const clearSavedKey = () => {
    setLlmSettings((prev) => ({
      ...prev,
      apiKey: ''
    }));
    setConnectorStatus('Saved API key cleared.');
  };

  const resetConnectorSettings = () => {
    localStorage.removeItem(SETTINGS_KEY);
    setLlmSettings({
      ...defaultLlmSettings,
      apiKey: defaultLlmSettings.apiKey
    });
    setConnectorPreset('ollama');
    setConnectorStatus('Connector settings reset to safe defaults.');
  };

  const startDrag = (event: React.MouseEvent<HTMLElement>) => {
    if (!floatMode || fullScreenFloat) {
      return;
    }

    setDragging(true);
    setDragOffset({
      x: event.clientX - floatPosition.x,
      y: event.clientY - floatPosition.y
    });
  };

  const copyAttachBookmarklet = async () => {
    const appUrl = `${window.location.origin}/`;
    const bookmarklet = buildAttachBookmarklet(appUrl);

    try {
      await navigator.clipboard.writeText(bookmarklet);
      setAttachStatus('Attach bookmarklet copied. Add it as a bookmark URL in your browser.');
    } catch {
      setAttachStatus('Clipboard blocked by browser policy. Allow clipboard access and click again.');
    }
  };

  const addManualRequest = () => {
    const title = requestTitle.trim();
    const command = requestCommand.trim();

    if (!title || !command) {
      return;
    }

    const request: ApprovalRequest = {
      id: crypto.randomUUID(),
      title,
      command,
      source: 'manual',
      createdAt: new Date().toISOString()
    };

    setPendingRequests((prev) => [request, ...prev]);
    setRequestTitle('');
    setRequestCommand('');
  };

  const decideRequest = (requestId: string, decision: AuditEntry['decision']) => {
    setPendingRequests((prev) => {
      const found = prev.find((request) => request.id === requestId);
      if (!found) {
        return prev;
      }

      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        requestId: found.id,
        title: found.title,
        command: found.command,
        source: found.source,
        decision,
        decidedAt: new Date().toISOString()
      };

      setAuditLog((current) => [entry, ...current].slice(0, 120));
      setMessages((current) => [
        ...current,
        newMessage(
          'system',
          `${decision.toUpperCase()}: ${found.title}\nCommand: ${found.command}\nSource: ${found.source}`
        )
      ]);

      return prev.filter((request) => request.id !== requestId);
    });
  };

  const clearPendingRequests = () => {
    setPendingRequests([]);
  };

  const clearAuditLog = () => {
    setAuditLog([]);
  };

  const clearAllReviewData = () => {
    setPendingRequests([]);
    setAuditLog([]);
  };

  return (
    <>
      <button
        type="button"
        className="ultra-attach-btn"
        onClick={() => {
          setFloatMode(true);
          setMiniAttach(false);
          setUltraMiniAttach(true);
          setFullScreenFloat(false);
          setFloatPosition({ x: window.innerWidth - 210, y: window.innerHeight - 330 });
          setDragging(false);
        }}
      >
        🧷 Ultra Mini
      </button>

      <button
        type="button"
        className="full-float-btn"
        onClick={() => {
          setFloatMode(true);
          setMiniAttach(false);
          setUltraMiniAttach(false);
          setFullScreenFloat(true);
          setFloatPosition({ x: 0, y: 0 });
          setDragging(false);
        }}
      >
        🪟 Full Float
      </button>

      <button
        type="button"
        className="mini-attach-btn"
        onClick={() => {
          setFloatMode(true);
          setMiniAttach(true);
          setUltraMiniAttach(false);
          setFullScreenFloat(false);
          setFloatPosition({ x: window.innerWidth - 270, y: window.innerHeight - 430 });
          setDragging(false);
        }}
      >
        📌 Mini Attach
      </button>

      <button
        type="button"
        className="float-toggle"
        onClick={() => {
          setFloatMode((prev) => !prev);
          setMiniAttach(false);
          setUltraMiniAttach(false);
          setFullScreenFloat(false);
          setDragging(false);
        }}
      >
        {floatMode ? 'Dock GOD' : 'Float GOD'}
      </button>

      <div
        className={`app-shell${floatMode ? ' floating' : ''}${miniAttach ? ' mini' : ''}${ultraMiniAttach ? ' ultra-mini' : ''}${fullScreenFloat ? ' fullscreen' : ''}`}
        style={floatMode ? { left: floatPosition.x, top: floatPosition.y } : undefined}
      >
      <aside className="sidebar">
        <div className="brand">GOD</div>
        <div className="sub">Portable AI Console</div>
        <div className="status">{status}</div>
        <h3>Connector</h3>
        <div className="connector-grid">
          <label>
            Preset
            <select
              value={connectorPreset}
              onChange={(event) => applyPreset(event.target.value as ConnectorPreset)}
            >
              <option value="ollama">Ollama (local)</option>
              <option value="openai">OpenAI compatible</option>
              <option value="gemini">Gemini API</option>
            </select>
          </label>
          <label>
            Endpoint
            <input
              value={llmSettings.endpoint}
              onChange={(event) => setLlmSettings((prev) => ({ ...prev, endpoint: event.target.value }))}
              placeholder="http://localhost:11434/v1/chat/completions"
            />
          </label>
          <label>
            Model
            <input
              value={llmSettings.model}
              onChange={(event) => setLlmSettings((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="llama3.1"
            />
          </label>
          <label>
            API Key (optional)
            <input
              type="password"
              value={llmSettings.apiKey}
              onChange={(event) => setLlmSettings((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder="API key"
            />
          </label>
          <label>
            System Prompt
            <textarea
              value={llmSettings.systemPrompt}
              onChange={(event) => setLlmSettings((prev) => ({ ...prev, systemPrompt: event.target.value }))}
              rows={3}
            />
          </label>
          <div className="connector-actions">
            <button type="button" onClick={runConnectorTest} disabled={testingConnector}>
              {testingConnector ? 'Testing...' : 'Test Connector'}
            </button>
            <button type="button" onClick={clearSavedKey} className="connector-reset">
              Clear Saved Key
            </button>
            <button type="button" onClick={resetConnectorSettings} className="connector-reset">
              Reset Connector
            </button>
          </div>
          {connectorStatus ? <div className="connector-status">{connectorStatus}</div> : null}
        </div>
        <h3>Automation</h3>
        <div className="task-builder">
          <input
            value={newTaskName}
            onChange={(event) => setNewTaskName(event.target.value)}
            placeholder="Task name"
          />
          <input
            value={newTaskCommand}
            onChange={(event) => setNewTaskCommand(event.target.value)}
            placeholder="Task command"
          />
          <button type="button" onClick={addTask} disabled={!newTaskName.trim() || !newTaskCommand.trim()}>
            Add Task
          </button>
          <button type="button" className="connector-reset" onClick={resetTasksToDefaults}>
            Reset Tasks (One Click)
          </button>
        </div>
        <div className="task-list">
          {tasks.map((task) => (
            <div key={task.id} className="task-item">
              <label className="task-main">
                <input type="checkbox" checked={task.enabled} onChange={() => toggleTask(task.id)} />
                <span>
                  <strong>{task.name}</strong>
                  <small>{task.command}</small>
                </span>
              </label>
              <button type="button" className="task-remove" onClick={() => removeTask(task.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <h3>Browser Attach</h3>
        <div className="attach-tools">
          <button type="button" onClick={copyAttachBookmarklet}>
            Copy Attach Bookmarklet
          </button>
          <small>Use in any browser tab to toggle a floating GOD panel.</small>
          {attachStatus ? <small>{attachStatus}</small> : null}
        </div>

        <h3>Elevation Approval</h3>
        <div className="connector-actions">
          <button type="button" className="connector-reset" onClick={clearAllReviewData}>
            Clear All Review Data
          </button>
          <button type="button" className="connector-reset" onClick={clearPendingRequests}>
            Clear Queue
          </button>
        </div>
        <div className="request-builder">
          <input
            value={requestTitle}
            onChange={(event) => setRequestTitle(event.target.value)}
            placeholder="Request title"
          />
          <input
            value={requestCommand}
            onChange={(event) => setRequestCommand(event.target.value)}
            placeholder="Command or action to review"
          />
          <button type="button" onClick={addManualRequest} disabled={!requestTitle.trim() || !requestCommand.trim()}>
            Queue Request
          </button>
        </div>

        <div className="request-list">
          {pendingRequests.length === 0 ? <small>No pending requests.</small> : null}
          {pendingRequests.map((request) => (
            <div key={request.id} className="request-item">
              <div>
                <strong>{request.title}</strong>
                <small>{request.command}</small>
                <small>Source: {request.source}</small>
              </div>
              <div className="request-actions">
                <button type="button" className="approve" onClick={() => decideRequest(request.id, 'approved')}>
                  Approve
                </button>
                <button type="button" className="deny" onClick={() => decideRequest(request.id, 'denied')}>
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>

        <h3>Audit Log</h3>
        <div className="connector-actions">
          <button type="button" className="connector-reset" onClick={clearAuditLog}>
            Clear Audit
          </button>
        </div>
        <div className="audit-list">
          {auditLog.length === 0 ? <small>No decisions logged yet.</small> : null}
          {auditLog.slice(0, 10).map((entry) => (
            <div key={entry.id} className="audit-item">
              <strong>{entry.decision.toUpperCase()}</strong>
              <small>{entry.title}</small>
              <small>{new Date(entry.decidedAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-panel">
        <header className={`header${floatMode ? ' draggable' : ''}`} onMouseDown={startDrag}>
          <h1>GOD Assistant</h1>
          <p>Local-first, portable, safety-restricted automation assistant.</p>
        </header>

        <section className="chat-area">
          {messages.map((message) => (
            <article key={message.id} className={`bubble ${message.role}`}>
              <div className="meta">{message.role.toUpperCase()}</div>
              <pre>{message.content}</pre>
            </article>
          ))}
        </section>

        <form onSubmit={submitPrompt} className="composer">
          <textarea
            className="composer-page-text"
            placeholder="Paste webpage text here for exact grounded answers (optional but recommended for protected pages)"
            value={pastedPageText}
            onChange={(event) => setPastedPageText(event.target.value)}
            rows={4}
          />
          <textarea
            placeholder="Type your prompt for GOD..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
          />
          <button type="submit" disabled={busy || !prompt.trim()}>
            {busy ? 'Running...' : 'Run'}
          </button>
        </form>
      </main>
      </div>
    </>
  );
}
