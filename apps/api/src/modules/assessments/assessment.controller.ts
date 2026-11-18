import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AiAgentsService } from '../../agents/ai-agents.service';
import { CodeSandboxService, TestCaseItem } from '../../sandbox/sandbox.service';
import { AppError } from '../../utils/app-error';

const aiService = new AiAgentsService();
const sandboxService = new CodeSandboxService();
const inFlightExams = new Map<string, Promise<unknown>>();

const runSandboxSchema = z.object({
    language: z.string(),
    files: z.array(z.object({ name: z.string().optional(), content: z.string() })).min(1),
    stdin: z.string().optional(),
});

const submitExamSchema = z.object({
    assessmentId: z.string().uuid(),
    theoryAnswers: z.record(z.string()),
    submittedCode: z.string().min(1, 'Mã nguồn nộp bài không được để trống'),
});

const examDataSchema = z.object({
    codingProblem: z.object({
        testCases: z.array(
            z.object({
                id: z.string(),
                input: z.string(),
                expectedOutput: z.string(),
                isHidden: z.boolean().optional(),
            })
        ),
    }),
});

export class AssessmentController {
    /**
     * Chạy thử code tự do trên Sandbox trong lúc học & luyện tập
     */
    async runCodeSandbox(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const payload = runSandboxSchema.parse(req.body);
            const result = await sandboxService.executeCode(payload);
            res.json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Tạo bài kiểm tra qua môn cho một chương học (Nếu trượt lần trước -> tạo đề mới cho lần thi lại)
     */
    async startModuleExam(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { moduleId } = req.params;

            // Nếu đang có request sinh đề cho chính module này chạy song song -> chờ và dùng chung kết quả
            if (inFlightExams.has(moduleId)) {
                const sharedAssessment = await inFlightExams.get(moduleId);
                return res.json({ status: 'success', data: sharedAssessment });
            }

            const task = (async () => {
                const mod = await prisma.curriculumModule.findUnique({
                    where: { id: moduleId },
                    include: { track: true },
                });

                if (!mod || mod.track.userId !== req.user!.id) {
                    throw new AppError('Không tìm thấy chương học hợp lệ.', 404);
                }

                if (!mod.isUnlocked) {
                    throw new AppError('Chương học này chưa được mở khóa.', 403);
                }

                // Lấy attemptNumber lớn nhất hiện có để tránh trùng lặp
                const latestAssessment = await prisma.moduleAssessment.findFirst({
                    where: { moduleId },
                    orderBy: { attemptNumber: 'desc' },
                });
                const attemptNumber = (latestAssessment?.attemptNumber ?? 0) + 1;

                const examPayload = await aiService.generateModuleExam({
                    language: mod.track.language,
                    framework: mod.track.framework || undefined,
                    moduleTitle: mod.title,
                    coreConcepts: mod.coreConcepts,
                    cleanCodeRules: mod.cleanCodeRules,
                    attemptNumber,
                });

                try {
                    return await prisma.moduleAssessment.create({
                        data: {
                            moduleId,
                            attemptNumber,
                            examPayload,
                        },
                    });
                } catch (err: unknown) {
                    // Phòng hờ trường hợp hiếm vẫn đụng unique constraint -> trả về bản ghi đã tạo
                    if ((err as { code?: string })?.code === 'P2002') {
                        return await prisma.moduleAssessment.findFirstOrThrow({
                            where: { moduleId, attemptNumber },
                        });
                    }
                    throw err;
                }
            })();

            inFlightExams.set(moduleId, task);

            try {
                const assessment = await task;
                res.json({ status: 'success', data: assessment });
            } finally {
                inFlightExams.delete(moduleId);
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Nộp bài kiểm tra -> Sandbox chạy Test Cases -> AI chấm điểm -> Đạt mở chương kế tiếp / Trượt buộc học lại
     */
    async submitModuleExam(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { assessmentId, theoryAnswers, submittedCode } = submitExamSchema.parse(req.body);

            const assessment = await prisma.moduleAssessment.findUnique({
                where: { id: assessmentId },
                include: {
                    module: { include: { track: true } },
                },
            });

            if (!assessment || assessment.module.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy phiên kiểm tra.', 404);
            }

            if (assessment.score !== null) {
                throw new AppError('Bài kiểm tra này đã được chấm điểm. Hãy tạo lượt thi mới nếu cần thi lại.', 400);
            }

            const examData = examDataSchema.parse(assessment.examPayload);

            // 1. Chạy bộ Test Cases thực tế trên Sandbox
            const sandboxResult = await sandboxService.runTestSuite({
                language: assessment.module.track.language,
                files: [{ content: submittedCode }],
                testCases: examData.codingProblem.testCases,
            });

            // 2. AI đánh giá tư duy lý thuyết + Clean Code + kết quả Sandbox
            const grading = await aiService.gradeModuleExam({
                language: assessment.module.track.language,
                cleanCodeRules: assessment.module.cleanCodeRules as string[],
                examPayload: assessment.examPayload,
                theoryAnswers,
                submittedCode,
                sandboxResult,
            });

            // 3. Lưu kết quả chấm điểm
            const updatedAssessment = await prisma.moduleAssessment.update({
                where: { id: assessmentId },
                data: {
                    userSolution: { theoryAnswers, submittedCode },
                    score: grading.score,
                    passed: grading.passed,
                    aiFeedback: grading.feedback,
                    submittedAt: new Date(),
                },
            });

            let nextAction = 'RETAKE_REQUIRED';

            // 4. Điều phối Gatekeeper: Qua môn -> Mở khóa chương tiếp theo hoặc mở khóa Đồ án cuối khóa
            if (grading.passed) {
                await prisma.curriculumModule.update({
                    where: { id: assessment.moduleId },
                    data: { isPassed: true },
                });

                const nextModule = await prisma.curriculumModule.findFirst({
                    where: {
                        trackId: assessment.module.trackId,
                        orderIndex: assessment.module.orderIndex + 1,
                    },
                });

                if (nextModule) {
                    await prisma.curriculumModule.update({
                        where: { id: nextModule.id },
                        data: { isUnlocked: true },
                    });
                    nextAction = 'NEXT_MODULE_UNLOCKED';
                } else {
                    // Đã hoàn thành tất cả các chương -> Chuyển sang giai đoạn làm Đồ án cuối khóa
                    await prisma.learningTrack.update({
                        where: { id: assessment.module.trackId },
                        data: { status: 'CAPSTONE_BLUEPRINT' },
                    });
                    nextAction = 'CAPSTONE_UNLOCKED';
                }
            }

            res.json({
                status: 'success',
                data: {
                    assessment: updatedAssessment,
                    sandboxResult,
                    nextAction,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}