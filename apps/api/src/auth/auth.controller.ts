import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/app-error';

const registerSchema = z.object({
    fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

const loginSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function signToken(user: { id: string; email: string }): string {
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, {
        expiresIn: '7d',
    });
}

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const data = registerSchema.parse(req.body);

            const existing = await prisma.user.findUnique({ where: { email: data.email } });
            if (existing) {
                throw new AppError('Email này đã được đăng ký tài khoản.', 409);
            }

            const user = await prisma.user.create({
                data: {
                    fullName: data.fullName,
                    email: data.email,
                    passwordHash: hashPassword(data.password),
                },
                select: { id: true, email: true, fullName: true, createdAt: true },
            });

            const token = signToken(user);
            res.status(201).json({ status: 'success', data: { user, token } });
        } catch (error) {
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const data = loginSchema.parse(req.body);

            const user = await prisma.user.findUnique({ where: { email: data.email } });
            if (!user || !verifyPassword(data.password, user.passwordHash)) {
                throw new AppError('Email hoặc mật khẩu không chính xác.', 401);
            }

            const token = signToken(user);
            res.json({
                status: 'success',
                data: {
                    user: { id: user.id, email: user.email, fullName: user.fullName },
                    token,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async getMe(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                select: { id: true, email: true, fullName: true, createdAt: true },
            });
            if (!user) throw new AppError('Không tìm thấy tài khoản.', 404);
            res.json({ status: 'success', data: user });
        } catch (error) {
            next(error);
        }
    }
}