export interface DefenseChallengeItem {
    id: string;
    challengeIndex: number; // 1, 2, hoặc 3
    instruction: string;
    targetFilePaths: string[];
    submittedFiles?: Record<string, string> | null;
}

export interface ActiveDefensePayload {
    track: {
        id: string;
        language: string;
        framework?: string | null;
    };
    capstone: {
        id: string;
        title: string;
        requirements: string;
        sourceFiles: Record<string, string>;
    };
    session: {
        id: string;
        attemptNumber: number;
        status: 'IN_PROGRESS' | 'PASSED' | 'FAILED';
        startedAt: string;
        expiresAt: string;
        challenges: DefenseChallengeItem[];
    };
}

export interface DefenseFinalEvaluation {
    passed: boolean;
    passedChallengeCount: string; // VD: "2/3"
    capstone: {
        id: string;
        title: string;
        logicScore: number;
        cleanCodeScore: number;
        defenseScore: number;
        totalScore: number;
        finalReview: string;
    };
    challengeEvaluations: Array<{
        challengeIndex: number;
        isPassed: boolean;
        feedback: string;
    }>;
    certificate: {
        id: string;
        verificationCode: string;
        language: string;
        framework?: string | null;
        projectTitle: string;
        finalScore: number;
        issuedAt: string;
    } | null;
}

export interface VerifiedCertificate {
    id: string;
    verificationCode: string;
    language: string;
    framework?: string | null;
    projectTitle: string;
    finalScore: number;
    issuedAt: string;
    user: {
        fullName: string;
    };
}