import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AiAgentsService } from '../../agents/ai-agents.service';
import { AppError } from '../../utils/app-error';

const aiService = new AiAgentsService();

const createTrackSchema = z.object({
    language: z.string().min(1, 'Vui lòng chọn ngôn ngữ lập trình'),
    framework: z.string().optional(),
    targetFocus: z.string().min(5, 'Vui lòng mô tả mục tiêu học tập/sản phẩm mong muốn'),
});

const mentorChatSchema = z.object({
    moduleId: z.string().uuid(),
    currentCode: z.string().default(''),
    question: z.string().min(2, 'Câu hỏi quá ngắn'),
});

export class TrackController {
    /**
     * Đăng ký lộ trình học ngôn ngữ / framework mới (có thể đăng ký nhiều lần)
     */
    async createTrack(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const body = createTrackSchema.parse(req.body);

            // Lấy danh sách ngôn ngữ học viên đã tốt nghiệp trước đó để AI tối ưu giáo trình
            const completedTracks = await prisma.learningTrack.findMany({
                where: { userId, status: 'COMPLETED' },
                select: { language: true },
            });
            const completedLanguages = Array.from(new Set<string>(completedTracks.map((t: { language: string }) => t.language)));

            const generatedModules = await aiService.generateCurriculum({
                language: body.language,
                framework: body.framework,
                targetFocus: body.targetFocus,
                completedLanguages,
            });

            const track = await prisma.learningTrack.create({
                data: {
                    userId,
                    language: body.language,
                    framework: body.framework,
                    targetFocus: body.targetFocus,
                    modules: {
                        create: generatedModules.map((mod: {
                            orderIndex: number;
                            title: string;
                            coreConcepts: string[];
                            cleanCodeRules: string[];
                            practicePrompts: string[];
                        }) => ({
                            orderIndex: mod.orderIndex,
                            title: mod.title,
                            coreConcepts: mod.coreConcepts,
                            cleanCodeRules: mod.cleanCodeRules,
                            practicePrompts: mod.practicePrompts,
                            // Chỉ mở khóa chương đầu tiên (orderIndex === 1)
                            isUnlocked: mod.orderIndex === 1,
                        })),
                    },
                },
                include: {
                    modules: { orderBy: { orderIndex: 'asc' } },
                },
            });

            res.status(201).json({ status: 'success', data: track });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Lấy danh sách tất cả lộ trình học của học viên
     */
    async getMyTracks(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tracks = await prisma.learningTrack.findMany({
                where: { userId: req.user!.id },
                include: {
                    modules: {
                        orderBy: { orderIndex: 'asc' },
                    },
                    capstone: true,
                    certificate: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json({ status: 'success', data: tracks });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Hỏi Giảng viên Socratic AI (Chặn nếu chương chưa được mở khóa)
     */
    async askMentor(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { moduleId, currentCode, question } = mentorChatSchema.parse(req.body);

            const moduleRecord = await prisma.curriculumModule.findUnique({
                where: { id: moduleId },
                include: { track: true },
            });

            if (!moduleRecord || moduleRecord.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy chương học.', 404);
            }

            if (!moduleRecord.isUnlocked) {
                throw new AppError('Bạn phải hoàn thành và thi đỗ chương trước đó để mở khóa nội dung này.', 403);
            }

            const reply = await aiService.askSocraticMentor({
                moduleTitle: moduleRecord.title,
                language: moduleRecord.track.language,
                framework: moduleRecord.track.framework || undefined,
                currentCode,
                studentQuestion: question,
            });

            res.json({ status: 'success', data: { reply } });
        } catch (error) {
            next(error);
        }
    }

    async explainConcept(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { moduleId, conceptTitle } = req.body;
            const mod = await prisma.curriculumModule.findUnique({
                where: { id: moduleId },
                include: { track: true },
            });

            if (!mod || mod.track.userId !== req.user!.id) {
                throw new AppError('Không tìm thấy chương học hợp lệ.', 404);
            }

            const lesson = await aiService.generateConceptLesson({
                language: mod.track.language,
                framework: mod.track.framework || undefined,
                moduleTitle: mod.title,
                conceptTitle,
            });

            res.json({ status: 'success', data: lesson });
        } catch (error) {
            next(error);
        }
    }
}