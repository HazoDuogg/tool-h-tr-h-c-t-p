'use client';

import React, { useState } from 'react';
import { X, Sparkles, Code2, Layers, Target } from 'lucide-react';
import { apiRequest } from '../../lib/api-client';
import { LearningTrack } from '../../types/platform';

interface NewTrackModalProps {
    onClose: () => void;
    onTrackCreated: (track: LearningTrack) => void;
}

const LANGUAGE_PRESETS: Record<string, string[]> = {
    TypeScript: ['Thuần ngôn ngữ (Core)', 'Next.js', 'NestJS', 'Express.js', 'React'],
    Python: ['Thuần ngôn ngữ (Core)', 'FastAPI', 'Django', 'Flask'],
    Java: ['Thuần ngôn ngữ (Core)', 'Spring Boot'],
    'C#': ['Thuần ngôn ngữ (Core)', 'ASP.NET Core', '.NET WinForms / WPF'],
    Go: ['Thuần ngôn ngữ (Core)', 'Gin', 'Fiber'],
    'C++': ['Thuần ngôn ngữ (Core)', 'STL & Cấu trúc dữ liệu nâng cao'],
};

export const NewTrackModal: React.FC<NewTrackModalProps> = ({ onClose, onTrackCreated }) => {
    const [language, setLanguage] = useState('TypeScript');
    const [framework, setFramework] = useState('Next.js');
    const [customFramework, setCustomFramework] = useState('');
    const [targetFocus, setTargetFocus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const availableFrameworks = LANGUAGE_PRESETS[language] || ['Thuần ngôn ngữ (Core)'];

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        const presets = LANGUAGE_PRESETS[lang] || ['Thuần ngôn ngữ (Core)'];
        setFramework(presets[0]);
        setCustomFramework('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const resolvedFramework =
            customFramework.trim() ||
            (framework === 'Thuần ngôn ngữ (Core)' ? undefined : framework);

        try {
            const createdTrack = await apiRequest<LearningTrack>('/tracks', {
                method: 'POST',
                body: JSON.stringify({
                    language,
                    framework: resolvedFramework,
                    targetFocus: targetFocus.trim(),
                }),
            });
            onTrackCreated(createdTrack);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Không thể khởi tạo lộ trình học');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden text-slate-100 shadow-2xl">
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-base font-bold">Đăng ký Lộ trình Huấn luyện Mới</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Bước 1: Chọn ngôn ngữ */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                            1. Chọn Ngôn ngữ Lập trình
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.keys(LANGUAGE_PRESETS).map((lang) => (
                                <button
                                    type="button"
                                    key={lang}
                                    onClick={() => handleLanguageChange(lang)}
                                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition ${language === lang
                                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                        }`}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bước 2: Chọn Framework / Kỹ thuật */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" />
                            2. Chọn Framework / Công nghệ đi kèm
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2.5">
                            {availableFrameworks.map((fw) => (
                                <button
                                    type="button"
                                    key={fw}
                                    onClick={() => {
                                        setFramework(fw);
                                        setCustomFramework('');
                                    }}
                                    className={`py-1.5 px-3 rounded-lg border text-xs transition ${framework === fw && !customFramework
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-semibold'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    {fw}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={customFramework}
                            onChange={(e) => setCustomFramework(e.target.value)}
                            placeholder="Hoặc nhập tên Framework / Thư viện khác (VD: Angular, Laravel, Entity Framework...)"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    {/* Bước 3: Mục tiêu thực chiến */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            <Target className="w-3.5 h-3.5 text-amber-400" />
                            3. Mục tiêu Sản phẩm & Tư duy muốn rèn luyện
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={targetFocus}
                            onChange={(e) => setTargetFocus(e.target.value)}
                            placeholder="VD: Nắm vững tư duy thiết kế REST API chuẩn Clean Architecture, xử lý đồng bộ dữ liệu, phân quyền và tự xây dựng hoàn chỉnh hệ thống quản lý bán hàng..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !targetFocus.trim()}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
                        >
                            {submitting
                                ? 'Architect AI đang biên soạn Giáo trình...'
                                : 'Khởi tạo Giáo trình & Bắt đầu Học'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};