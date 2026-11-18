'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Clock,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Send,
    Award,
    RotateCcw,
    FileWarning,
    Layers,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api-client';
import { ActiveDefensePayload, DefenseFinalEvaluation } from '../../../types/defense';
import { DefenseChallengeEditor } from '../../../components/defense/DefenseChallengeEditor';

export default function LiveDefenseRoomPage() {
    const params = useParams<{ trackId: string }>();
    const router = useRouter();

    const [payload, setPayload] = useState<ActiveDefensePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number>(1);

    // Lưu trữ bản code sửa đổi độc lập cho từng thử thách (1, 2, 3)
    const [challengeFilesMap, setChallengeFilesMap] = useState<
        Record<number, Record<string, string>>
    >({});
    const [savedStatusMap, setSavedStatusMap] = useState<Record<number, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Đồng hồ đếm ngược & Nộp bài
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [evaluation, setEvaluation] = useState<DefenseFinalEvaluation | null>(null);
    const autoSubmittedRef = useRef(false);

    // 1. Tải dữ liệu phiên bảo vệ đang mở
    useEffect(() => {
        let mounted = true;
        apiRequest<ActiveDefensePayload>(`/capstone/tracks/${params.trackId}/defense/active`)
            .then((data) => {
                if (!mounted) return;
                setPayload(data);

                // Khởi tạo workspace độc lập cho từng challenge từ bản đã lưu hoặc bản gốc
                const initialMap: Record<number, Record<string, string>> = {};
                const initialSaved: Record<number, boolean> = {};

                for (const ch of data.session.challenges) {
                    initialMap[ch.challengeIndex] = ch.submittedFiles
                        ? { ...ch.submittedFiles }
                        : { ...data.capstone.sourceFiles };
                    initialSaved[ch.challengeIndex] = Boolean(ch.submittedFiles);
                }

                setChallengeFilesMap(initialMap);
                setSavedStatusMap(initialSaved);

                const diffSec = Math.max(
                    0,
                    Math.floor((new Date(data.session.expiresAt).getTime() - Date.now()) / 1000)
                );
                setSecondsLeft(diffSec);
            })
            .catch((err) => {
                alert(err instanceof Error ? err.message : 'Không tìm thấy phiên bảo vệ.');
                router.push(`/workspace/${params.trackId}`);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [params.trackId, router]);

    // 2. Hàm nộp toàn bộ bài bảo vệ cho Hội đồng chấm điểm
    const handleFinalizeDefense = useCallback(async () => {
        if (!payload || isFinalizing || evaluation) return;
        setIsFinalizing(true);

        try {
            // Tự động lưu challenge hiện tại trước khi chốt điểm
            const currentChallenge = payload.session.challenges.find(
                (c) => c.challengeIndex === activeIndex
            );
            if (currentChallenge && challengeFilesMap[activeIndex]) {
                await apiRequest('/capstone/defense/challenge/save', {
                    method: 'POST',
                    body: JSON.stringify({
                        challengeId: currentChallenge.id,
                        updatedFiles: challengeFilesMap[activeIndex],
                    }),
                });
            }

            const result = await apiRequest<DefenseFinalEvaluation>(
                `/capstone/defense/sessions/${payload.session.id}/finalize`,
                { method: 'POST' }
            );
            setEvaluation(result);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Lỗi khi chấm điểm bảo vệ đồ án.');
        } finally {
            setIsFinalizing(false);
        }
    }, [payload, isFinalizing, evaluation, activeIndex, challengeFilesMap]);

    // 3. Đồng hồ đếm ngược thời gian thực
    useEffect(() => {
        if (secondsLeft === null || evaluation) return;

        if (secondsLeft <= 0 && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleFinalizeDefense();
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsLeft, evaluation, handleFinalizeDefense]);

    // 4. Lưu bài sửa của 1 yêu cầu
    const handleSaveCurrentChallenge = async () => {
        if (!payload) return;
        const targetChallenge = payload.session.challenges.find(
            (c) => c.challengeIndex === activeIndex
        );
        if (!targetChallenge) return;

        setIsSaving(true);
        try {
            await apiRequest('/capstone/defense/challenge/save', {
                method: 'POST',
                body: JSON.stringify({
                    challengeId: targetChallenge.id,
                    updatedFiles: challengeFilesMap[activeIndex],
                }),
            });
            setSavedStatusMap((prev) => ({ ...prev, [activeIndex]: true }));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Không thể lưu bài sửa');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || !payload) {
        return (
            <div className="h-screen bg-slate-950 text-slate-200 flex items-center justify-center text-sm">
                Đang triệu tập Hội đồng Bảo vệ Đồ án...
            </div>
        );
    }

    const minutes = Math.floor((secondsLeft || 0) / 60);
    const seconds = (secondsLeft || 0) % 60;
    const isUrgent = (secondsLeft || 0) < 300; // Dưới 5 phút cảnh báo đỏ

    const activeChallenge =
        payload.session.challenges.find((c) => c.challengeIndex === activeIndex) ||
        payload.session.challenges[0];

    return (
        <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
            {/* Header Phòng Bảo vệ */}
            <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase rounded">
                            Live Defense • Lần bảo vệ #{payload.session.attemptNumber}
                        </span>
                        <h1 className="text-sm font-bold text-white">{payload.capstone.title}</h1>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Hoàn thành tối thiểu 1/3 yêu cầu sửa code trực tiếp và đạt tổng điểm từ 5.0/10 để nhận Bằng khen
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Đồng hồ đếm ngược */}
                    {!evaluation && (
                        <div
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm font-bold ${isUrgent
                                    ? 'bg-red-950 border-red-600 text-red-300 animate-pulse'
                                    : 'bg-slate-950 border-slate-700 text-amber-400'
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            <span>
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </span>
                        </div>
                    )}

                    {!evaluation && (
                        <button
                            onClick={handleFinalizeDefense}
                            disabled={isFinalizing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-lg transition"
                        >
                            <Send className="w-4 h-4" />
                            {isFinalizing ? 'Hội đồng đang chấm điểm...' : 'Kết thúc & Nộp Hội đồng Chấm điểm'}
                        </button>
                    )}
                </div>
            </header>

            {/* Nếu đã có Kết quả Chấm điểm Tổng hợp -> Hiển thị Bảng điểm Hội đồng */}
            {evaluation ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
                        {/* Banner Đạt / Trượt */}
                        <div
                            className={`p-6 rounded-xl border flex items-center justify-between ${evaluation.passed
                                    ? 'bg-emerald-950/40 border-emerald-600'
                                    : 'bg-red-950/40 border-red-600'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                {evaluation.passed ? (
                                    <Award className="w-12 h-12 text-emerald-400 shrink-0" />
                                ) : (
                                    <XCircle className="w-12 h-12 text-red-400 shrink-0" />
                                )}
                                <div>
                                    <h2 className="text-xl font-extrabold text-white">
                                        {evaluation.passed
                                            ? 'CHÚC MỪNG! BẠN ĐÃ BẢO VỆ THÀNH CÔNG ĐỒ ÁN'
                                            : 'CHƯA ĐẠT BẢO VỆ — YÊU CẦU LÀM LẠI ĐỒ ÁN'}
                                    </h2>
                                    <p className="text-xs text-slate-300 mt-1">
                                        Số yêu cầu sửa code trực tiếp đạt chuẩn:{' '}
                                        <strong className="text-white">{evaluation.passedChallengeCount}</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-4xl font-black text-white">
                                    {evaluation.capstone.totalScore.toFixed(1)}
                                    <span className="text-base font-normal text-slate-400">/10</span>
                                </div>
                                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                                    Điểm Tổng kết
                                </span>
                            </div>
                        </div>

                        {/* Chi tiết 3 thành phần điểm */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                <div className="text-xs text-slate-400">1. Tư duy Logic & Edge Cases</div>
                                <div className="text-2xl font-bold text-indigo-400 mt-1">
                                    {evaluation.capstone.logicScore.toFixed(1)} <span className="text-xs">/ 4.0</span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                <div className="text-xs text-slate-400">2. Clean Code & Cấu trúc</div>
                                <div className="text-2xl font-bold text-emerald-400 mt-1">
                                    {evaluation.capstone.cleanCodeScore.toFixed(1)}{' '}
                                    <span className="text-xs">/ 3.0</span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                <div className="text-xs text-slate-400">3. Sửa Code Trực tiếp (Live)</div>
                                <div className="text-2xl font-bold text-amber-400 mt-1">
                                    {evaluation.capstone.defenseScore.toFixed(1)}{' '}
                                    <span className="text-xs">/ 3.0</span>
                                </div>
                            </div>
                        </div>

                        {/* Đánh giá chi tiết từng yêu cầu sửa code */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Kết quả 3 Yêu cầu Sửa Code Trực tiếp
                            </h3>
                            {evaluation.challengeEvaluations.map((item) => (
                                <div
                                    key={item.challengeIndex}
                                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3"
                                >
                                    {item.isPassed ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    )}
                                    <div className="text-xs space-y-1">
                                        <div className="font-bold text-slate-200">
                                            Yêu cầu #{item.challengeIndex}:{' '}
                                            <span className={item.isPassed ? 'text-emerald-400' : 'text-red-400'}>
                                                {item.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                            </span>
                                        </div>
                                        <p className="text-slate-300 leading-relaxed">{item.feedback}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Nhận xét tổng kết của Hội đồng */}
                        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                                Nhận xét của Chủ tịch Hội đồng AI
                            </h3>
                            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {evaluation.capstone.finalReview}
                            </p>
                        </div>

                        {/* Nút hành động tiếp theo */}
                        <div className="flex justify-end gap-3 pt-2">
                            {evaluation.passed && evaluation.certificate ? (
                                <button
                                    onClick={() =>
                                        router.push(`/certificates/${evaluation.certificate!.verificationCode}`)
                                    }
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg transition"
                                >
                                    <Award className="w-5 h-5" />
                                    Nhận & Xuất Bằng khen Tốt nghiệp
                                </button>
                            ) : (
                                <button
                                    onClick={() => router.push(`/workspace/${params.trackId}`)}
                                    className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl transition"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Quay lại IDE Xây dựng lại Sản phẩm
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Giao diện Thực hiện 3 Yêu cầu Sửa Code Trực tiếp */
                <div className="flex-1 flex min-h-0 p-3 gap-3">
                    {/* Cột trái: 3 Đề bài Sửa Code của Hội đồng */}
                    <aside className="w-96 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shrink-0">
                        <div className="p-3.5 border-b border-slate-800 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                            <Layers className="w-4 h-4" />
                            <span>3 Yêu cầu Sửa Trực tiếp từ Hội đồng</span>
                        </div>

                        {/* Tabs chọn Yêu cầu 1 - 2 - 3 */}
                        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950">
                            {payload.session.challenges.map((ch) => {
                                const isSelected = ch.challengeIndex === activeIndex;
                                const isSaved = savedStatusMap[ch.challengeIndex];

                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => setActiveIndex(ch.challengeIndex)}
                                        className={`py-2.5 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition ${isSelected
                                                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                                                : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                    >
                                        <span>Yêu cầu {ch.challengeIndex}</span>
                                        {isSaved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Nội dung chi tiết của Yêu cầu đang chọn */}
                        {activeChallenge && (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                                    <div className="text-xs font-bold text-indigo-400">
                                        Đề bài Yêu cầu #{activeChallenge.challengeIndex}
                                    </div>
                                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                                        {activeChallenge.instruction}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        Tệp mã nguồn liên quan cần chỉnh sửa:
                                    </div>
                                    <div className="space-y-1">
                                        {activeChallenge.targetFilePaths.map((path, idx) => (
                                            <div
                                                key={idx}
                                                className="px-2.5 py-1.5 bg-amber-950/30 border border-amber-800/50 rounded text-xs font-mono text-amber-300"
                                            >
                                                {path}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-start gap-2 text-[11px] text-slate-400">
                                    <FileWarning className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    <span>
                                        Mỗi yêu cầu có không gian mã nguồn riêng biệt bắt đầu từ bản nộp gốc của bạn. Hãy bấm{' '}
                                        <strong className="text-slate-200">"Lưu bài sửa Yêu cầu này"</strong> sau khi hoàn tất từng phần.
                                    </span>
                                </div>
                            </div>
                        )}
                    </aside>

                    {/* Cột phải: IDE Sửa code trực tiếp */}
                    <main className="flex-1 min-w-0">
                        {activeChallenge && (
                            <DefenseChallengeEditor
                                key={activeChallenge.id}
                                language={payload.track.language}
                                originalFiles={payload.capstone.sourceFiles}
                                workingFiles={
                                    challengeFilesMap[activeChallenge.challengeIndex] || payload.capstone.sourceFiles
                                }
                                targetFilePaths={activeChallenge.targetFilePaths}
                                isSaved={Boolean(savedStatusMap[activeChallenge.challengeIndex])}
                                isSaving={isSaving}
                                isTimeExpired={(secondsLeft || 0) <= 0}
                                onUpdateFile={(filePath, content) => {
                                    setChallengeFilesMap((prev) => ({
                                        ...prev,
                                        [activeChallenge.challengeIndex]: {
                                            ...(prev[activeChallenge.challengeIndex] || payload.capstone.sourceFiles),
                                            [filePath]: content,
                                        },
                                    }));
                                    setSavedStatusMap((prev) => ({
                                        ...prev,
                                        [activeChallenge.challengeIndex]: false,
                                    }));
                                }}
                                onSaveChallenge={handleSaveCurrentChallenge}
                            />
                        )}
                    </main>
                </div>
            )}
        </div>
    );
}