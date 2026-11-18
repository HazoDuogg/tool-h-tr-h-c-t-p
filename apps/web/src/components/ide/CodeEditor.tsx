'use client';

import React, { useEffect, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { Cpu, Puzzle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspace.store';
import { detectMonacoLanguage, getEnvironmentPreset } from '../../lib/language-presets';

export const CodeEditor: React.FC = () => {
    const { files, activeFile, updateFileContent, recordPasteAnomaly } = useWorkspaceStore();
    // Lấy thông tin track hiện tại từ store (hỗ trợ cả key activeTrack hoặc track)
    const track = useWorkspaceStore((state: any) => state.activeTrack || state.track);

    const language = track?.language || 'TypeScript';
    const framework = track?.framework || 'Thuần ngôn ngữ (Core)';
    const preset = getEnvironmentPreset(language, framework);

    const [showExtensions, setShowExtensions] = useState(false);

    // Tự động nạp khung dự án chuẩn theo ngôn ngữ nếu workspace chỉ đang có file rỗng mặc định
    useEffect(() => {
        const fileKeys = Object.keys(files);
        if (
            fileKeys.length === 1 &&
            fileKeys[0] === 'src/main.ts' &&
            !language.toLowerCase().includes('typescript')
        ) {
            useWorkspaceStore.setState({
                files: preset.starterFiles,
                activeFile: preset.entryFile,
            });
        }
    }, [language, framework]);

    const handleApplyPresetTemplate = () => {
        useWorkspaceStore.setState({
            files: preset.starterFiles,
            activeFile: preset.entryFile,
        });
    };

    const handleBeforeMount = (monaco: Monaco) => {
        // Bật đầy đủ IntelliSense & kiểm tra kiểu nghiêm ngặt cho TypeScript/JavaScript
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2022,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            moduleDetection: (monaco.languages.typescript as any).ModuleDetectionKind?.Force ?? 3,
            strict: true,
            noEmit: true,
        });

        // Bơm khai báo môi trường Node.js (fs, process, console) để không báo gạch đỏ khi dùng stdin
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `
      declare var console: { log(...args: any[]): void; error(...args: any[]): void; };
      declare var process: { stdin: any; stdout: any; env: Record<string, string>; };
      declare module 'fs' {
        export function readFileSync(fd: number | string, encoding: string): string;
      }
      `,
            'file:///node-env.d.ts'
        );
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Thanh trạng thái Môi trường & Extensions giống VS Code */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px]">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <Cpu className="w-3.5 h-3.5" />
                        Môi trường: {preset.sdkNotes}
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowExtensions(!showExtensions)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 transition"
                    >
                        <Puzzle className="w-3 h-3" />
                        Gói hỗ trợ ({preset.extensions.length})
                    </button>
                </div>

                <button
                    type="button"
                    onClick={handleApplyPresetTemplate}
                    title="Nạp lại cấu trúc tệp mẫu chuẩn của ngôn ngữ & framework này"
                    className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition"
                >
                    <RotateCcw className="w-3 h-3" />
                    Nạp khung mẫu {language}
                </button>
            </div>

            {/* Bảng liệt kê Extensions đang kích hoạt khi bấm vào */}
            {showExtensions && (
                <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap gap-2 text-[11px]">
                    {preset.extensions.map((ext, i) => (
                        <span
                            key={i}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            {ext}
                        </span>
                    ))}
                </div>
            )}

            {/* Trình soạn thảo Monaco tự động đổi cú pháp theo file đang mở */}
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activeFile}
                    language={detectMonacoLanguage(activeFile)}
                    value={files[activeFile] || ''}
                    beforeMount={handleBeforeMount}
                    onChange={(val) => updateFileContent(activeFile, val || '')}
                    onMount={(editor) => {
                        // Chặn dán code dài > 3 dòng từ bên ngoài (Anti-Paste Guard)
                        editor.onDidPaste((e) => {
                            const pastedLines = e.range.endLineNumber - e.range.startLineNumber + 1;
                            if (pastedLines > 3) {
                                editor.trigger('anti-paste', 'undo', null);
                                recordPasteAnomaly();
                            }
                        });
                    }}
                    options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        tabSize: 2,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                    }}
                />
            </div>
        </div>
    );
};