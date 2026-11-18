import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Code Mentor',
    description: 'Không gian học lập trình tương tác',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="vi">
            <body>{children}</body>
        </html>
    );
}
