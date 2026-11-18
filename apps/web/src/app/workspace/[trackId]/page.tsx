'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Lock,
    CheckCircle2,
    CircleDot,
    GraduationCap,
    ShieldCheck,
    Rocket,
    GripVertical,
} from 'lucide-react';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { apiRequest } from '../../../lib/api-client';
import { LearningTrack } from '../../../types/platform';
import { MultiFileMonacoIDE } from '../../../components/ide/MultiFileMonacoIDE';
import { SocraticMentorPanel } from '../../../components/mentor/SocraticMentorPanel';
import { BlueprintGatePanel } from '../../../components/capstone/BlueprintGatePanel';
import { ModuleExamModal } from '../../../components/assessment/ModuleExamModal';

export default function LearningWorkspacePage() {
    const params = useParams<{ trackId: string }>();
    const router = useRouter();
    const { track, setTrack, activeModuleId, selectModule, getActiveModule, files, pasteAnomalyCount } =
        useWorkspaceStore();

    const [isExamOpen, setIsExamOpen] = useState(false);
    const [isSubmittingCapstone, setIsSubmittingCapstone] = useState(false);
    const [lessonPanelWidth, setLessonPanelWidth] = useState(384);
    const [maxLessonPanelWidth, setMaxLessonPanelWidth] = useState(900);
    const panelSplitRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = panelSplitRef.current;
        if (!container) return;

        const updateMaxWidth = () => {
            const maxWidth = Math.max(320, container.clientWidth - 372);
            setMaxLessonPanelWidth(maxWidth);
            setLessonPanelWidth((width) => Math.min(width, maxWidth));
        };

        updateMaxWidth();
        const observer = new ResizeObserver(updateMaxWidth);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const resizeLessonPanel = (clientX: number) => {
        const container = panelSplitRef.current;
        if (!container) return;

        const width = container.getBoundingClientRect().right - clientX;
        setLessonPanelWidth(Math.min(maxLessonPanelWidth, Math.max(320, width)));
    };

    const loadTrackData = useCallback(async () => {
        try {
            const tracks = await apiRequest<LearningTrack[]>('/tracks');
            const current = tracks.find((t) => t.id === params.trackId);
            if (current) {
                setTrack(current);
            }
        } catch (err) {
            console.error(err);
        }
    }, [params.trackId, setTrack]);

    useEffect(() => {
        loadTrackData();
    }, [loadTrackData]);

    if (!track) {
        return (
            <div className="h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
                Đang tải không gian huấn luyện lập trình...
            </div>
        );
    }

    const activeModule = getActiveModule();

    // Gửi toàn bộ mã nguồn đồ án sang Phòng Bảo vệ Trực tiếp (Giai đoạn 3)
    const handleEnterLiveDefense = async () => {
        setIsSubmittingCapstone(true);
        try {
            await apiRequest(`/capstone/tracks/${track.id}/defense/start`, {
                method: 'POST',
                body: JSON.stringify({
                    sourceFiles: files,
                    pasteAnomalyCount,
                }),
            });
            router.push(`/defense/${track.id}`);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Không thể khởi tạo phiên bảo vệ đồ án');
        } finally {
            setIsSubmittingCapstone(false);
        }
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
            {/* Top Navbar */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <GraduationCap className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h1 className="text-sm font-bold text-white">
                            Lộ trình: {track.language} {track.framework ? `+ ${track.framework}` : ''}
                        </h1>
                        <p className="text-[11px] text-slate-400 truncate max-w-md">{track.targetFocus}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {track.status === 'IN_PROGRESS' && activeModule && (
                        <button
                            onClick={() => setIsExamOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Thi Kiểm tra Qua Chương {activeModule.orderIndex}
                        </button>
                    )}

                    {track.status === 'CAPSTONE_CODING' && (
                        <button
                            onClick={handleEnterLiveDefense}
                            disabled={isSubmittingCapstone}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                        >
                            <Rocket className="w-4 h-4" />
                            {isSubmittingCapstone
                                ? 'Hội đồng đang phân tích code...'
                                : 'Nộp Sản phẩm & Vào Bảo vệ Trực tiếp'}
                        </button>
                    )}
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex min-h-0 p-3 gap-3">
                {/* Cột 1: Danh sách Lộ trình các Chương (Gatekeeper Sidebar) */}
                <aside className="w-64 bg-slate-900 border border-slate-800 rounded-lg flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tiến độ Lộ trình Học
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {track.modules.map((mod) => {
                            const isSelected = mod.id === activeModuleId;
                            return (
                                <button
                                    key={mod.id}
                                    disabled={!mod.isUnlocked}
                                    onClick={() => selectModule(mod.id)}
                                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-start gap-2.5 ${!mod.isUnlocked
                                        ? 'bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                        }`}
                                >
                                    <div className="mt-0.5 shrink-0">
                                        {mod.isPassed ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        ) : mod.isUnlocked ? (
                                            <CircleDot className="w-4 h-4 text-indigo-400" />
                                        ) : (
                                            <Lock className="w-4 h-4 text-slate-600" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-semibold">Chương {mod.orderIndex}</div>
                                        <div className="line-clamp-2 text-[11px] opacity-90">{mod.title}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Khu vực trung tâm: Hiển thị Blueprint Gate hoặc IDE + Socratic Mentor */}
                {track.status === 'CAPSTONE_BLUEPRINT' && track.capstone && !track.capstone.blueprintApproved ? (
                    <div className="flex-1 overflow-y-auto">
                        <BlueprintGatePanel
                            trackId={track.id}
                            capstone={track.capstone}
                            onBlueprintApproved={loadTrackData}
                        />
                    </div>
                ) : (
                    <>
                        {/* Cột 2: Monaco IDE Đa file & Sandbox Terminal */}
                        <div ref={panelSplitRef} className="flex-1 min-w-0 flex">
                            <main className="flex-1 min-w-0">
                                <MultiFileMonacoIDE language={track.language} />
                            </main>

                            <div
                                role="separator"
                                aria-label="Thay đổi chiều rộng khung bài học"
                                aria-orientation="vertical"
                                aria-valuemin={320}
                                aria-valuemax={maxLessonPanelWidth}
                                aria-valuenow={lessonPanelWidth}
                                tabIndex={0}
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                }}
                                onPointerMove={(event) => {
                                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                        resizeLessonPanel(event.clientX);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowLeft') {
                                        event.preventDefault();
                                        setLessonPanelWidth((width) =>
                                            Math.min(maxLessonPanelWidth, width + 24)
                                        );
                                    } else if (event.key === 'ArrowRight') {
                                        event.preventDefault();
                                        setLessonPanelWidth((width) => Math.max(320, width - 24));
                                    } else if (event.key === 'Home') {
                                        event.preventDefault();
                                        setLessonPanelWidth(320);
                                    } else if (event.key === 'End') {
                                        event.preventDefault();
                                        setLessonPanelWidth(maxLessonPanelWidth);
                                    }
                                }}
                                className="w-3 shrink-0 flex items-center justify-center cursor-col-resize touch-none select-none text-slate-600 hover:text-indigo-400 focus-visible:text-indigo-400 focus-visible:outline-none"
                                title="Kéo để thay đổi kích thước khung bài học"
                            >
                                <GripVertical className="w-3 h-5" />
                            </div>

                            {/* Cột 3: Giáo trình bản chất & Giảng viên Socratic AI */}
                            <aside
                                className="shrink-0"
                                style={{ width: `${lessonPanelWidth}px` }}
                            >
                                <SocraticMentorPanel />
                            </aside>
                        </div>
                    </>
                )}
            </div>

            {/* Modal Thi kiểm tra qua môn */}
            {isExamOpen && activeModule && (
                <ModuleExamModal
                    moduleId={activeModule.id}
                    moduleTitle={activeModule.title}
                    language={track.language}
                    onClose={() => setIsExamOpen(false)}
                    onExamCompleted={loadTrackData}
                />
            )}
        </div>
    );
}