'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Award,
    Printer,
    Share2,
    CheckCircle2,
    PlusCircle,
    ShieldCheck,
    Code2,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api-client';
import { VerifiedCertificate } from '../../../types/defense';

export default function CertificateVerificationPage() {
    const params = useParams<{ code: string }>();
    const router = useRouter();

    const [certificate, setCertificate] = useState<VerifiedCertificate | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let mounted = true;
        apiRequest<VerifiedCertificate>(`/certificates/verify/${params.code}`)
            .then((data) => {
                if (mounted) setCertificate(data);
            })
            .catch((err) => {
                if (mounted) {
                    setErrorMsg(err instanceof Error ? err.message : 'Mã bằng khen không hợp lệ.');
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [params.code]);

    const handleCopyLink = () => {
        if (typeof window === 'undefined') return;
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handlePrintPdf = () => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
                Đang xác thực mã bằng khen trên hệ thống...
            </div>
        );
    }

    if (errorMsg || !certificate) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-red-400" />
                <h1 className="text-xl font-bold">Không thể xác thực Bằng khen</h1>
                <p className="text-sm text-slate-400 max-w-md">{errorMsg}</p>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
                >
                    Quay về Trang chủ
                </button>
            </div>
        );
    }

    const verifyUrl =
        typeof window !== 'undefined'
            ? window.location.href
            : `https://codementor.app/certificates/${certificate.verificationCode}`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
        verifyUrl
    )}`;

    const formattedDate = new Date(certificate.issuedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 flex flex-col items-center">
            {/* Thanh công cụ thao tác (Ẩn khi in PDF) */}
            <div className="w-full max-w-4xl mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold bg-emerald-950/50 border border-emerald-800 px-3.5 py-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Chứng chỉ Hợp lệ • Đã vượt qua Kiểm thử Logic & Hội đồng Bảo vệ Code</span>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        {copied ? 'Đã sao chép liên kết!' : 'Chia sẻ Portfolio'}
                    </button>

                    <button
                        onClick={handlePrintPdf}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        In / Xuất PDF Bằng khen
                    </button>

                    <button
                        onClick={() => router.push('/dashboard?newTrack=true')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                    >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Học Ngôn ngữ / Framework Mới
                    </button>
                </div>
            </div>

            {/* Khung Phôi Bằng khen Chuẩn In Ấn */}
            <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border-[10px] border-double border-slate-800 p-10 md:p-14 relative overflow-hidden print:shadow-none print:border-slate-900">
                {/* Họa tiết nền chìm */}
                <div className="absolute -right-16 -bottom-16 opacity-5 pointer-events-none">
                    <Code2 className="w-96 h-96 text-slate-900" />
                </div>

                {/* Quốc hiệu / Tiêu đề Học viện */}
                <div className="text-center space-y-2 border-b-2 border-slate-200 pb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 text-amber-400 mb-1">
                        <Award className="w-8 h-8" />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                        HỆ THỐNG HUẤN LUYỆN KỸ SƯ PHẦN MỀM THỰC CHIẾN
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-extrabold tracking-wide text-slate-900 uppercase">
                        BẰNG KHEN TỐT NGHIỆP
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        CHỨNG NHẬN NĂNG LỰC TƯ DUY LOGIC, CLEAN CODE & XÂY DỰNG SẢN PHẨM ĐỘC LẬP
                    </p>
                </div>

                {/* Nội dung vinh danh học viên */}
                <div className="py-8 text-center space-y-4">
                    <p className="text-sm text-slate-600 italic">Trân trọng chứng nhận học viên:</p>
                    <div className="text-3xl md:text-4xl font-bold text-indigo-950 tracking-tight">
                        {certificate.user.fullName}
                    </div>

                    <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        Đã hoàn thành xuất sắc chương trình huấn luyện chuyên sâu, vượt qua toàn bộ các kỳ kiểm
                        tra tư duy thuật toán và bảo vệ thành công sản phẩm thực tế trước Hội đồng đánh giá mã
                        nguồn trực tiếp:
                    </p>

                    {/* Khối thông tin chuyên môn */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left bg-slate-50 border border-slate-200 rounded-xl p-5">
                        <div>
                            <div className="text-[11px] font-bold uppercase text-slate-400">
                                Công nghệ Chuyên sâu
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                                {certificate.language}
                                {certificate.framework ? ` • ${certificate.framework}` : ''}
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-bold uppercase text-slate-400">
                                Đồ án Bảo vệ Thành công
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2">
                                {certificate.projectTitle}
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-bold uppercase text-slate-400">
                                Điểm Tổng kết Hội đồng
                            </div>
                            <div className="text-lg font-black text-emerald-700 mt-0.5">
                                {certificate.finalScore.toFixed(1)} / 10.0
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chân bằng khen: Ngày cấp, Chữ ký Hội đồng & Mã QR Xác thực */}
                <div className="pt-6 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={qrImageUrl}
                            alt="QR Xác thực Bằng khen"
                            className="w-24 h-24 border border-slate-300 rounded-lg p-1 bg-white"
                        />
                        <div className="text-xs space-y-1">
                            <div className="font-bold text-slate-800">MÃ XÁC THỰC CHỨNG CHỈ</div>
                            <div className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 inline-block">
                                {certificate.verificationCode}
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Quét mã QR để kiểm tra tính xác thực trực tuyến
                            </div>
                        </div>
                    </div>

                    <div className="text-center sm:text-right space-y-1">
                        <div className="text-xs text-slate-500">Ngày cấp: {formattedDate}</div>
                        <div className="text-sm font-bold text-slate-900 uppercase tracking-wider pt-2">
                            HỘI ĐỒNG THẨM ĐỊNH KỸ THUẬT
                        </div>
                        <div className="text-xs font-serif italic text-indigo-900">
                            CodeMentor AI Engineering Board
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}