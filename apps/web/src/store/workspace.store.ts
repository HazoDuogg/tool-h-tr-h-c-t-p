import { create } from 'zustand';
import { LearningTrack, CurriculumModule } from '../types/platform';

export interface PasteAlert {
    id: string;
    timestamp: string;
    charCount: number;
    lineCount: number;
    message: string;
}

interface WorkspaceState {
    track: LearningTrack | null;
    activeModuleId: string | null;

    // Quản lý IDE đa file
    files: Record<string, string>;
    activeFile: string;

    // Hệ thống chống dán code từ bên ngoài (Anti-Paste Guard)
    internalClipboard: string;
    pasteAnomalyCount: number;
    pasteAlerts: PasteAlert[];

    // Actions
    setTrack: (track: LearningTrack) => void;
    selectModule: (moduleId: string) => void;
    getActiveModule: () => CurriculumModule | undefined;

    initFiles: (initialFiles: Record<string, string>) => void;
    setActiveFile: (filePath: string) => void;
    updateFileContent: (filePath: string, content: string) => void;
    createFile: (filePath: string, initialContent?: string) => void;
    deleteFile: (filePath: string) => void;

    setInternalClipboard: (text: string) => void;
    recordPasteViolation: (charCount: number, lineCount: number) => void;

    recordPasteAnomaly: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    track: null,
    activeModuleId: null,
    files: {
        'src/main.ts': '// Viết mã nguồn của bạn tại đây. Tuyệt đối tự tư duy từng dòng logic!\n',
    },
    activeFile: 'src/main.ts',
    internalClipboard: '',
    pasteAnomalyCount: 0,
    pasteAlerts: [],

    recordPasteAnomaly: () =>
        set((state) => ({
            pasteAnomalyCount: (state.pasteAnomalyCount || 0) + 1,
        })),

    setTrack: (track) => {
        const firstUnlocked =
            track.modules.find((m) => m.isUnlocked && !m.isPassed) ||
            track.modules.find((m) => m.isUnlocked) ||
            track.modules[0];

        set({
            track,
            activeModuleId: get().activeModuleId || firstUnlocked?.id || null,
        });
    },

    selectModule: (moduleId) => {
        const mod = get().track?.modules.find((m) => m.id === moduleId);
        if (mod && mod.isUnlocked) {
            set({ activeModuleId: moduleId });
        }
    },

    getActiveModule: () => {
        const { track, activeModuleId } = get();
        return track?.modules.find((m) => m.id === activeModuleId);
    },

    initFiles: (initialFiles) => {
        const keys = Object.keys(initialFiles);
        set({
            files: initialFiles,
            activeFile: keys[0] || 'main.txt',
        });
    },

    setActiveFile: (filePath) => set({ activeFile: filePath }),

    updateFileContent: (filePath, content) =>
        set((state) => ({
            files: { ...state.files, [filePath]: content },
        })),

    createFile: (filePath, initialContent = '') =>
        set((state) => {
            const cleanPath = filePath.trim().replace(/^\/+/, '');
            if (!cleanPath || state.files[cleanPath] !== undefined) return state;
            return {
                files: { ...state.files, [cleanPath]: initialContent },
                activeFile: cleanPath,
            };
        }),

    deleteFile: (filePath) =>
        set((state) => {
            const keys = Object.keys(state.files);
            if (keys.length <= 1) return state;
            const nextFiles = { ...state.files };
            delete nextFiles[filePath];
            const remainingKeys = Object.keys(nextFiles);
            return {
                files: nextFiles,
                activeFile: state.activeFile === filePath ? remainingKeys[0] : state.activeFile,
            };
        }),

    setInternalClipboard: (text) => set({ internalClipboard: text }),

    recordPasteViolation: (charCount, lineCount) =>
        set((state) => {
            const alert: PasteAlert = {
                id: crypto.randomUUID(),
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                charCount,
                lineCount,
                message: `Phát hiện dán ${charCount} ký tự (${lineCount} dòng) từ nguồn bên ngoài. Thao tác đã bị chặn và ghi nhận vào hồ sơ đánh giá!`,
            };
            return {
                pasteAnomalyCount: state.pasteAnomalyCount + 1,
                pasteAlerts: [alert, ...state.pasteAlerts].slice(0, 5),
            };
        }),
}));