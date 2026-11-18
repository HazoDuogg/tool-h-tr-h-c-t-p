import { GoogleGenAI, Type } from '@google/genai';
import { TestCaseItem, TestSuiteResult } from '../sandbox/sandbox.service';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const FALLBACK_MODELS = [
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
];

type GenerateParams = Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>;

export interface SourceFileMap {
    [filePath: string]: string;
}

export class AiAgentsService {
    /**
     * Tự động thử lần lượt các model Flash nếu gặp lỗi 429 (chạm quota/phút) hoặc 404
     */
    private async generateSafe(params: GenerateParams) {
        let lastError: unknown;

        for (const model of FALLBACK_MODELS) {
            try {
                return await ai.models.generateContent({ ...params, model });
            } catch (err: unknown) {
                lastError = err;
                const message = err instanceof Error ? err.message : String(err);
                const status = (err as { status?: number })?.status;

                if (
                    status === 429 ||
                    status === 404 ||
                    message.includes('429') ||
                    message.includes('404') ||
                    message.includes('RESOURCE_EXHAUSTED')
                ) {
                    console.warn(`[AI Fallback] Model ${model} không khả dụng, chuyển sang model dự phòng...`);
                    continue;
                }
                throw err;
            }
        }

        throw lastError;
    }

    /**
     * 1. ARCHITECT AGENT: Sinh giáo trình chuẩn từ gốc rễ -> clean code
     */
    async generateCurriculum(params: {
        language: string;
        framework?: string;
        targetFocus: string;
        completedLanguages: string[];
    }) {
        const prompt = `
      Bạn là Kiến trúc sư đào tạo kỹ sư phần mềm thực chiến.
      Học viên muốn học: Ngôn ngữ "${params.language}", Framework "${params.framework || 'Thuần ngôn ngữ'}".
      Mục tiêu ứng dụng: "${params.targetFocus}".
      Các ngôn ngữ học viên ĐÃ THÀNH THẠO trước đó: ${params.completedLanguages.join(', ') || 'Chưa có (Người mới)'}.

      Hãy thiết kế giáo trình gồm 5 chương theo trình tự bắt buộc:
      - Nếu học viên chưa biết lập trình: Bắt đầu từ Tư duy thuật toán, biến, luồng điều khiển, cấu trúc dữ liệu.
      - Nếu học viên đã thành thạo ngôn ngữ khác: Lướt nhanh cú pháp cơ bản, tập trung sâu vào bản chất runtime/bộ nhớ, đặc trưng riêng của ${params.language}, kiến trúc của ${params.framework || params.language}, Design Patterns, Clean Code và tổ chức thư mục chuẩn công nghiệp.
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            orderIndex: { type: Type.INTEGER },
                            title: { type: Type.STRING },
                            coreConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                            cleanCodeRules: { type: Type.ARRAY, items: { type: Type.STRING } },
                            practicePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ['orderIndex', 'title', 'coreConcepts', 'cleanCodeRules', 'practicePrompts'],
                    },
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 2. SOCRATIC MENTOR AGENT: Giảng bản chất & luyện tư duy, CẤM viết code thay học viên
     */
    async askSocraticMentor(params: {
        moduleTitle: string;
        language: string;
        framework?: string;
        currentCode: string;
        studentQuestion: string;
    }) {
        const systemInstruction = `
      BẠN LÀ GIẢNG VIÊN LẬP TRÌNH THEO PHƯƠNG PHÁP SOCRATIC.
      QUY TẮC BẤT DI BẤT DỊCH:
      1. TUYỆT ĐỐI KHÔNG viết code giải bài tập hoặc sửa lỗi trực tiếp thay cho học viên.
      2. Khi học viên hỏi hoặc gặp lỗi, hãy giải thích BẢN CHẤT vấn đề (tại sao bộ nhớ/luồng dữ liệu chạy như vậy).
      3. Chia nhỏ bài toán thành các bước tư duy logic (Input -> Xử lý từng bước -> Edge cases -> Output).
      4. Kết thúc câu trả lời bằng 1 câu hỏi gợi mở hoặc 1 gợi ý hướng đi để học viên tự tay gõ code.
      5. Nhắc nhở học viên về Clean Code (đặt tên biến, tách trách nhiệm hàm) nếu thấy code hiện tại của họ lộn xộn.
    `;

        const response = await this.generateSafe({
            contents: `
        Chủ đề đang học: ${params.moduleTitle} (${params.language} ${params.framework || ''})
        Code hiện tại của học viên:
        \`\`\`
        ${params.currentCode}
        \`\`\`
        Câu hỏi của học viên: "${params.studentQuestion}"
      `,
            config: { systemInstruction },
        });

        return response.text!;
    }

    /**
     * 3. EXAMINER AGENT (MODULE EXAM): Sinh đề kiểm tra tư duy & bài code có test cases đọc từ stdin
     */
    async generateModuleExam(params: {
        language: string;
        framework?: string;
        moduleTitle: string;
        coreConcepts: string[];
        cleanCodeRules: string[];
        attemptNumber: number;
    }) {
        const prompt = `
      Bạn là Giảng viên ra đề kiểm tra kết thúc chương "${params.moduleTitle}" (${params.language} ${params.framework || ''}).
      Đây là lần thi thứ ${params.attemptNumber} của học viên.
      Kiến thức trọng tâm: ${params.coreConcepts.join('; ')}.
      Tiêu chuẩn Clean Code: ${params.cleanCodeRules.join('; ')}.

      Hãy tạo 1 đề kiểm tra gồm:
      1. 3 câu hỏi phân tích bản chất / xử lý tình huống (theoryQuestions) yêu cầu giải thích tư duy, không hỏi học vẹt.
      2. 1 bài toán thực hành lập trình (codingProblem) đọc dữ liệu từ Standard Input (stdin) và in kết quả ra Standard Output (stdout), kèm 4 testCases (2 công khai, 2 ẩn kiểm tra edge cases).
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        theoryQuestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    question: { type: Type.STRING },
                                },
                                required: ['id', 'question'],
                            },
                        },
                        codingProblem: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                inputFormat: { type: Type.STRING },
                                outputFormat: { type: Type.STRING },
                                starterCode: { type: Type.STRING },
                                testCases: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            input: { type: Type.STRING },
                                            expectedOutput: { type: Type.STRING },
                                            isHidden: { type: Type.BOOLEAN },
                                        },
                                        required: ['id', 'input', 'expectedOutput', 'isHidden'],
                                    },
                                },
                            },
                            required: ['title', 'description', 'inputFormat', 'outputFormat', 'starterCode', 'testCases'],
                        },
                    },
                    required: ['theoryQuestions', 'codingProblem'],
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 4. EXAMINER AGENT (GRADE MODULE): Chấm điểm bài kiểm tra chương (Thang 10, >= 7.0 mới qua môn)
     */
    async gradeModuleExam(params: {
        language: string;
        cleanCodeRules: string[];
        examPayload: unknown;
        theoryAnswers: Record<string, string>;
        submittedCode: string;
        sandboxResult: TestSuiteResult;
    }) {
        const prompt = `
      Bạn là Giảng viên chấm thi nghiêm khắc. Chấm bài kiểm tra chương ngôn ngữ ${params.language} trên thang điểm 10:
      - Phần 1 (4.0 điểm): Độ sâu sắc và chính xác trong câu trả lời phân tích bản chất (theoryAnswers).
      - Phần 2 (4.0 điểm): Kết quả chạy Test Cases thực tế từ Sandbox (${params.sandboxResult.passedCount}/${params.sandboxResult.total} test cases đạt).
      - Phần 3 (2.0 điểm): Chất lượng Clean Code (${params.cleanCodeRules.join('; ')}).

      Điều kiện qua môn (passed = true): Tổng điểm >= 7.0 VÀ đạt tối thiểu 3/4 test cases.
      Nếu không đạt, hãy chỉ rõ lỗ hổng tư duy để học viên ôn lại và thi lại.

      Đề thi: ${JSON.stringify(params.examPayload)}
      Câu trả lời lý thuyết: ${JSON.stringify(params.theoryAnswers)}
      Code nộp bài: \n${params.submittedCode}
      Kết quả Sandbox: ${JSON.stringify(params.sandboxResult)}
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        passed: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING },
                    },
                    required: ['score', 'passed', 'feedback'],
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 5. CAPSTONE PROPOSER: Gợi ý 3 đồ án thực tế hoặc chuẩn hóa đề xuất của học viên
     */
    async generateCapstoneOptions(params: {
        language: string;
        framework?: string;
        targetFocus: string;
        userCustomIdea?: { title: string; description: string };
    }) {
        const prompt = params.userCustomIdea
            ? `Học viên tự đề xuất đồ án: "${params.userCustomIdea.title}" - Mô tả: "${params.userCustomIdea.description}" cho stack ${params.language} ${params.framework || ''}. Hãy chuẩn hóa thành đặc tả kỹ thuật rõ ràng gồm các chức năng cốt lõi, ràng buộc kiến trúc và tiêu chí đánh giá.`
            : `Đề xuất 3 đồ án tốt nghiệp thực chiến (từ vừa đến nâng cao) phù hợp với stack ${params.language} ${params.framework || ''} và mục tiêu "${params.targetFocus}". Mỗi đồ án phải đủ độ phức tạp để đánh giá tư duy kiến trúc, xử lý dữ liệu và Clean Code.`;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            requirements: { type: Type.STRING },
                            estimatedComplexity: { type: Type.STRING },
                        },
                        required: ['title', 'requirements', 'estimatedComplexity'],
                    },
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 6. BLUEPRINT GATE: Kiểm duyệt thiết kế kiến trúc & cây thư mục trước khi cho phép code đồ án
     */
    async reviewProjectBlueprint(params: {
        projectTitle: string;
        requirements: string;
        proposedFolderTree: string;
        proposedDataFlow: string;
    }) {
        const prompt = `
      Bạn là Tech Lead đang duyệt thiết kế (Blueprint Gate) cho đồ án: "${params.projectTitle}".
      Yêu cầu đồ án: "${params.requirements}".
      Học viên nộp thiết kế:
      - Cây thư mục: \n${params.proposedFolderTree}
      - Luồng xử lý dữ liệu & phân chia module: \n${params.proposedDataFlow}

      Hãy đánh giá xem cấu trúc này có tách bạch trách nhiệm (Separation of Concerns), dễ mở rộng, dễ bảo trì và đáp ứng đủ yêu cầu đề bài chưa. Chỉ duyệt (approved: true) khi thiết kế thực sự hợp lý.
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        approved: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING },
                        requiredImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['approved', 'feedback', 'requiredImprovements'],
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 7. EXAMINER AGENT (LIVE DEFENSE): Soi source code đồ án và tạo 3 yêu cầu sửa trực tiếp
     */
    async generateLiveDefenseChallenges(params: {
        projectTitle: string;
        requirements: string;
        sourceFiles: SourceFileMap;
    }) {
        const prompt = `
      Bạn là Chủ tịch Hội đồng Bảo vệ Đồ án Lập trình.
      Học viên vừa nộp sản phẩm: "${params.projectTitle}" (Yêu cầu: ${params.requirements}).
      Toàn bộ mã nguồn học viên đã viết:
      ${JSON.stringify(params.sourceFiles, null, 2)}

      Tạo ra ĐÚNG 3 YÊU CẦU SỬA ĐỔI TRỰC TIẾP (Live Coding Challenges) chỉ đích danh file/hàm trong mã nguồn của học viên:
      - Yêu cầu 1 (Cơ bản): Bổ sung xử lý trường hợp biên (Edge case) hoặc validation đang thiếu.
      - Yêu cầu 2 (Trung bình): Mở rộng hoặc thay đổi một nghiệp vụ nhỏ dựa trên hàm/class hiện có.
      - Yêu cầu 3 (Kiến trúc/Tối ưu): Tái cấu trúc (Refactor) đoạn code bị lặp/rối hoặc tối ưu hiệu năng.
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            challengeIndex: { type: Type.INTEGER },
                            instruction: { type: Type.STRING },
                            targetFilePaths: { type: Type.ARRAY, items: { type: Type.STRING } },
                            expectedBehavior: { type: Type.STRING },
                        },
                        required: ['challengeIndex', 'instruction', 'targetFilePaths', 'expectedBehavior'],
                    },
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
     * 8. FINAL GRADING ENGINE: Chấm điểm đồ án trên thang 10 (4 Logic + 3 CleanCode + 3 LiveDefense)
     */
    async evaluateCapstoneAndDefense(params: {
        requirements: string;
        initialFiles: SourceFileMap;
        pasteAnomalyCount: number;
        defenseResults: Array<{
            challengeIndex: number;
            instruction: string;
            expectedBehavior: string;
            updatedFiles: SourceFileMap;
        }>;
    }) {
        const prompt = `
      Bạn là Giám khảo chấm điểm tốt nghiệp lập trình. Đánh giá nghiêm khắc theo thang điểm 10:
      1. logicScore (0.0 - 4.0): Tính đúng đắn của thuật toán, xử lý đầy đủ nghiệp vụ và edge cases.
      2. cleanCodeScore (0.0 - 3.0): Tổ chức thư mục chuẩn, chia nhỏ hàm/module, đặt tên rõ nghĩa.
      3. defenseScore (0.0 - 3.0): Đánh giá 3 yêu cầu sửa code trực tiếp (Mỗi yêu cầu đạt được tối đa 1.0 điểm).
         - Quy tắc cứng: Nếu đạt 0/3 yêu cầu -> defenseScore = 0, bắt buộc đánh trượt (passed: false).
         - Nếu đạt 1/3 yêu cầu -> có thể đạt vừa đủ nếu totalScore >= 5.0, nhưng điểm defenseScore tối đa 1.0.
      Lưu ý: Số lần cảnh báo dán code bất thường (pasteAnomalyCount) của học viên là ${params.pasteAnomalyCount}.

      Yêu cầu đề bài: ${params.requirements}
      Mã nguồn ban đầu: ${JSON.stringify(params.initialFiles)}
      Kết quả thực hiện 3 yêu cầu sửa trực tiếp: ${JSON.stringify(params.defenseResults)}
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        logicScore: { type: Type.NUMBER },
                        cleanCodeScore: { type: Type.NUMBER },
                        defenseScore: { type: Type.NUMBER },
                        totalScore: { type: Type.NUMBER },
                        challengeEvaluations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    challengeIndex: { type: Type.INTEGER },
                                    isPassed: { type: Type.BOOLEAN },
                                    feedback: { type: Type.STRING },
                                },
                                required: ['challengeIndex', 'isPassed', 'feedback'],
                            },
                        },
                        finalReview: { type: Type.STRING },
                        passed: { type: Type.BOOLEAN },
                    },
                    required: [
                        'logicScore',
                        'cleanCodeScore',
                        'defenseScore',
                        'totalScore',
                        'challengeEvaluations',
                        'finalReview',
                        'passed',
                    ],
                },
            },
        });

        return JSON.parse(response.text!);
    }

    /**
   * 9. VISUAL LESSON GENERATOR: Soạn bài giảng súc tích, có sơ đồ minh họa & so sánh Bad/Clean Code
   */
    async generateConceptLesson(params: {
        language: string;
        framework?: string;
        moduleTitle: string;
        conceptTitle: string;
    }) {
        const prompt = `
      Bạn là Chuyên gia đào tạo kỹ sư phần mềm nổi tiếng với phong cách dạy TRỰC QUAN - NGẮN GỌN - DỄ HÌNH DUNG.
      Hãy soạn bài giảng cho chủ đề: "${params.conceptTitle}"
      Thuộc chương: "${params.moduleTitle}" | Stack: ${params.language} (${params.framework || 'Core'}).

      NGUYÊN TẮC BẮT BUỘC (VI PHẠM LÀ THẤT BẠI):
      1. Tham chiếu kiến thức chuẩn xác nhất từ tài liệu chính thống (Official Docs của ${params.language}${params.framework ? ` / ${params.framework}` : ''}, MDN, Clean Code).
      2. CHỐNG NGÁN CHỮ: Tuyệt đối KHÔNG viết đoạn văn dài. Mọi câu giải thích phải cực kỳ súc tích, đi thẳng vào bản chất.
      3. visualDiagram: Vẽ sơ đồ ASCII đơn giản (tối đa 5-7 dòng) minh họa luồng chạy hoặc bộ nhớ để người đọc nhìn 3 giây là hiểu.
      4. keyPoints: Đúng 3 ý cốt lõi, mỗi ý dưới 15 từ.
      5. badCode vs cleanCode: Mỗi đoạn code chỉ dài 4-8 dòng bằng ngôn ngữ ${params.language}, minh họa rõ sự khác biệt.
    `;

        const response = await this.generateSafe({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        officialSource: { type: Type.STRING },
                        tldr: { type: Type.STRING },
                        visualDiagram: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        badCode: { type: Type.STRING },
                        cleanCode: { type: Type.STRING },
                        whyBetter: { type: Type.STRING },
                        commonPitfall: { type: Type.STRING },
                        microPractice: { type: Type.STRING },
                    },
                    required: [
                        'officialSource',
                        'tldr',
                        'visualDiagram',
                        'keyPoints',
                        'badCode',
                        'cleanCode',
                        'whyBetter',
                        'commonPitfall',
                        'microPractice',
                    ],
                },
            },
        });

        return JSON.parse(response.text!);
    }
}