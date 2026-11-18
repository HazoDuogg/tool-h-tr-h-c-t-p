import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AiAgentsService, SourceFileMap } from '../../agents/ai-agents.service';
import { AppError } from '../../utils/app-error';

const aiService = new AiAgentsService();

const selectCapstoneSchema = z.object({
    title: z.string().min(3),
    requirements: z.string().min(10),
    isUserProposed: z.boolean().default(false),
});

const submitBlueprintSchema = z.object({
    proposedFolderTree: z.string().min(10, 'Vui lòng mô tả cấu trúc cây thư mục dự án'),
    proposedDataFlow: z.string().min(20, 'Vui lòng mô tả luồng dữ liệu và cách chia module'),
});

const submitCodeForDefenseSchema = z.object({
    sourceFiles: z.record(z.string()).refine((files) => Object.keys(files).length > 0, {
        message: 'Dự án phải có ít nhất 1 tệp mã nguồn',
    }),
    pasteAnomalyCount: z.number().int().min(0).default(0),
});

const submitChallengeSchema = z.object({
    challengeId: z.string().uuid(),
    updatedFiles: z.record(z.string()),
});

export class CapstoneController {
    /**
     * 1. Gợi ý 3 đồ án hoặc chuẩn hóa đề xuất đồ án của học viên
     */
    async getOrProposeOptions(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { trackId } = req.params;
            const customIdea = req.body?.customIdea as { title: string; description: string } | undefined;

            const track = await prisma.learningTrack.findUnique({ where: { id: trackId } });
            if (!track || track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy lộ trình học.', 404);
            }

            if (track.status === 'IN_PROGRESS') {
                throw new AppError('Bạn phải vượt qua tất cả bài kiểm tra chương trước khi vào giai đoạn Đồ án.', 403);
            }

            const options = await aiService.generateCapstoneOptions({
                language: track.language,
                framework: track.framework || undefined,
                targetFocus: track.targetFocus,
                userCustomIdea: customIdea,
            });

            res.json({ status: 'success', data: options });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 2. Chốt đề tài đồ án
     */
    async confirmCapstoneTopic(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { trackId } = req.params;
            const data = selectCapstoneSchema.parse(req.body);

            const track = await prisma.learningTrack.findUnique({ where: { id: trackId } });
            if (!track || track.userId !== req.user!.id || track.status === 'IN_PROGRESS') {
                throw new AppError('Chưa đủ điều kiện chọn đồ án cuối khóa.', 403);
            }

            const capstone = await prisma.capstoneProject.upsert({
                where: { trackId },
                update: {
                    title: data.title,
                    requirements: data.requirements,
                    isUserProposed: data.isUserProposed,
                    blueprintApproved: false,
                },
                create: {
                    trackId,
                    title: data.title,
                    requirements: data.requirements,
                    isUserProposed: data.isUserProposed,
                },
            });

            res.status(201).json({ status: 'success', data: capstone });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 3. BLUEPRINT GATE: Nộp thiết kế kiến trúc & cây thư mục -> Tech Lead AI duyệt mới được code
     */
    async submitBlueprint(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { trackId } = req.params;
            const { proposedFolderTree, proposedDataFlow } = submitBlueprintSchema.parse(req.body);

            const capstone = await prisma.capstoneProject.findUnique({
                where: { trackId },
                include: { track: true },
            });

            if (!capstone || capstone.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy đồ án.', 404);
            }

            const review = await aiService.reviewProjectBlueprint({
                projectTitle: capstone.title,
                requirements: capstone.requirements,
                proposedFolderTree,
                proposedDataFlow,
            });

            const updatedCapstone = await prisma.capstoneProject.update({
                where: { id: capstone.id },
                data: {
                    blueprintPayload: { proposedFolderTree, proposedDataFlow },
                    blueprintApproved: review.approved,
                    blueprintFeedback: review.feedback,
                },
            });

            if (review.approved) {
                await prisma.learningTrack.update({
                    where: { id: trackId },
                    data: { status: 'CAPSTONE_CODING' },
                });
            }

            res.json({
                status: 'success',
                data: {
                    capstone: updatedCapstone,
                    review,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 4. Nộp sản phẩm hoàn thiện -> Khởi tạo phiên Bảo vệ trực tiếp (Live Defense) với 3 yêu cầu sửa code & đồng hồ 45 phút
     */
    async startLiveDefense(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { trackId } = req.params;
            const { sourceFiles, pasteAnomalyCount } = submitCodeForDefenseSchema.parse(req.body);

            const capstone = await prisma.capstoneProject.findUnique({
                where: { trackId },
                include: {
                    track: true,
                    defenseSessions: true,
                },
            });

            if (!capstone || capstone.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy đồ án.', 404);
            }

            if (!capstone.blueprintApproved) {
                throw new AppError('Thiết kế kiến trúc (Blueprint) chưa được duyệt. Không thể nộp code.', 403);
            }

            // Lưu mã nguồn sản phẩm
            await prisma.capstoneProject.update({
                where: { id: capstone.id },
                data: { sourceFiles, pasteAnomalyCount },
            });

            await prisma.learningTrack.update({
                where: { id: trackId },
                data: { status: 'LIVE_DEFENSE' },
            });

            // AI soi mã nguồn của chính học viên và tạo 3 yêu cầu sửa đổi trực tiếp
            const generatedChallenges = await aiService.generateLiveDefenseChallenges({
                projectTitle: capstone.title,
                requirements: capstone.requirements,
                sourceFiles,
            });

            // Giới hạn thời gian bảo vệ trực tiếp: 45 phút
            const startedAt = new Date();
            const expiresAt = new Date(startedAt.getTime() + 45 * 60 * 1000);

            const session = await prisma.defenseSession.create({
                data: {
                    capstoneId: capstone.id,
                    attemptNumber: capstone.defenseSessions.length + 1,
                    status: 'IN_PROGRESS',
                    startedAt,
                    expiresAt,
                    challenges: {
                        create: generatedChallenges.map((c: {
                            challengeIndex: number;
                            instruction: string;
                            targetFilePaths: string[];
                            expectedBehavior: string;
                        }) => ({
                            challengeIndex: c.challengeIndex,
                            instruction: c.instruction,
                            targetFilePaths: c.targetFilePaths,
                            expectedBehavior: c.expectedBehavior,
                        })),
                    },
                },
                include: {
                    challenges: {
                        orderBy: { challengeIndex: 'asc' },
                        select: {
                            id: true,
                            challengeIndex: true,
                            instruction: true,
                            targetFilePaths: true,
                        },
                    },
                },
            });

            res.status(201).json({ status: 'success', data: session });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 5. Lưu từng bài sửa trong 3 yêu cầu Live Defense (Kiểm tra giới hạn thời gian thực)
     */
    async saveChallengeSolution(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { challengeId, updatedFiles } = submitChallengeSchema.parse(req.body);

            const challenge = await prisma.defenseChallenge.findUnique({
                where: { id: challengeId },
                include: {
                    session: { include: { capstone: { include: { track: true } } } },
                },
            });

            if (!challenge || challenge.session.capstone.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy thử thách bảo vệ.', 404);
            }

            if (new Date() > challenge.session.expiresAt) {
                throw new AppError('Đã hết thời gian bảo vệ đồ án trực tiếp!', 403);
            }

            const updated = await prisma.defenseChallenge.update({
                where: { id: challengeId },
                data: { submittedFiles: updatedFiles },
            });

            res.json({ status: 'success', data: updated });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 6. Kết thúc buổi Bảo vệ -> Chấm điểm tổng hợp thang 10 -> Đạt (tối thiểu 1/3 sửa code & >= 5.0đ) cấp Bằng khen, 0/3 buộc làm lại
     */
    async finalizeDefense(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { sessionId } = req.params;

            const session = await prisma.defenseSession.findUnique({
                where: { id: sessionId },
                include: {
                    challenges: { orderBy: { challengeIndex: 'asc' } },
                    capstone: { include: { track: true } },
                },
            });

            if (!session || session.capstone.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy phiên bảo vệ.', 404);
            }

            const initialFiles = (session.capstone.sourceFiles || {}) as SourceFileMap;

            const defenseResults = session.challenges.map((c: {
                challengeIndex: number;
                instruction: string;
                expectedBehavior: string;
                submittedFiles: unknown;
            }) => ({
                challengeIndex: c.challengeIndex,
                instruction: c.instruction,
                expectedBehavior: c.expectedBehavior,
                updatedFiles: (c.submittedFiles || initialFiles) as SourceFileMap,
            }));

            const grading = await aiService.evaluateCapstoneAndDefense({
                requirements: session.capstone.requirements,
                initialFiles,
                pasteAnomalyCount: session.capstone.pasteAnomalyCount,
                defenseResults,
            });

            // Cập nhật từng challenge (đạt / trượt)
            let passedChallengeCount = 0;
            for (const evalItem of grading.challengeEvaluations) {
                const target = session.challenges.find((c: { id: string; challengeIndex: number }) => c.challengeIndex === evalItem.challengeIndex);
                if (target) {
                    if (evalItem.isPassed) passedChallengeCount++;
                    await prisma.defenseChallenge.update({
                        where: { id: target.id },
                        data: { isPassed: evalItem.isPassed, aiEvaluation: evalItem.feedback },
                    });
                }
            }

            // Quy tắc cứng: 0/3 thử thách sửa code đạt => bắt buộc trượt và làm lại đồ án
            const isFinalPassed = passedChallengeCount >= 1 && grading.passed && grading.totalScore >= 5.0;

            await prisma.defenseSession.update({
                where: { id: sessionId },
                data: { status: isFinalPassed ? 'PASSED' : 'FAILED' },
            });

            const updatedCapstone = await prisma.capstoneProject.update({
                where: { id: session.capstone.id },
                data: {
                    logicScore: grading.logicScore,
                    cleanCodeScore: grading.cleanCodeScore,
                    defenseScore: grading.defenseScore,
                    totalScore: grading.totalScore,
                    finalReview: grading.finalReview,
                },
            });

            let certificate = null;

            if (isFinalPassed) {
                await prisma.learningTrack.update({
                    where: { id: session.capstone.trackId },
                    data: { status: 'COMPLETED' },
                });

                const verificationCode = `CERT-${session.capstone.track.language.toUpperCase()}-${crypto
                    .randomBytes(4)
                    .toString('hex')
                    .toUpperCase()}`;

                certificate = await prisma.certificate.create({
                    data: {
                        verificationCode,
                        userId: req.user!.id,
                        trackId: session.capstone.trackId,
                        language: session.capstone.track.language,
                        framework: session.capstone.track.framework,
                        projectTitle: session.capstone.title,
                        finalScore: grading.totalScore,
                    },
                });
            } else {
                // Trượt bảo vệ -> Reset trạng thái về CAPSTONE_CODING để học viên làm lại đồ án
                await prisma.learningTrack.update({
                    where: { id: session.capstone.trackId },
                    data: { status: 'CAPSTONE_CODING' },
                });
            }

            res.json({
                status: 'success',
                data: {
                    passed: isFinalPassed,
                    passedChallengeCount: `${passedChallengeCount}/3`,
                    capstone: updatedCapstone,
                    challengeEvaluations: grading.challengeEvaluations,
                    certificate,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
   * Lấy thông tin phiên bảo vệ đang diễn ra (IN_PROGRESS) kèm mã nguồn gốc của đồ án
   */
    async getActiveDefenseSession(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { trackId } = req.params;

            const capstone = await prisma.capstoneProject.findUnique({
                where: { trackId },
                include: {
                    track: { select: { id: true, userId: true, language: true, framework: true } },
                    defenseSessions: {
                        where: { status: 'IN_PROGRESS' },
                        orderBy: { attemptNumber: 'desc' },
                        take: 1,
                        include: {
                            challenges: {
                                orderBy: { challengeIndex: 'asc' },
                                select: {
                                    id: true,
                                    challengeIndex: true,
                                    instruction: true,
                                    targetFilePaths: true,
                                    submittedFiles: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!capstone || capstone.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy thông tin đồ án.', 404);
            }

            const activeSession = capstone.defenseSessions[0];
            if (!activeSession) {
                throw new AppError('Hiện không có phiên bảo vệ nào đang mở cho đồ án này.', 404);
            }

            res.json({
                status: 'success',
                data: {
                    track: {
                        id: capstone.track.id,
                        language: capstone.track.language,
                        framework: capstone.track.framework,
                    },
                    capstone: {
                        id: capstone.id,
                        title: capstone.title,
                        requirements: capstone.requirements,
                        sourceFiles: capstone.sourceFiles || {},
                    },
                    session: activeSession,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}