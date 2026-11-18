import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';

export const globalErrorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'validation_error',
            message: 'Dữ liệu đầu vào không hợp lệ.',
            errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
    }

    console.error('[UNHANDLED ERROR]:', err);
    return res.status(500).json({
        status: 'error',
        message: 'Lỗi hệ thống nội bộ. Vui lòng thử lại sau.',
    });
};