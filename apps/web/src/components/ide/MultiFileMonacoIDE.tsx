'use client';

import React, { useState } from 'react';
import { CodeEditor } from './CodeEditor';
import {
    FileCode2,
    FolderPlus,
    Trash2,
    Play,
    ShieldAlert,
    Terminal,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace.store';
import { apiRequest } from '../../lib/api-client';
import { SandboxExecutionResult } from '../../types/platform';
import { detectMonacoLanguage } from '../../lib/language-presets';

interface MultiFileMonacoIDEProps {
    language: string;
}

export const MultiFileMonacoIDE: React.FC<MultiFileMonacoIDEProps> = ({ language }) => {
    const {
        files,
        activeFile,
        setActiveFile,
        createFile,
        deleteFile,
        pasteAnomalyCount,
        pasteAlerts,
    } = useWorkspaceStore();

    const [newFileName, setNewFileName] = useState('');
    const [isCreatingFile, setIsCreatingFile] = useState(false);

    // Sandbox Terminal State
    const [stdinInput, setStdinInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [execResult, setExecResult] = useState<SandboxExecutionResult | null>(null);

    const handleCreateFileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFileName.trim()) return;
        createFile(newFileName.trim(), `// Module: ${newFileName.trim()}\n`);
        setNewFileName('');
        setIsCreatingFile(false);
    };

    const handleRunSandbox = async () => {
        setIsRunning(true);
        setExecResult(null);
        try {
            const orderedFiles = [
                { name: activeFile, content: files[activeFile] || '' },
                ...Object.entries(files)
                    .filter(([path]) => path !== activeFile)
                    .map(([name, content]) => ({ name, content })),
            ];

            const result = await apiRequest<SandboxExecutionResult>('/assessments/sandbox/run', {
                method: 'POST',
                body: JSON.stringify({
                    language,
                    files: orderedFiles,
                    stdin: stdinInput,
                }),
            });
            setExecResult(result);
        } catch (err) {
            setExecResult({
                stdout: '',
                stderr: err instanceof Error ? err.message : 'Lỗi kết nối Sandbox',
                exitCode: 1,
                executionTimeMs: 0,
                isSuccess: false,
            });
        } finally {
            setIsRunning(false);
        }
    };

    const fileList = Object.keys(files);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg overflow-hidden">
            {/* Thanh cảnh báo Anti-Paste Guard */}
            {pasteAlerts.length > 0 && (
                <div className="bg-red-950/90 border-b border-red-700 px-4 py-2 flex items-center justify-between text-xs text-red-200">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                            <strong>[Anti-Paste Guard]</strong> {pasteAlerts[0].message}
                        </span>
                    </div>
                    <span className="px-2 py-0.5 bg-red-900 rounded font-mono text-red-100">
                        Vi phạm: {pasteAnomalyCount}
                    </span>
                </div>
            )}

            {/* Khu vực chính: File Explorer bên trái + Monaco Editor bên phải */}
            <div className="flex flex-1 min-h-0">
                {/* Sidebar Cây thư mục */}
                <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
                    <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Cấu trúc Dự án
                        </span>
                        <button
                            onClick={() => setIsCreatingFile((v) => !v)}
                            title="Tạo file mới (VD: src/utils/helper.ts)"
                            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>

                    {isCreatingFile && (
                        <form onSubmit={handleCreateFileSubmit} className="p-2 border-b border-slate-800">
                            <input
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="src/service.ts"
                                autoFocus
                                className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-indigo-500"
                            />
                        </form>
                    )}

                    <div className="flex-1 overflow-y-auto py-1">
                        {fileList.map((filePath) => {
                            const isSelected = filePath === activeFile;
                            return (
                                <div
                                    key={filePath}
                                    onClick={() => setActiveFile(filePath)}
                                    className={`group flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer ${isSelected
                                            ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500'
                                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate font-mono">{filePath}</span>
                                    </div>
                                    {fileList.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteFile(filePath);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400"
                                            title="Xóa file"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Khung soạn thảo Monaco */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Tab header & Nút Run Sandbox */}
                    <div className="h-10 bg-slate-900/80 border-b border-slate-800 px-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                            <span className="px-2.5 py-1 bg-slate-800 rounded text-indigo-300 border border-slate-700">
                                {activeFile}
                            </span>
                            <span className="text-slate-500">
                                ({detectMonacoLanguage(activeFile)})
                            </span>
                        </div>

                        <button
                            onClick={handleRunSandbox}
                            disabled={isRunning}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium rounded transition"
                        >
                            <Play className="w-3.5 h-3.5" />
                            {isRunning ? 'Đang biên dịch...' : 'Chạy thử Sandbox'}
                        </button>
                    </div>

                    <div className="flex-1 min-h-0">
                        <CodeEditor />
                    </div>
                </div>
            </div>

            {/* Khu vực Terminal & Standard Input/Output bên dưới */}
            <div className="h-44 bg-slate-900 border-t border-slate-800 grid grid-cols-12">
                {/* Cột nhập Standard Input (stdin) */}
                <div className="col-span-4 border-r border-slate-800 p-2.5 flex flex-col">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Standard Input (stdin)
                    </label>
                    <textarea
                        value={stdinInput}
                        onChange={(e) => setStdinInput(e.target.value)}
                        placeholder="Nhập dữ liệu đầu vào cho chương trình..."
                        className="flex-1 w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
                    />
                </div>

                {/* Cột hiển thị kết quả biên dịch & thực thi */}
                <div className="col-span-8 p-2.5 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Sandbox Console Output</span>
                        </div>
                        {execResult && (
                            <div className="flex items-center gap-2 text-xs">
                                {execResult.isSuccess ? (
                                    <span className="flex items-center gap-1 text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Exit 0 ({execResult.executionTimeMs}ms)
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-red-400">
                                        <XCircle className="w-3.5 h-3.5" /> Exit {execResult.exitCode}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <pre className="flex-1 bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono overflow-auto whitespace-pre-wrap">
                        {!execResult && (
                            <span className="text-slate-500">
                                Nhấn &quot;Chạy thử Sandbox&quot; để biên dịch và kiểm tra luồng xử lý code của bạn.
                            </span>
                        )}
                        {execResult?.stdout && <div className="text-emerald-300">{execResult.stdout}</div>}
                        {execResult?.stderr && <div className="text-red-400 mt-1">{execResult.stderr}</div>}
                    </pre>
                </div>
            </div>
        </div>
    );
};