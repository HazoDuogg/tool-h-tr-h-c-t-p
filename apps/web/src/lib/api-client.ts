const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiClientError extends Error {
    constructor(
        public message: string,
        public statusCode: number
    ) {
        super(message);
    }
}

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : null;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const json = await response.json();

    if (!response.ok) {
        throw new ApiClientError(
            json.message || 'Đã xảy ra lỗi khi kết nối tới máy chủ.',
            response.status
        );
    }

    return json.data as T;
}