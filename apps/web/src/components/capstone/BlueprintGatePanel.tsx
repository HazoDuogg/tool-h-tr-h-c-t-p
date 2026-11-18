'use client';

import React, { useState } from 'react';
import { Compass, CheckCircle2, AlertTriangle, Send, ArrowRight } from 'lucide-react';
import { CapstoneProject } from '../../types/platform';
import { apiRequest } from '../../lib/api-client';

interface BlueprintGatePanelProps {
    trackId: string;
    capstone: CapstoneProject;
    onBlueprintApproved: () => void;
}

interface BlueprintReviewResponse {
    capstone: CapstoneProject;
    review: {
        approved: boolean;
        feedback: string;
        requiredImprovements: string[];
    };
}

export const BlueprintGatePanel: React.FC<BlueprintGatePanelProps> = ({
    trackId,
    capstone,
    onBlueprintApproved,
}) => {
    const [folderTree, setFolderTree] = useState(
        capstone.blueprintPayload?.proposedFolderTree ||
        `src/\n├── controllers/\n├── services/\n├── repositories/\n├── models/\n└── utils/`
    );
    const [dataFlow, setDataFlow] = useState(
        capstone.blueprintPayload?.proposedDataFlow || ''
    );
    const [submitting, setSubmitting] = useState(false);
    const [reviewResult, setReviewResult] = useState<BlueprintReviewResponse['review'] | null>(
        null
    );

    const handleSubmitBlueprint = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiRequest<BlueprintReviewResponse>(
                `/capstone/tracks/${trackId}/blueprint`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        proposedFolderTree: folderTree,
                        proposedDataFlow: dataFlow,
                    }),
                }
            );
            setReviewResult(res.review);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Lỗi gửi bản thiết kế');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 space-y-6">
            <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <Compass className="w-4 h-4" />
                    Chốt chặn Kiến trúc (Blueprint Gate)
                </div>
                <h2 className="text-xl font-bold text-white">{capstone.title}</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{capstone.requirements}</p>
            </div>

            <form onSubmit={handleSubmitBlueprint} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        1. Thiết kế Cấu trúc Cây thư mục & Phân chia Module (Folder Structure)
                    </label>
                    <textarea
                        rows={7}
                        value={folderTree}
                        onChange={(e) => setFolderTree(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        2. Phân tích Luồng dữ liệu (Data Flow), Trách nhiệm từng tầng & Xử lý lỗi
                    </label>
                    <textarea
                        rows={6}
                        value={dataFlow}
                        onChange={(e) => setDataFlow(e.target.value)}
                        placeholder="Mô tả rõ Request đi từ đâu -> Validate ở đâu -> Xử lý nghiệp vụ ở tầng nào -> Lưu trữ ra sao..."
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
                >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Tech Lead AI đang thẩm định...' : 'Nộp Thiết kế để Duyệt mở khóa Code'}
                </button>
            </form>

            {/* Kết quả thẩm định từ Tech Lead AI */}
            {reviewResult && (
                <div
                    className={`p-4 rounded-lg border ${reviewResult.approved
                            ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                            : 'bg-amber-950/40 border-amber-700 text-amber-200'
                        }`}
                >
                    <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                        {reviewResult.approved ? (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                <span>Thiết kế Đạt chuẩn Kiến trúc! Bạn đã được mở khóa môi trường Code Đồ án.</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                <span>Thiết kế Chưa đạt yêu cầu — Cần chỉnh sửa lại cấu trúc</span>
                            </>
                        )}
                    </div>

                    <p className="text-xs leading-relaxed whitespace-pre-wrap mb-3">{reviewResult.feedback}</p>

                    {reviewResult.requiredImprovements.length > 0 && (
                        <ul className="list-disc list-inside text-xs space-y-1 mb-4">
                            {reviewResult.requiredImprovements.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    )}

                    {reviewResult.approved && (
                        <button
                            onClick={onBlueprintApproved}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                        >
                            <span>Vào IDE Xây dựng Sản phẩm</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};