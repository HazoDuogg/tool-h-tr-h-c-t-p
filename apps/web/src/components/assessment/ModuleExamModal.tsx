'use client';

import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Award, X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api-client';
import { ModuleExamPayload } from '../../types/platform';

interface ModuleExamModalProps {
    moduleId: string;
    moduleTitle: string;
    language: string;
    onClose: () => void;
    onExamCompleted: () => void;
}

interface ExamSubmitResponse {
    assessment: {
        score: number;
        passed: boolean;
        aiFeedback: string;
    };
    sandboxResult: {
        passedCount: number;
        total: number;
    };
    nextAction: string;
}

export const ModuleExamModal: React.FC<ModuleExamModalProps> = ({
    moduleId,
    moduleTitle,
    language,
    onClose,
    onExamCompleted,
}) => {
    const [exam, setExam] = useState<ModuleExamPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
    const [codeAnswer, setCodeAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<ExamSubmitResponse | null>(null);

    useEffect(() => {
        let isMounted = true;
        apiRequest<ModuleExamPayload>(`/assessments/modules/${moduleId}/exam/start`, {
            method: 'POST',
        })
            .then((data) => {
                if (!isMounted) return;
                setExam(data);
                setCodeAnswer(data.examPayload.codingProblem.starterCode || '');
            })
            .catch((err) => {
                alert(err instanceof Error ? err.message : 'Không thể tải đề kiểm tra');
                onClose();
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [moduleId, onClose]);

    const handleSubmitExam = async () => {
        if (!exam) return;
        setSubmitting(true);
        try {
            const res = await apiRequest<ExamSubmitResponse>('/assessments/exam/submit', {
                method: 'POST',
                body: JSON.stringify({
                    assessmentId: exam.id,
                    theoryAnswers,
                    submittedCode: codeAnswer,
                }),
            });
            setResult(res);
            if (res.assessment.passed) {
                onExamCompleted();
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Lỗi nộp bài kiểm tra');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Award className="w-5 h-5 text-amber-400" />
                        <div>
                            <h2 className="text-base font-bold">Kiểm tra Qua môn: {moduleTitle}</h2>
                            {exam && (
                                <p className="text-xs text-slate-400">
                                    Lần thi thứ #{exam.attemptNumber} • Điều kiện qua môn: Điểm từ 7.0/10 và đạt tối thiểu 3/4 Test Cases
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading && <div className="text-center py-12 text-sm text-slate-400">Giảng viên AI đang biên soạn đề thi...</div>}

                    {!loading && exam && !result && (
                        <>
                            {/* Phần 1: Phân tích bản chất */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                                    Phần 1: Phân tích Bản chất & Tư duy Logic (4.0 điểm)
                                </h3>
                                {exam.examPayload.theoryQuestions.map((q, idx) => (
                                    <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                                        <p className="text-xs font-semibold text-slate-200">
                                            Câu {idx + 1}: {q.question}
                                        </p>
                                        <textarea
                                            rows={3}
                                            value={theoryAnswers[q.id] || ''}
                                            onChange={(e) =>
                                                setTheoryAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                            }
                                            placeholder="Trình bày rõ cơ chế hoạt động và lý do lựa chọn hướng xử lý..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Phần 2: Thực hành lập trình */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                                    Phần 2: Thực hành Giải quyết Vấn đề & Clean Code (6.0 điểm)
                                </h3>
                                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
                                    <div className="font-bold text-sm text-white">
                                        {exam.examPayload.codingProblem.title}
                                    </div>
                                    <p className="text-slate-300 leading-relaxed">
                                        {exam.examPayload.codingProblem.description}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] font-mono text-slate-400">
                                        <div>Input: {exam.examPayload.codingProblem.inputFormat}</div>
                                        <div>Output: {exam.examPayload.codingProblem.outputFormat}</div>
                                    </div>
                                </div>

                                <div className="h-72 border border-slate-700 rounded-lg overflow-hidden">
                                    <Editor
                                        height="100%"
                                        theme="vs-dark"
                                        language={language.toLowerCase().replace('#', 'sharp')}
                                        value={codeAnswer}
                                        onChange={(v) => setCodeAnswer(v || '')}
                                        options={{ fontSize: 13, minimap: { enabled: false } }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Kết quả chấm điểm */}
                    {result && (
                        <div
                            className={`p-6 rounded-xl border space-y-4 ${result.assessment.passed
                                    ? 'bg-emerald-950/30 border-emerald-700'
                                    : 'bg-red-950/30 border-red-700'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {result.assessment.passed ? (
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    ) : (
                                        <AlertCircle className="w-8 h-8 text-red-400" />
                                    )}
                                    <div>
                                        <h3 className="text-lg font-bold">
                                            {result.assessment.passed
                                                ? 'CHÚC MỪNG! BẠN ĐÃ QUA MÔN'
                                                : 'CHƯA ĐẠT YÊU CẦU — BUỘC ÔN TẬP & THI LẠI'}
                                        </h3>
                                        <p className="text-xs text-slate-300">
                                            Test Cases Sandbox đạt: {result.sandboxResult.passedCount}/
                                            {result.sandboxResult.total}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-white">
                                    {result.assessment.score.toFixed(1)}
                                    <span className="text-sm text-slate-400">/10</span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {result.assessment.aiFeedback}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
                                >
                                    {result.assessment.passed ? 'Tiếp tục Chương tiếp theo' : 'Quay lại Ôn tập'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && exam && !result && (
                    <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmitExam}
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-lg"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {submitting ? 'Đang chạy Test Cases & Chấm điểm...' : 'Nộp bài Chấm điểm'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};