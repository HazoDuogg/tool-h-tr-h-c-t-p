import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/app-error';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('Vui lòng đăng nhập để tiếp tục.', 401));
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string };
        req.user = decoded;
        next();
    } catch {
        next(new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401));
    }
};