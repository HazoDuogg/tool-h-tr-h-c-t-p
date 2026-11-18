'use client';

import React, { useState, useEffect } from 'react';
import { X, Compass, Lightbulb, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../lib/api-client';

interface CapstoneOption {
    title: string;
    requirements: string;
    estimatedComplexity: string;
}

interface CapstoneTopicModalProps {
    trackId: string;
    language: string;
    framework?: string | null;
    onClose: () => void;
    onTopicConfirmed: (trackId: string) => void;
}

export const CapstoneTopicModal: React.FC<CapstoneTopicModalProps> = ({
    trackId,
    language,
    framework,
    onClose,
    onTopicConfirmed,
}) => {
    const [mode, setMode] = useState<'ai_suggest' | 'user_propose'>('ai_suggest');
    const [options, setOptions] = useState<CapstoneOption[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Tự đề xuất ý tưởng
    const [customTitle, setCustomTitle] = useState('');
    const [customDesc, setCustomDesc] = useState('');
    const [standardizedCustom, setStandardizedCustom] = useState<CapstoneOption | null>(null);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoadingOptions(true);
        apiRequest<CapstoneOption[]>(`/capstone/tracks/${trackId}/options`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
            .then((data) => {
                if (mounted) setOptions(data);
            })
            .catch((err) => {
                alert(err instanceof Error ? err.message : 'Lỗi tải danh sách đồ án gợi ý');
            })
            .finally(() => {
                if (mounted) setLoadingOptions(false);
            });

        return () => {
            mounted = false;
        };
    }, [trackId]);

    const handleStandardizeCustomIdea = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingOptions(true);
        try {
            const res = await apiRequest<CapstoneOption[]>(`/capstone/tracks/${trackId}/options`, {
                method: 'POST',
                body: JSON.stringify({
                    customIdea: { title: customTitle, description: customDesc },
                }),
            });
            if (res[0]) setStandardizedCustom(res[0]);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Không thể phân tích đề xuất đồ án');
        } finally {
            setLoadingOptions(false);
        }
    };

    const handleConfirmTopic = async () => {
        const chosen = mode === 'ai_suggest' ? options[selectedIdx] : standardizedCustom;
        if (!chosen) return;

        setConfirming(true);
        try {
            await apiRequest(`/capstone/tracks/${trackId}/topic`, {
                method: 'POST',
                body: JSON.stringify({
                    title: chosen.title,
                    requirements: chosen.requirements,
                    isUserProposed: mode === 'user_propose',
                }),
            });
            onTopicConfirmed(trackId);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Lỗi xác nhận đề tài đồ án');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold flex items-center gap-2">
                            <Compass className="w-5 h-5 text-indigo-400" />
                            Chọn Đề tài Đồ án Tốt nghiệp ({language} {framework || ''})
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Sau khi chốt đề tài, bạn sẽ bước vào cổng Blueprint Gate để thiết kế cấu trúc thư mục trước khi code.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950">
                    <button
                        onClick={() => setMode('ai_suggest')}
                        className={`py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${mode === 'ai_suggest'
                                ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Hệ thống Gợi ý 3 Đồ án Thực chiến
                    </button>

                    <button
                        onClick={() => setMode('user_propose')}
                        className={`py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition ${mode === 'user_propose'
                                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Lightbulb className="w-4 h-4" />
                        Tôi Tự Đề xuất Ý tưởng Sản phẩm
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {mode === 'ai_suggest' && (
                        <>
                            {loadingOptions && (
                                <div className="text-center py-10 text-xs text-slate-400">
                                    Hệ thống đang thiết kế 3 đề tài đồ án sát với stack của bạn...
                                </div>
                            )}

                            {!loadingOptions &&
                                options.map((opt, idx) => {
                                    const isSelected = idx === selectedIdx;
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedIdx(idx)}
                                            className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${isSelected
                                                    ? 'bg-indigo-600/15 border-indigo-500'
                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                                                    {opt.title}
                                                </h3>
                                                <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px]">
                                                    Độ khó: {opt.estimatedComplexity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {opt.requirements}
                                            </p>
                                        </div>
                                    );
                                })}
                        </>
                    )}

                    {mode === 'user_propose' && (
                        <div className="space-y-4">
                            <form onSubmit={handleStandardizeCustomIdea} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Tên Sản phẩm / Đồ án của bạn
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        placeholder="VD: Hệ thống Đặt lịch Khám bệnh & Quản lý Bệnh án Mini"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Mô tả các chức năng chính và bài toán nghiệp vụ cần giải quyết
                                    </label>
                                    <textarea
                                        rows={4}
                                        required
                                        value={customDesc}
                                        onChange={(e) => setCustomDesc(e.target.value)}
                                        placeholder="Mô tả chi tiết luồng người dùng, các thực thể dữ liệu, quy tắc ràng buộc..."
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loadingOptions || !customTitle.trim() || !customDesc.trim()}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-700/50 text-xs font-semibold rounded-lg transition"
                                >
                                    {loadingOptions
                                        ? 'Hội đồng AI đang thẩm định & chuẩn hóa đặc tả...'
                                        : 'Thẩm định & Chuẩn hóa Đặc tả Đề tài'}
                                </button>
                            </form>

                            {standardizedCustom && (
                                <div className="p-4 bg-emerald-950/20 border border-emerald-700/60 rounded-xl space-y-2">
                                    <div className="text-xs font-bold text-emerald-400">
                                        Đặc tả Kỹ thuật đã được Hội đồng Chuẩn hóa (Thang chấm 10 điểm):
                                    </div>
                                    <div className="text-sm font-bold text-white">{standardizedCustom.title}</div>
                                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                                        {standardizedCustom.requirements}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                        Đóng
                    </button>
                    <button
                        onClick={handleConfirmTopic}
                        disabled={
                            confirming ||
                            (mode === 'ai_suggest' && options.length === 0) ||
                            (mode === 'user_propose' && !standardizedCustom)
                        }
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
                    >
                        <span>{confirming ? 'Đang khởi tạo...' : 'Chốt Đề tài & Vào Thiết kế Kiến trúc'}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};