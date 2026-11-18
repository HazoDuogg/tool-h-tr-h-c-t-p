import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './auth/auth.routes';
import trackRoutes from './modules/tracks/track.routes';
import assessmentRoutes from './modules/assessments/assessment.routes';
import capstoneRoutes from './modules/capstone/capstone.routes';
import { prisma } from './config/prisma';
import { globalErrorHandler } from './middlewares/error.middleware';
import { AppError } from './utils/app-error';

const app = express();

// 1. Middlewares bảo mật, CORS và đọc JSON phải đặt TRÊN cùng
app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);
app.use(
    cors({
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
    })
);
app.use(express.json({ limit: '5mb' }));

// 2. Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 3. Public endpoint tra cứu xác thực Bằng khen tốt nghiệp
app.get('/api/certificates/verify/:code', async (req, res, next) => {
    try {
        const cert = await prisma.certificate.findUnique({
            where: { verificationCode: req.params.code },
            include: { user: { select: { fullName: true } } },
        });
        if (!cert) throw new AppError('Mã bằng khen không tồn tại hoặc không hợp lệ.', 404);
        res.json({ status: 'success', data: cert });
    } catch (error) {
        next(error);
    }
});

// 4. Core Modules (Đặt sau cors và express.json)
app.use('/api/auth', authRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/capstone', capstoneRoutes);

// 5. Global Error Handler luôn đặt CUỐI cùng
app.use(globalErrorHandler);

export default app;