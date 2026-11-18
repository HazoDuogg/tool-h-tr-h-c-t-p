'use client';

import React, { useState, useRef } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import {
    FileCode2,
    Play,
    Save,
    GitCompare,
    Code2,
    ShieldAlert,
    CheckCircle2,
    Target,
} from 'lucide-react';
import { apiRequest } from '../../lib/api-client';
import { SandboxExecutionResult } from '../../types/platform';

interface DefenseChallengeEditorProps {
    language: string;
    originalFiles: Record<string, string>;
    workingFiles: Record<string, string>;
    targetFilePaths: string[];
    isSaved: boolean;
    isSaving: boolean;
    isTimeExpired: boolean;
    onUpdateFile: (filePath: string, content: string) => void;
    onSaveChallenge: () => void;
}

function resolveMonacoLang(filePath: string, fallback: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        java: 'java',
        cs: 'csharp',
        cpp: 'cpp',
        go: 'go',
        json: 'json',
    };
    return (ext && map[ext]) || fallback.toLowerCase().replace('#', 'sharp');
}

export const DefenseChallengeEditor: React.FC<DefenseChallengeEditorProps> = ({
    language,
    originalFiles,
    workingFiles,
    targetFilePaths,
    isSaved,
    isSaving,
    isTimeExpired,
    onUpdateFile,
    onSaveChallenge,
}) => {
    const fileList = Object.keys(workingFiles);
    const initialActive =
        targetFilePaths.find((p) => workingFiles[p] !== undefined) || fileList[0] || '';

    const [activeFile, setActiveFile] = useState<string>(initialActive);
    const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');
    const [pasteWarning, setPasteWarning] = useState<string | null>(null);
    const [internalClip, setInternalClip] = useState('');

    // Sandbox Test Run
    const [stdin, setStdin] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [runOutput, setRunOutput] = useState<SandboxExecutionResult | null>(null);

    const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);

    const currentFile = workingFiles[activeFile] !== undefined ? activeFile : fileList[0] || '';

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;

        editor.onKeyDown((e) => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
                const selection = editor.getSelection();
                const model = editor.getModel();
                if (selection && model) {
                    const text = model.getValueInRange(selection);
                    if (text) setInternalClip(text);
                }
            }
        });

        editor.onDidPaste((e) => {
            const model = editor.getModel();
            if (!model) return;
            const pasted = model.getValueInRange(e.range);
            const lines = e.range.endLineNumber - e.range.startLineNumber + 1;
            const isInternal = internalClip.trim().length > 0 && pasted.trim() === internalClip.trim();

            if (!isInternal && (pasted.length > 50 || lines > 2)) {
                editor.trigger('defense-anti-paste', 'undo', null);
                setPasteWarning(
                    `Đã chặn thao tác dán ${pasted.length} ký tự từ bên ngoài trong giờ Bảo vệ Đồ án!`
                );
            }
        });
    };

    const handleRunTest = async () => {
        setIsRunning(true);
        setRunOutput(null);
        try {
            const orderedFiles = [
                { name: currentFile, content: workingFiles[currentFile] || '' },
                ...Object.entries(workingFiles)
                    .filter(([path]) => path !== currentFile)
                    .map(([name, content]) => ({ name, content })),
            ];

            const res = await apiRequest<SandboxExecutionResult>('/assessments/sandbox/run', {
                method: 'POST',
                body: JSON.stringify({
                    language,
                    files: orderedFiles,
                    stdin,
                }),
            });
            setRunOutput(res);
        } catch (err) {
            setRunOutput({
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

    return (
        <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            {/* Cảnh báo Anti-Paste nếu vi phạm */}
            {pasteWarning && (
                <div className="bg-red-950 border-b border-red-700 px-4 py-2 flex items-center justify-between text-xs text-red-200">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{pasteWarning}</span>
                    </div>
                    <button
                        onClick={() => setPasteWarning(null)}
                        className="text-[11px] underline text-red-300 hover:text-white"
                    >
                        Đóng
                    </button>
                </div>
            )}

            {/* Thanh công cụ trên cùng */}
            <div className="h-11 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('edit')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'edit'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        Sửa Code Trực tiếp
                    </button>

                    <button
                        onClick={() => setViewMode('diff')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'diff'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                    >
                        <GitCompare className="w-3.5 h-3.5" />
                        So sánh Thay đổi (Diff)
                    </button>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={handleRunTest}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium rounded border border-slate-700 transition"
                    >
                        <Play className="w-3.5 h-3.5" />
                        {isRunning ? 'Đang chạy...' : 'Chạy thử'}
                    </button>

                    <button
                        onClick={onSaveChallenge}
                        disabled={isSaving || isTimeExpired}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded transition"
                    >
                        {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {isSaving ? 'Đang lưu...' : isSaved ? 'Đã lưu bài sửa' : 'Lưu bài sửa Yêu cầu này'}
                    </button>
                </div>
            </div>

            {/* Khu vực File Explorer + Editor */}
            <div className="flex-1 flex min-h-0">
                {/* Danh sách file của đồ án */}
                <div className="w-56 bg-slate-900/70 border-r border-slate-800 flex flex-col">
                    <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Tệp Mã nguồn Đồ án
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                        {fileList.map((filePath) => {
                            const isTarget = targetFilePaths.some(
                                (t) => filePath.endsWith(t) || t.endsWith(filePath)
                            );
                            const isSelected = filePath === currentFile;

                            return (
                                <button
                                    key={filePath}
                                    onClick={() => setActiveFile(filePath)}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-1.5 transition ${isSelected
                                            ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 truncate">
                                        <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate font-mono">{filePath}</span>
                                    </div>
                                    {isTarget && (
                                        <span
                                            title="File được Hội đồng chỉ định sửa"
                                            className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] shrink-0"
                                        >
                                            <Target className="w-2.5 h-2.5" />
                                            Sửa
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Monaco Editor hoặc DiffEditor */}
                <div className="flex-1 min-w-0">
                    {viewMode === 'edit' ? (
                        <Editor
                            height="100%"
                            theme="vs-dark"
                            path={currentFile}
                            language={resolveMonacoLang(currentFile, language)}
                            value={workingFiles[currentFile] || ''}
                            onChange={(val) => onUpdateFile(currentFile, val || '')}
                            onMount={handleEditorMount}
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                readOnly: isTimeExpired,
                                automaticLayout: true,
                                tabSize: 2,
                            }}
                        />
                    ) : (
                        <DiffEditor
                            height="100%"
                            theme="vs-dark"
                            language={resolveMonacoLang(currentFile, language)}
                            original={originalFiles[currentFile] || ''}
                            modified={workingFiles[currentFile] || ''}
                            options={{
                                fontSize: 13,
                                readOnly: true,
                                renderSideBySide: true,
                                automaticLayout: true,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Console kiểm tra nhanh */}
            <div className="h-32 bg-slate-900 border-t border-slate-800 grid grid-cols-12">
                <div className="col-span-4 border-r border-slate-800 p-2 flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Test Input (stdin)
                    </span>
                    <textarea
                        value={stdin}
                        onChange={(e) => setStdin(e.target.value)}
                        placeholder="Dữ liệu test..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-slate-200 resize-none focus:outline-none"
                    />
                </div>
                <div className="col-span-8 p-2 flex flex-col overflow-hidden">
                    <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Kết quả chạy thử
                    </span>
                    <pre className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono overflow-auto whitespace-pre-wrap">
                        {!runOutput && (
                            <span className="text-slate-500">
                                Chạy thử để kiểm tra logic trước khi bấm "Lưu bài sửa Yêu cầu này".
                            </span>
                        )}
                        {runOutput?.stdout && <span className="text-emerald-300">{runOutput.stdout}</span>}
                        {runOutput?.stderr && <span className="text-red-400">{runOutput.stderr}</span>}
                    </pre>
                </div>
            </div>
        </div>
    );
};