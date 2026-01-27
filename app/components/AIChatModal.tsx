
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Loader2, User, Bot, Trash2, MinusCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClearContext: () => void;
    contextText: string;
    contextCount: number;
}

interface Message {
    role: 'user' | 'model';
    content: string;
}

export default function AIChatModal({ isOpen, onClose, onClearContext, contextText, contextCount }: AIChatModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Scroll to bottom when messages change
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading, isOpen]);

    // Reset only on hard close/unmount, NOT on open (to keep history if just hidden, though isOpen controls render)
    // Actually if isOpen becomes false from parent, component might unmount or just hide.
    // If it's conditional render {show && <Modal/>}, state is lost.
    // User wants PERSISTENCE. MinutesState keeps <Modal> rendered? 
    // In MinutesState: {showAIChat && (...)} -> This UNMOUNTS.
    // To fix persistence, we must change MinutesState to ALWAYS render Modal but hide via CSS?
    // OR: Move state up.
    // User said: "Now I back, it lost all".
    // My plan: Open Link in NEW TAB -> User never leaves dashboard -> Component never unmounts -> State preserved.
    // So current conditional render is fine AS LONG AS user doesn't navigate away.

    const handleSendMessage = async () => {
        if (!inputValue.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setLoading(true);

        try {
            // Send request with history
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: contextText,
                    question: userMsg.content,
                    mode: 'qa',
                    history: messages // Send previous messages
                })
            });
            const data = await res.json();
            const aiMsg: Message = { role: 'model', content: data.summary || "Lỗi: Không nhận được phản hồi." };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', content: "Error: " + e.message }]);
        } finally {
            setLoading(false);
        }
    };

    // Helper to transform [[id|text]] into markdown links
    const processCitations = (text: string) => {
        return text.replace(/\[\[(.*?)\|(.*?)\]\]/g, (match, id, snippet) => {
            return `[${snippet}](/minutes/${id}?highlight=${encodeURIComponent(snippet)})`;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        Hỏi đáp thông minh
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-full border border-slate-200 font-medium mr-2">
                            <span>{contextCount} nguồn</span>
                            {contextCount > 0 && (
                                <button
                                    onClick={onClearContext}
                                    className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors ml-1"
                                    title="Bỏ chọn tất cả & Đóng"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Clear History */}
                        {messages.length > 0 && (
                            <button
                                onClick={() => setMessages([])}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                                title="Xóa lịch sử trò chuyện"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}

                        {/* Close Modal Only */}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Đóng cửa sổ (Giữ chat)">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 p-4 overflow-y-auto bg-slate-50 scrollbar-thin scrollbar-thumb-slate-200 relative">
                    {messages.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-6">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center animate-pulse">
                                <Sparkles className="w-10 h-10 text-indigo-500" />
                            </div>
                            <div className="text-center space-y-2 max-w-sm px-4">
                                <p className="text-lg font-medium text-slate-600">AI đã sẵn sàng!</p>
                                <p className="text-sm">Hãy đặt câu hỏi về <strong>{contextCount} cuộc họp</strong> bạn đã chọn.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'model' && (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                                            <Sparkles className="w-4 h-4 text-indigo-600" />
                                        </div>
                                    )}

                                    <div className={`
                                        max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                                        ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none prose prose-sm max-w-none'
                                        }
                                    `}>
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : (
                                            <ReactMarkdown
                                                components={{
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-indigo-900" {...props} />,
                                                    a: ({ node, href, children, ...props }) => (
                                                        <a
                                                            href={href}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (href) {
                                                                    // Open in NEW TAB to preserve chat state
                                                                    window.open(href, '_blank');
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors no-underline border border-indigo-200 mx-1 cursor-pointer select-none"
                                                            title="Mở trong tab mới"
                                                            {...props}
                                                        >
                                                            {children} <span className="text-[10px]">↗</span>
                                                        </a>
                                                    )
                                                }}
                                            >
                                                {processCitations(msg.content)}
                                            </ReactMarkdown>
                                        )}
                                    </div>

                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                                            <User className="w-4 h-4 text-slate-500" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                        <span className="text-slate-400 text-xs">Đang suy nghĩ...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Footer Input */}
                <div className="p-4 bg-white border-t">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                            placeholder="Nhập câu hỏi... (Shift+Enter để xuống dòng)"
                            className="w-full pl-5 pr-14 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-sm"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={loading || !inputValue.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1">
                        <Sparkles className="w-3 h-3" /> Powered by Gemini AI
                    </p>
                </div>
            </div>
        </div>
    );
}
