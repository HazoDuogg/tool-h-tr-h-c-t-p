'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    GraduationCap,
    Plus,
    Award,
    Code2,
    ArrowRight,
    LogOut,
    CheckCircle2,
    Compass,
    ShieldAlert,
    BookOpen,
} from 'lucide-react';
import { apiRequest } from '../../lib/api-client';
import { LearningTrack } from '../../types/platform';
import { NewTrackModal } from '../../components/dashboard/NewTrackModal';
import { CapstoneTopicModal } from '../../components/dashboard/CapstoneTopicModal';

interface DashboardTrack extends Omit<LearningTrack, 'capstone'> {
    capstone?: {
        id: string;
        title: string;
        blueprintApproved: boolean;
        totalScore?: number | null;
    } | null;
    certificate?: {
        id: string;
        verificationCode: string;
        finalScore: number;
    } | null;
}

interface UserProfile {
    id: string;
    email: string;
    fullName: string;
}

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [user, setUser] = useState<UserProfile | null>(null);
    const [tracks, setTracks] = useState<DashboardTrack[]>([]);
    const [loading, setLoading] = useState(true);

    // Auth Form State (hiển thị khi chưa đăng nhập)
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // Modals
    const [isNewTrackOpen, setIsNewTrackOpen] = useState(false);
    const [capstoneSelectTrack, setCapstoneSelectTrack] = useState<DashboardTrack | null>(null);

    const fetchDashboardData = useCallback(async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : null;
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const [me, myTracks] = await Promise.all([
                apiRequest<UserProfile>('/auth/me'),
                apiRequest<DashboardTrack[]>('/tracks'),
            ]);
            setUser(me);
            setTracks(myTracks);

            if (searchParams.get('newTrack') === 'true') {
                setIsNewTrackOpen(true);
            }
        } catch {
            localStorage.removeItem('cm_token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        try {
            const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
            const body =
                authMode === 'login' ? { email, password } : { fullName, email, password };

            const res = await apiRequest<{ user: UserProfile; token: string }>(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
            });

            localStorage.setItem('cm_token', res.token);
            setUser(res.user);
            await fetchDashboardData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Xác thực thất bại');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('cm_token');
        setUser(null);
        setTracks([]);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
                Đang tải dữ liệu học tập...
            </div>
        );
    }

    // Màn hình Đăng nhập / Đăng ký nếu chưa có phiên làm việc
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                            <GraduationCap className="w-7 h-7" />
                        </div>
                        <h1 className="text-xl font-extrabold text-white">CodeMentor AI Academy</h1>
                        <p className="text-xs text-slate-400">
                            Rèn tư duy logic thuần chất • Tự làm chủ kiến trúc • Không lệ thuộc AI viết code hộ
                        </p>
                    </div>

                    <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                            onClick={() => setAuthMode('login')}
                            className={`py-2 text-xs font-bold rounded-md transition ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                }`}
                        >
                            Đăng nhập
                        </button>
                        <button
                            onClick={() => setAuthMode('register')}
                            className={`py-2 text-xs font-bold rounded-md transition ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                }`}
                        >
                            Đăng ký Học viên
                        </button>
                    </div>

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                        {authMode === 'register' && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Họ và Tên (In trên Bằng khen tốt nghiệp)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Nguyễn Văn A"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="developer@example.com"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition"
                        >
                            {authLoading
                                ? 'Đang xử lý...'
                                : authMode === 'login'
                                    ? 'Vào Không gian Huấn luyện'
                                    : 'Tạo Tài khoản & Bắt đầu'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const completedCount = tracks.filter((t) => t.status === 'COMPLETED').length;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <GraduationCap className="w-7 h-7 text-indigo-400" />
                        <div>
                            <h1 className="text-base font-bold text-white">CodeMentor AI Studio</h1>
                            <p className="text-xs text-slate-400">Xin chào kỹ sư, {user.fullName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsNewTrackOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                        >
                            <Plus className="w-4 h-4" />
                            Học Ngôn ngữ / Framework Mới
                        </button>

                        <button
                            onClick={handleLogout}
                            title="Đăng xuất"
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-6 space-y-8">
                {/* Thống kê tổng quan */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                        <div className="text-xs text-slate-400">Tổng Lộ trình Đã đăng ký</div>
                        <div className="text-2xl font-black text-white mt-1">{tracks.length}</div>
                    </div>
                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                        <div className="text-xs text-slate-400">Đang Huấn luyện</div>
                        <div className="text-2xl font-black text-indigo-400 mt-1">
                            {tracks.length - completedCount}
                        </div>
                    </div>
                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                        <div className="text-xs text-slate-400">Bằng khen Đã đạt được</div>
                        <div className="text-2xl font-black text-emerald-400 mt-1">{completedCount}</div>
                    </div>
                </div>

                {/* Danh sách các Lộ trình học */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                        Danh sách Lộ trình Công nghệ của Bạn
                    </h2>

                    {tracks.length === 0 ? (
                        <div className="p-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
                            <Code2 className="w-10 h-10 text-slate-600 mx-auto" />
                            <h3 className="text-sm font-bold text-slate-300">
                                Bạn chưa đăng ký lộ trình công nghệ nào
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Hãy chọn ngôn ngữ lập trình và framework bạn muốn làm chủ. Hệ thống sẽ xây dựng giáo trình từ tư duy logic gốc rễ đến đồ án bảo vệ trực tiếp.
                            </p>
                            <button
                                onClick={() => setIsNewTrackOpen(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
                            >
                                <Plus className="w-4 h-4" />
                                Tạo Lộ trình Đầu tiên
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tracks.map((track) => {
                                const passedModules = track.modules.filter((m) => m.isPassed).length;
                                const totalModules = track.modules.length;
                                const progressPct =
                                    totalModules > 0 ? Math.round((passedModules / totalModules) * 100) : 0;

                                return (
                                    <div
                                        key={track.id}
                                        className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between space-y-4"
                                    >
                                        <div className="space-y-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="inline-block px-2.5 py-0.5 bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold rounded">
                                                        {track.language}
                                                        {track.framework ? ` • ${track.framework}` : ''}
                                                    </span>
                                                    <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                                                        {track.targetFocus}
                                                    </p>
                                                </div>

                                                {track.status === 'COMPLETED' ? (
                                                    <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-bold rounded-full shrink-0">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Tốt nghiệp
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-semibold rounded-full shrink-0">
                                                        {track.status === 'IN_PROGRESS' && 'Đang học lý thuyết & logic'}
                                                        {track.status === 'CAPSTONE_BLUEPRINT' && 'Giai đoạn Đồ án'}
                                                        {track.status === 'CAPSTONE_CODING' && 'Đang code Đồ án'}
                                                        {track.status === 'LIVE_DEFENSE' && 'Đang Bảo vệ Trực tiếp'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Thanh tiến độ chương */}
                                            <div className="space-y-1 pt-1">
                                                <div className="flex justify-between text-[11px] text-slate-400">
                                                    <span>
                                                        Tiến độ kiểm tra chương: {passedModules}/{totalModules} chương đạt
                                                    </span>
                                                    <span>{progressPct}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 transition-all"
                                                        style={{ width: `${progressPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nút hành động tương ứng với trạng thái hiện tại của Track */}
                                        <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                                            {track.status === 'IN_PROGRESS' && (
                                                <button
                                                    onClick={() => router.push(`/workspace/${track.id}`)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    <span>Tiếp tục Học & Thi Chương</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            )}

                                            {track.status === 'CAPSTONE_BLUEPRINT' && !track.capstone && (
                                                <button
                                                    onClick={() => setCapstoneSelectTrack(track)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <Compass className="w-3.5 h-3.5" />
                                                    <span>Chọn / Tự Đề xuất Đồ án Cuối khóa</span>
                                                </button>
                                            )}

                                            {track.status === 'CAPSTONE_BLUEPRINT' && track.capstone && (
                                                <button
                                                    onClick={() => router.push(`/workspace/${track.id}`)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <Compass className="w-3.5 h-3.5" />
                                                    <span>Vào Blueprint Gate Thiết kế Kiến trúc</span>
                                                </button>
                                            )}

                                            {track.status === 'CAPSTONE_CODING' && (
                                                <button
                                                    onClick={() => router.push(`/workspace/${track.id}`)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <Code2 className="w-3.5 h-3.5" />
                                                    <span>Vào IDE Xây dựng Sản phẩm</span>
                                                </button>
                                            )}

                                            {track.status === 'LIVE_DEFENSE' && (
                                                <button
                                                    onClick={() => router.push(`/defense/${track.id}`)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <ShieldAlert className="w-3.5 h-3.5" />
                                                    <span>Quay lại Phòng Bảo vệ Trực tiếp</span>
                                                </button>
                                            )}

                                            {track.status === 'COMPLETED' && track.certificate && (
                                                <button
                                                    onClick={() =>
                                                        router.push(`/certificates/${track.certificate!.verificationCode}`)
                                                    }
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                                                >
                                                    <Award className="w-4 h-4" />
                                                    <span>
                                                        Xem Bằng khen ({track.certificate.finalScore.toFixed(1)}/10)
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Đăng ký Lộ trình Mới */}
            {isNewTrackOpen && (
                <NewTrackModal
                    onClose={() => setIsNewTrackOpen(false)}
                    onTrackCreated={(created) => {
                        setIsNewTrackOpen(false);
                        router.push(`/workspace/${created.id}`);
                    }}
                />
            )}

            {/* Modal Chọn hoặc Tự Đề xuất Đồ án */}
            {capstoneSelectTrack && (
                <CapstoneTopicModal
                    trackId={capstoneSelectTrack.id}
                    language={capstoneSelectTrack.language}
                    framework={capstoneSelectTrack.framework}
                    onClose={() => setCapstoneSelectTrack(null)}
                    onTopicConfirmed={(id) => {
                        setCapstoneSelectTrack(null);
                        router.push(`/workspace/${id}`);
                    }}
                />
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
                    Đang khởi tạo...
                </div>
            }
        >
            <DashboardContent />
        </Suspense>
    );
}