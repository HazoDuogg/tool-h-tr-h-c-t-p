export type TrackStatus =
    | 'IN_PROGRESS'
    | 'CAPSTONE_BLUEPRINT'
    | 'CAPSTONE_CODING'
    | 'LIVE_DEFENSE'
    | 'COMPLETED';

export interface CurriculumModule {
    id: string;
    trackId: string;
    orderIndex: number;
    title: string;
    coreConcepts: string[];
    cleanCodeRules: string[];
    practicePrompts: string[];
    isUnlocked: boolean;
    isPassed: boolean;
}

export interface CapstoneProject {
    id: string;
    trackId: string;
    title: string;
    requirements: string;
    isUserProposed: boolean;
    blueprintPayload?: {
        proposedFolderTree: string;
        proposedDataFlow: string;
    };
    blueprintApproved: boolean;
    blueprintFeedback?: string;
    sourceFiles?: Record<string, string>;
    pasteAnomalyCount: number;
}

export interface LearningTrack {
    id: string;
    language: string;
    framework?: string | null;
    targetFocus: string;
    status: TrackStatus;
    modules: CurriculumModule[];
    capstone?: CapstoneProject | null;
}

export interface SandboxExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    isSuccess: boolean;
}

export interface ModuleExamPayload {
    id: string;
    attemptNumber: number;
    examPayload: {
        theoryQuestions: Array<{ id: string; question: string }>;
        codingProblem: {
            title: string;
            description: string;
            inputFormat: string;
            outputFormat: string;
            starterCode: string;
            testCases: Array<{
                id: string;
                input: string;
                expectedOutput: string;
                isHidden: boolean;
            }>;
        };
    };
}