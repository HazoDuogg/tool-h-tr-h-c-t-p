'use client';

import React, { useState } from 'react';
import {
    BookOpen,
    Sparkles,
    Send,
    CheckSquare,
    Code,
    ArrowLeft,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Layers,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace.store';
import { apiRequest } from '../../lib/api-client';

interface ChatMessage {
    role: 'student' | 'mentor';
    content: string;
}

interface VisualLesson {
    officialSource: string;
    tldr: string;
    visualDiagram: string;
    keyPoints: string[];
    badCode: string;
    cleanCode: string;
    whyBetter: string;
    commonPitfall: string;
    microPractice: string;
}

export const SocraticMentorPanel: React.FC = () => {
    const { getActiveModule, files, activeFile } = useWorkspaceStore();
    const activeModule = getActiveModule();

    const [activeTab, setActiveTab] = useState<'concepts' | 'mentor'>('concepts');
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
    const [lessonCache, setLessonCache] = useState<Record<string, VisualLesson>>({});
    const [isLessonLoading, setIsLessonLoading] = useState(false);
    const [lessonError, setLessonError] = useState<string | null>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'mentor',
            content:
                'Chào bạn! Tôi là Giảng viên Socratic. Tôi sẽ không viết code thay bạn, nhưng sẽ giúp bạn bóc tách bản chất vấn đề, luồng dữ liệu và cách tổ chức Clean Code. Bạn đang vướng ở bước tư duy nào?',
        },
    ]);
    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!activeModule) {
        return (
            <div className="p-4 text-sm text-slate-400">
                Hãy chọn một chương học đã mở khóa để xem tài liệu và trao đổi với Giảng viên.
            </div>
        );
    }

    const handleOpenConceptLesson = async (conceptTitle: string) => {
        setSelectedConcept(conceptTitle);
        setLessonError(null);

        const cacheKey = `${activeModule.id}:${conceptTitle}`;
        if (lessonCache[cacheKey]) return;

        setIsLessonLoading(true);
        try {
            const lesson = await apiRequest<VisualLesson>('/tracks/concept/explain', {
                method: 'POST',
                body: JSON.stringify({
                    moduleId: activeModule.id,
                    conceptTitle,
                }),
            });
            setLessonCache((prev) => ({ ...prev, [cacheKey]: lesson }));
        } catch (err) {
            setLessonError(
                err instanceof Error ? err.message : 'Không thể tải giáo trình trực quan lúc này.'
            );
        } finally {
            setIsLessonLoading(false);
        }
    };

    const handleSendQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || isLoading) return;

        const userMsg = question.trim();
        setMessages((prev) => [...prev, { role: 'student', content: userMsg }]);
        setQuestion('');
        setIsLoading(true);

        try {
            const currentCode = `// File: ${activeFile}\n${files[activeFile] || ''}`;
            const res = await apiRequest<{ reply: string }>('/tracks/mentor/ask', {
                method: 'POST',
                body: JSON.stringify({
                    moduleId: activeModule.id,
                    currentCode,
                    question: userMsg,
                }),
            });

            setMessages((prev) => [...prev, { role: 'mentor', content: res.reply }]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'mentor',
                    content:
                        err instanceof Error
                            ? `Lỗi: ${err.message}`
                            : 'Không thể kết nối với Giảng viên lúc này.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const currentCacheKey = selectedConcept ? `${activeModule.id}:${selectedConcept}` : '';
    const currentLesson = currentCacheKey ? lessonCache[currentCacheKey] : undefined;

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {/* Header chuyển đổi Tab */}
            <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950">
                <button
                    onClick={() => setActiveTab('concepts')}
                    className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition ${activeTab === 'concepts'
                        ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <BookOpen className="w-4 h-4" />
                    Bản chất & Clean Code
                </button>

                <button
                    onClick={() => setActiveTab('mentor')}
                    className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition ${activeTab === 'mentor'
                        ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    Hỏi Giảng viên AI
                </button>
            </div>

            {/* Tab 1: Danh sách chủ đề hoặc Thẻ Giáo trình Trực quan */}
            {activeTab === 'concepts' && !selectedConcept && (
                <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5" />
                                1. Bản chất & Cơ chế hoạt động
                            </h3>
                            <span className="text-[10px] text-slate-400 italic">Bấm để xem sơ đồ</span>
                        </div>
                        <ul className="space-y-2 text-slate-200 text-xs leading-relaxed">
                            {(activeModule.coreConcepts || []).map((concept, idx) => (
                                <li key={idx}>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenConceptLesson(concept)}
                                        className="w-full text-left p-2.5 bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/60 rounded flex items-center justify-between gap-2 transition group"
                                    >
                                        <span>{concept}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white shrink-0 transition">
                                            Học nhanh →
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                            <Code className="w-3.5 h-3.5" />
                            2. Tiêu chuẩn Clean Code & Tổ chức cấu trúc
                        </h3>
                        <ul className="space-y-2 text-slate-300 text-xs leading-relaxed">
                            {(activeModule.cleanCodeRules || []).map((rule, idx) => (
                                <li
                                    key={idx}
                                    className="p-2.5 bg-emerald-950/20 border border-emerald-900/50 rounded text-emerald-200"
                                >
                                    • {rule}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            3. Bài tập rèn tư duy phân tích (Tự code trên IDE)
                        </h3>
                        <div className="space-y-2 text-xs text-slate-300">
                            {(activeModule.practicePrompts || []).map((prompt, idx) => (
                                <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded">
                                    <span className="font-semibold text-amber-400">Bài {idx + 1}: </span>
                                    {prompt}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Chế độ xem Giáo trình Trực quan khi bấm vào 1 chủ đề */}
            {activeTab === 'concepts' && selectedConcept && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                    <button
                        type="button"
                        onClick={() => setSelectedConcept(null)}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-white font-medium transition"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Quay lại danh sách chương
                    </button>

                    <div className="pb-2 border-b border-slate-800">
                        <h3 className="text-sm font-bold text-white leading-snug">{selectedConcept}</h3>
                        {currentLesson && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                                Nguồn chuẩn: {currentLesson.officialSource}
                            </span>
                        )}
                    </div>

                    {isLessonLoading && (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                            <span>Đang vẽ sơ đồ minh họa & tóm tắt kiến thức...</span>
                        </div>
                    )}

                    {lessonError && (
                        <div className="p-3 rounded bg-red-950/40 border border-red-800 text-red-300">
                            {lessonError}
                        </div>
                    )}

                    {currentLesson && !isLessonLoading && (
                        <div className="space-y-4">
                            {/* 1. Tóm tắt 1 câu */}
                            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/40 text-indigo-100 font-medium leading-relaxed">
                                💡 {currentLesson.tldr}
                            </div>

                            {/* 2. Sơ đồ minh họa trực quan */}
                            <div>
                                <div className="text-[11px] font-bold uppercase text-cyan-400 mb-1.5 flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" />
                                    Sơ đồ cơ chế hoạt động
                                </div>
                                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
                                    {currentLesson.visualDiagram}
                                </pre>
                            </div>

                            {/* 3. 3 Ý cốt lõi siêu ngắn */}
                            <div>
                                <div className="text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                                    3 Điểm cốt lõi cần nhớ
                                </div>
                                <ul className="space-y-1.5">
                                    {currentLesson.keyPoints.map((pt, i) => (
                                        <li
                                            key={i}
                                            className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-200"
                                        >
                                            <span className="text-indigo-400 font-bold mr-1.5">0{i + 1}.</span>
                                            {pt}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* 4. So sánh trực diện Bad Code vs Clean Code */}
                            <div className="space-y-2">
                                <div className="text-[11px] font-bold uppercase text-emerald-400">
                                    Minh họa thực tế: Tránh vs Chuẩn
                                </div>

                                <div className="rounded-lg border border-red-900/60 bg-red-950/15 overflow-hidden">
                                    <div className="px-2.5 py-1 bg-red-950/40 text-red-300 font-semibold flex items-center gap-1 text-[11px]">
                                        <XCircle className="w-3.5 h-3.5" /> Tránh viết (Dễ lỗi / Rối)
                                    </div>
                                    <pre className="p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto">
                                        {currentLesson.badCode}
                                    </pre>
                                </div>

                                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/15 overflow-hidden">
                                    <div className="px-2.5 py-1 bg-emerald-950/40 text-emerald-300 font-semibold flex items-center gap-1 text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Clean Code (Chuẩn kỹ sư)
                                    </div>
                                    <pre className="p-2.5 text-[11px] font-mono text-emerald-100 overflow-x-auto">
                                        {currentLesson.cleanCode}
                                    </pre>
                                </div>

                                <p className="text-[11px] text-emerald-300/90 italic">
                                    ✓ {currentLesson.whyBetter}
                                </p>
                            </div>

                            {/* 5. Bẫy lỗi thường gặp */}
                            <div className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-800/60 text-amber-200 flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold text-amber-400">Bẫy lỗi hay gặp: </span>
                                    {currentLesson.commonPitfall}
                                </div>
                            </div>

                            {/* 6. Bài luyện nhanh 3 dòng */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-indigo-800/50">
                                <div className="font-bold text-indigo-400 mb-1">⚡ Thử tay ngay trên IDE:</div>
                                <p className="text-slate-300 leading-relaxed">{currentLesson.microPractice}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Chat Giảng viên Socratic */}
            {activeTab === 'mentor' && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'student'
                                    ? 'bg-indigo-600 text-white ml-6'
                                    : 'bg-slate-950 border border-slate-800 text-slate-200 mr-4'
                                    }`}
                            >
                                {m.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="text-xs text-slate-400 italic px-2">
                                Giảng viên đang phân tích luồng code của bạn...
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={handleSendQuestion}
                        className="p-2.5 border-t border-slate-800 bg-slate-950 flex gap-2"
                    >
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Hỏi về tư duy xử lý, luồng dữ liệu..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !question.trim()}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded transition"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};