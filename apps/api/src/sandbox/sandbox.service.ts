import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AppError } from '../utils/app-error';

export interface SandboxRuntimeConfig {
    language: string;
    version: string;
    defaultFileName: string;
}

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    isSuccess: boolean;
}

export interface TestCaseItem {
    id: string;
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
}

export interface TestSuiteResult {
    total: number;
    passedCount: number;
    allPassed: boolean;
    details: Array<{
        id: string;
        isHidden: boolean;
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string;
        error?: string;
    }>;
}

const RUNTIME_MAP: Record<string, SandboxRuntimeConfig> = {
    typescript: { language: 'typescript', version: '*', defaultFileName: 'main.ts' },
    javascript: { language: 'javascript', version: '*', defaultFileName: 'main.js' },
    python: { language: 'python', version: '*', defaultFileName: 'main.py' },
    java: { language: 'java', version: '*', defaultFileName: 'Main.java' },
    csharp: { language: 'csharp', version: '*', defaultFileName: 'Main.cs' },
    cpp: { language: 'c++', version: '*', defaultFileName: 'main.cpp' },
    go: { language: 'go', version: '*', defaultFileName: 'main.go' },
};

export class CodeSandboxService {
    private readonly pistonUrl = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

    private resolveRuntime(langInput: string): SandboxRuntimeConfig {
        const normalized = langInput.toLowerCase().trim().replace('#', 'sharp').replace('++', 'pp');
        const config = RUNTIME_MAP[normalized];
        if (!config) {
            throw new AppError(
                `Ngôn ngữ "${langInput}" chưa được hỗ trợ trong Sandbox. Hỗ trợ: ${Object.keys(RUNTIME_MAP).join(', ')}`,
                400
            );
        }
        return config;
    }

    /**
     * Thực thi 1 lần chạy code với Standard Input (stdin)
     * Tự động fallback sang trình biên dịch cục bộ trên máy nếu Piston không phản hồi
     */
    async executeCode(params: {
        language: string;
        files: Array<{ name?: string; content: string }>;
        stdin?: string;
    }): Promise<ExecutionResult> {
        const runtime = this.resolveRuntime(params.language);

        // Lọc file cấu hình (.json, .txt, .md) và đưa file chạy chính lên đầu
        const sourceFiles = params.files
            .filter((f) => !/\.(json|txt|md)$/i.test(f.name || ''))
            .sort((a, b) => {
                const isMainA = /(main|program)\./i.test(a.name || '') ? -1 : 1;
                const isMainB = /(main|program)\./i.test(b.name || '') ? -1 : 1;
                return isMainA - isMainB;
            });

        const formattedFiles = (sourceFiles.length > 0 ? sourceFiles : params.files).map((file, idx) => ({
            name: file.name || (idx === 0 ? runtime.defaultFileName : `module_${idx}`),
            content: file.content,
        }));

        // 1. Thử gọi Piston API (nếu có cấu hình local Docker Piston hoặc server hoạt động)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const startTime = Date.now();

            const response = await fetch(`${this.pistonUrl}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    language: runtime.language,
                    version: runtime.version,
                    files: formattedFiles,
                    stdin: params.stdin || '',
                    compile_timeout: 10000,
                    run_timeout: 5000,
                }),
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = (await response.json()) as {
                    compile?: { stderr: string; code: number };
                    run: { stdout: string; stderr: string; code: number };
                };
                const executionTimeMs = Date.now() - startTime;

                if (data.compile && data.compile.code !== 0) {
                    return {
                        stdout: '',
                        stderr: `[Compile Error]\n${data.compile.stderr}`,
                        exitCode: data.compile.code,
                        executionTimeMs,
                        isSuccess: false,
                    };
                }

                return {
                    stdout: data.run.stdout.trim(),
                    stderr: data.run.stderr.trim(),
                    exitCode: data.run.code,
                    executionTimeMs,
                    isSuccess: data.run.code === 0 && !data.run.stderr,
                };
            }
        } catch {
            // Piston không phản hồi -> Chuyển sang chạy cục bộ trên máy bên dưới
        }

        // 2. Fallback: Chạy trực tiếp bằng môi trường trên máy cục bộ
        return this.executeLocally(runtime, formattedFiles, params.stdin || '');
    }

    /**
     * Chạy code trên thư mục tạm của máy cục bộ (hỗ trợ TS, JS, Python, Go, Java, C++)
     */
    private async executeLocally(
        runtime: SandboxRuntimeConfig,
        files: Array<{ name: string; content: string }>,
        stdin: string
    ): Promise<ExecutionResult> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codementor-'));
        const startTime = Date.now();

        try {
            for (const file of files) {
                const safeRelPath = file.name.replace(/^(\.\.(\/|\\|$))+/, '');
                const fullPath = path.join(tempDir, safeRelPath);
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, file.content, 'utf-8');
            }

            const entryFile = files[0].name;

            if (runtime.language === 'typescript') {
                const localTsx = path.resolve(
                    process.cwd(),
                    'node_modules',
                    '.bin',
                    process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
                );
                const cmd = await fs
                    .access(localTsx)
                    .then(() => `"${localTsx}"`)
                    .catch(() => 'npx tsx');

                return await this.runProcess(cmd, [entryFile], tempDir, stdin, startTime);
            }

            if (runtime.language === 'javascript') {
                return await this.runProcess('node', [entryFile], tempDir, stdin, startTime);
            }

            if (runtime.language === 'python') {
                const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
                return await this.runProcess(pyCmd, [entryFile], tempDir, stdin, startTime);
            }

            if (runtime.language === 'go') {
                return await this.runProcess('go', ['run', entryFile], tempDir, stdin, startTime);
            }

            if (runtime.language === 'java') {
                return await this.runProcess('java', [entryFile], tempDir, stdin, startTime);
            }

            if (runtime.language === 'c++') {
                const outBin = process.platform === 'win32' ? 'app.exe' : './app';
                const compileRes = await this.runProcess(
                    'g++',
                    [entryFile, '-o', outBin],
                    tempDir,
                    '',
                    startTime
                );
                if (!compileRes.isSuccess) {
                    return {
                        ...compileRes,
                        stderr: `[Compile Error]\n${compileRes.stderr}`,
                    };
                }
                return await this.runProcess(outBin, [], tempDir, stdin, startTime);
            }

            throw new AppError(
                `Môi trường cục bộ chưa hỗ trợ chạy trực tiếp "${runtime.language}". Hãy bật Docker Piston hoặc cài compiler tương ứng.`,
                400
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }
    }

    private runProcess(
        command: string,
        args: string[],
        cwd: string,
        stdin: string,
        startTime: number
    ): Promise<ExecutionResult> {
        return new Promise((resolve) => {
            const child = spawn(command, args, {
                cwd,
                shell: true,
                timeout: 5000,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });

            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            child.on('error', (err) => {
                resolve({
                    stdout: '',
                    stderr: `Không tìm thấy trình biên dịch (${command}): ${err.message}`,
                    exitCode: 1,
                    executionTimeMs: Date.now() - startTime,
                    isSuccess: false,
                });
            });

            child.on('close', (code) => {
                const exitCode = code ?? 1;
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode,
                    executionTimeMs: Date.now() - startTime,
                    isSuccess: exitCode === 0,
                });
            });

            if (stdin) {
                child.stdin.write(stdin);
            }
            child.stdin.end();
        });
    }

    /**
     * Chạy bộ Test Cases tự động để chấm logic của học viên
     */
    async runTestSuite(params: {
        language: string;
        files: Array<{ name?: string; content: string }>;
        testCases: TestCaseItem[];
    }): Promise<TestSuiteResult> {
        const details: TestSuiteResult['details'] = [];
        let passedCount = 0;

        for (const tc of params.testCases) {
            const execResult = await this.executeCode({
                language: params.language,
                files: params.files,
                stdin: tc.input,
            });

            const normalizedActual = execResult.stdout.replace(/\r\n/g, '\n').trim();
            const normalizedExpected = tc.expectedOutput.replace(/\r\n/g, '\n').trim();
            const isPassed = execResult.exitCode === 0 && normalizedActual === normalizedExpected;

            if (isPassed) passedCount++;

            details.push({
                id: tc.id,
                isHidden: Boolean(tc.isHidden),
                passed: isPassed,
                input: tc.isHidden ? '[Hidden Input]' : tc.input,
                expectedOutput: tc.isHidden ? '[Hidden Expected]' : normalizedExpected,
                actualOutput: tc.isHidden && !isPassed ? '[Hidden Output]' : normalizedActual,
                error: execResult.stderr || undefined,
            });
        }

        return {
            total: params.testCases.length,
            passedCount,
            allPassed: passedCount === params.testCases.length,
            details,
        };
    }
}