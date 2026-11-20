import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Download,
  Image as ImageIcon,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, streamAiTutorChat } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export const AIStudioView: React.FC = () => {
  const { t, language } = useLanguage();
  const [activeTool, setActiveTool] = useState<'chat' | 'image'>('chat');

  const tutorRoles = useMemo(
    () => [
      {
        id: 'physics-tutor',
        label: t.aiStudio.roles.physicsTutorLabel,
        instruction: t.aiStudio.roles.physicsTutorInstruction,
      },
      {
        id: 'step-solver',
        label: t.aiStudio.roles.stepSolverLabel,
        instruction: t.aiStudio.roles.stepSolverInstruction,
      },
      {
        id: 'lab-coach',
        label: t.aiStudio.roles.labCoachLabel,
        instruction: t.aiStudio.roles.labCoachInstruction,
      },
    ],
    [t]
  );

  const modelOptions = useMemo(
    () => [
      { id: 'gemini-3.1-flash-lite', label: t.aiStudio.models.flashLite },
      { id: 'gemini-4-hydrogen', label: t.aiStudio.models.hydrogen },
    ],
    [t]
  );

  // Chatbot state
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('physics-tutor');
  const [customInstruction, setCustomInstruction] = useState<string>(
    t.aiStudio.roles.physicsTutorInstruction
  );
  const [isCustomEdited, setIsCustomEdited] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isCustomEdited) {
      const found = tutorRoles.find((r) => r.id === selectedRoleId);
      if (found) setCustomInstruction(found.instruction);
    }
  }, [tutorRoles, selectedRoleId, isCustomEdited]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Image generator state
  const [imgPrompt, setImgPrompt] = useState('');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '3:4'>('16:9');
  const [generatedImages, setGeneratedImages] = useState<
    Array<{ url: string; prompt: string; size: string; caption?: string }>
  >([]);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsCustomEdited(false);
    const found = tutorRoles.find((r) => r.id === roleId);
    if (found) setCustomInstruction(found.instruction);
  };

  const submitChatPrompt = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || chatLoading) return;

    const currentHistory = [...history];
    const trimmedHistory = currentHistory.slice(-6);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setHistory((prev) => [...prev, { role: 'user', text: message }]);
    setPromptInput('');
    setChatError(null);
    setRetryPrompt(null);
    setStreamingReply('');
    setChatLoading(true);

    requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    let accumulated = '';
    try {
      const result = await streamAiTutorChat({
        model: selectedModel,
        systemInstruction: customInstruction,
        history: trimmedHistory,
        message,
        lang: language,
        signal: controller.signal,
        onChunk: (delta) => {
          accumulated += delta;
          setStreamingReply(accumulated);
          threadEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        },
      });
      const finalReply = result.reply || accumulated;
      setHistory((prev) => [...prev, { role: 'model', text: finalReply }]);
      setStreamingReply('');
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    } catch (err) {
      const wasAbortedByUser = err instanceof DOMException && err.name === 'AbortError';
      if (accumulated.trim()) {
        setHistory((prev) => [...prev, { role: 'model', text: accumulated.trim() }]);
      } else {
        setHistory(currentHistory);
        setPromptInput(message);
      }
      setStreamingReply('');
      if (!wasAbortedByUser) {
        setRetryPrompt(message);
        setChatError(err instanceof Error ? err.message : 'Unable to reach Gemini tutor.');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setChatLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitChatPrompt(promptInput);
  };

  const handleStopChat = () => {
    abortControllerRef.current?.abort();
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim() || imgLoading) return;

    setImgError(null);
    setImgLoading(true);
    try {
      const data = await apiFetch<{ imageUrl: string; caption?: string }>(
        '/api/ai/generate-image',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: imgPrompt,
            imageSize,
            aspectRatio,
          }),
        }
      );
      setGeneratedImages((prev) => [
        { url: data.imageUrl, prompt: imgPrompt, size: imageSize, caption: data.caption },
        ...prev,
      ]);
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Failed to generate image.');
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.aiStudio.title}</h2>
          <p className="text-sm text-[#57534E] mt-1">{t.aiStudio.subtitle}</p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFE9DF]">
          <button
            type="button"
            onClick={() => setActiveTool('chat')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[40px] ${
              activeTool === 'chat'
                ? 'bg-white text-[#6B1118] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>{t.aiStudio.tutorChatTab}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('image')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[40px] ${
              activeTool === 'image'
                ? 'bg-white text-[#6B1118] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t.aiStudio.diagramTab}</span>
          </button>
        </div>
      </div>

      {activeTool === 'chat' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tutor Role & Model Configuration */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-[#E6DFD5] p-5 space-y-4 h-fit">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.modelLabel}
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917]"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.rolePresetLabel}
              </label>
              <select
                value={selectedRoleId}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917]"
              >
                {tutorRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.systemInstructionLabel}
              </label>
              <textarea
                rows={4}
                value={customInstruction}
                onChange={(e) => {
                  setIsCustomEdited(true);
                  setCustomInstruction(e.target.value);
                }}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 text-xs text-[#1C1917] leading-relaxed"
              />
            </div>

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  abortControllerRef.current?.abort();
                  setHistory([]);
                  setStreamingReply('');
                  setChatError(null);
                  setRetryPrompt(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] py-2.5 text-xs font-semibold text-[#57534E] hover:text-[#DC2626] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.aiStudio.clearHistory}</span>
              </button>
            )}
          </div>

          {/* Scrollable Multi-Turn Thread */}
          <div className="lg:col-span-8 rounded-2xl bg-white border border-[#E6DFD5] flex flex-col h-[580px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E6DFD5] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#57534E]">
              <span className="font-semibold text-[#6B1118]">{t.aiStudio.threadTitle}</span>
              <span className="font-mono">{selectedModel}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAF8F5]/60">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2 text-sm text-[#57534E]">
                  <Sparkles className="w-8 h-8 text-[#D9A62E]" />
                  <p className="font-semibold text-[#1C1917]">{t.aiStudio.emptyTitle}</p>
                  <p>{t.aiStudio.emptyDesc}</p>
                </div>
              ) : (
                history.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        turn.role === 'user'
                          ? 'bg-[#6B1118] text-white'
                          : 'bg-white border border-[#E6DFD5] text-[#1C1917]'
                      }`}
                    >
                      {turn.text}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  {streamingReply ? (
                    <div className="max-w-[85%] rounded-2xl bg-white border border-[#E6DFD5] px-4 py-3 text-sm leading-relaxed text-[#1C1917] whitespace-pre-wrap">
                      {streamingReply}
                      <span
                        aria-hidden="true"
                        className="inline-block w-1.5 h-4 ms-1 align-middle rounded-xs bg-[#6B1118]/70 animate-pulse"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white border border-[#E6DFD5] px-4 py-3 text-sm text-[#57534E] inline-flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6B1118] animate-bounce [animation-delay:-0.25s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9A62E] animate-bounce [animation-delay:-0.12s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6B1118] animate-bounce" />
                      </span>
                      <span>{t.aiStudio.thinking}</span>
                    </div>
                  )}
                </div>
              )}
              <div ref={threadEndRef} />
            </div>

            {chatError && (
              <div
                role="alert"
                className="px-5 py-2.5 bg-[#FEF2F2] dark:bg-[#2C1417] border-t border-[#DC2626]/30 text-xs text-[#991B1B] dark:text-[#FCA5A5] flex items-center justify-between gap-3"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-[#F87171]" />
                  <span className="break-words">{chatError}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(retryPrompt || promptInput.trim()) && (
                    <button
                      type="button"
                      disabled={chatLoading}
                      onClick={() => submitChatPrompt(retryPrompt || promptInput)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#DC2626]/30 bg-white dark:bg-[#1C1415] px-2.5 py-1 text-xs font-semibold text-[#991B1B] dark:text-[#FCA5A5] hover:bg-[#FEE2E2] dark:hover:bg-[#3B191D] disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t.aiStudio.retry}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setChatError(null);
                      setRetryPrompt(null);
                    }}
                    aria-label="Dismiss error"
                    className="p-1 rounded-md text-[#991B1B]/70 dark:text-[#FCA5A5]/70 hover:text-[#991B1B] dark:hover:text-[#FCA5A5] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSendChat}
              className="p-4 border-t border-[#E6DFD5] bg-white flex items-center gap-2.5"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={t.aiStudio.chatPlaceholder}
                className="flex-1 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[44px]"
              />
              {chatLoading ? (
                <button
                  type="button"
                  onClick={handleStopChat}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#6B1118]/30 bg-[#F9EFF0] dark:bg-[#2E191C] px-4 py-2.5 text-sm font-semibold text-[#6B1118] dark:text-[#F2A7AE] hover:bg-[#F3DFE1] dark:hover:bg-[#3B2024] cursor-pointer min-h-[44px]"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>{t.aiStudio.stop}</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!promptInput.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  <Send className="w-4 h-4 text-[#E5B742]" />
                  <span>{t.aiStudio.send}</span>
                </button>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* High-Quality Educational Diagram & Image Generator */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleGenerateImage}
            className="lg:col-span-5 rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-5 h-fit"
          >
            <div>
              <h3 className="text-lg font-bold text-[#1C1917]">{t.aiStudio.diagramTitle}</h3>
              <p className="text-xs text-[#57534E] mt-1">{t.aiStudio.diagramSub}</p>
            </div>

            {imgError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]">
                {imgError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.diagramPromptLabel}
              </label>
              <textarea
                rows={4}
                required
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder={t.aiStudio.diagramPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.resolutionLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1K', '2K', '4K'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setImageSize(sz)}
                    className={`rounded-xl border py-2.5 text-sm font-bold transition-colors cursor-pointer min-h-[44px] ${
                      imageSize === sz
                        ? 'border-[#6B1118] bg-[#6B1118] text-white'
                        : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118]/40'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {t.aiStudio.aspectRatioLabel}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['1:1', '16:9', '4:3', '3:4'] as const).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] ${
                      aspectRatio === ar
                        ? 'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118]'
                        : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={imgLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] py-3 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 cursor-pointer min-h-[46px]"
            >
              <Sparkles className="w-4 h-4 text-[#E5B742]" />
              <span>
                {imgLoading
                  ? formatMsg(t.aiStudio.generatingBtn, { size: imageSize })
                  : formatMsg(t.aiStudio.generateBtn, { size: imageSize })}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {generatedImages.length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#E6DFD5] p-12 text-center space-y-2">
                <ImageIcon className="w-10 h-10 text-[#D9A62E] mx-auto" />
                <p className="text-base font-semibold text-[#1C1917]">
                  {t.aiStudio.noVisualsTitle}
                </p>
                <p className="text-sm text-[#57534E]">{t.aiStudio.noVisualsDesc}</p>
              </div>
            ) : (
              generatedImages.map((img, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white border border-[#E6DFD5] p-4 space-y-3"
                >
                  <img
                    src={img.url}
                    alt={img.prompt}
                    referrerPolicy="no-referrer"
                    className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] object-contain max-h-[520px]"
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#57534E] flex-1">
                        <strong className="text-[#6B1118]">{img.size}</strong> · {img.prompt}
                      </p>
                      <a
                        href={img.url}
                        download={`grade9hub-diagram-${img.size}.${img.url.startsWith('data:image/svg+xml') ? 'svg' : 'png'}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t.aiStudio.download}</span>
                      </a>
                    </div>
                    {img.caption && (
                      <p className="text-xs text-[#57534E] bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg px-3 py-2">
                        {img.caption}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
