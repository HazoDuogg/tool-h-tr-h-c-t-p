export interface LanguagePreset {
    monacoLang: string;
    entryFile: string;
    extensions: string[];
    sdkNotes: string;
    starterFiles: Record<string, string>;
}

/**
 * Tự động nhận diện ngôn ngữ tô màu cú pháp Monaco theo đuôi tệp
 */
export function detectMonacoLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'cs':
            return 'csharp';
        case 'go':
            return 'go';
        case 'cpp':
        case 'cc':
        case 'h':
            return 'cpp';
        case 'json':
            return 'json';
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        default:
            return 'plaintext';
    }
}

/**
 * Sinh cấu trúc file khởi đầu & danh sách Extension hỗ trợ theo Ngôn ngữ + Framework
 */
export function getEnvironmentPreset(language: string, framework?: string): LanguagePreset {
    const lang = language.toLowerCase();
    const fw = (framework || '').toLowerCase();

    if (lang.includes('typescript')) {
        const isExpress = fw.includes('express');
        const isReact = fw.includes('react') || fw.includes('next');

        const files: Record<string, string> = {
            'src/main.ts': isExpress
                ? `// Môi trường: TypeScript + Express.js\nimport * as fs from 'fs';\n\ninterface RequestDTO {\n  path: string;\n  payload: string;\n}\n\nfunction handleRequest(req: RequestDTO): string {\n  // Tự viết logic xử lý tại đây\n  return \`[200 OK] \${req.path} -> \${req.payload}\`;\n}\n\nconst stdin = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(handleRequest({ path: '/api/test', payload: stdin || 'empty' }));\n`
                : isReact
                    ? `// Môi trường: TypeScript + React Architecture\ninterface ComponentState<T> {\n  data: T;\n  isLoading: boolean;\n}\n\nfunction createState<T>(initial: T): ComponentState<T> {\n  return { data: initial, isLoading: false };\n}\n\nconst state = createState<string>('Sẵn sàng');\nconsole.log('State hiện tại:', state);\n`
                    : `// Môi trường: TypeScript (Node.js Runtime)\nimport * as fs from 'fs';\n\nfunction solve(input: string): void {\n  // Đọc dữ liệu từ ô STDIN bên dưới và tự viết logic tại đây\n  console.log('Dữ liệu nhận được:', input || '(Trống)');\n}\n\nconst rawInput = fs.readFileSync(0, 'utf-8').trim();\nsolve(rawInput);\n`,
            'tsconfig.json': JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'CommonJS',
                        strict: true,
                        esModuleInterop: true,
                    },
                },
                null,
                2
            ),
        };

        return {
            monacoLang: 'typescript',
            entryFile: 'src/main.ts',
            extensions: [
                'TypeScript 5.x IntelliSense',
                'Strict Type Checker',
                '@types/node',
                ...(framework && !fw.includes('thuần') ? [`${framework} Typings`] : []),
            ],
            sdkNotes: `TS Strict Mode + ${framework || 'Node.js Runtime'}`,
            starterFiles: files,
        };
    }

    if (lang.includes('python')) {
        return {
            monacoLang: 'python',
            entryFile: 'src/main.py',
            extensions: [
                'Python 3.12 Pylance',
                'PEP-8 Clean Linter',
                ...(framework && !fw.includes('thuần') ? [`${framework} SDK`] : []),
            ],
            sdkNotes: `Python 3.12 + ${framework || 'Standard Library'}`,
            starterFiles: {
                'src/main.py': `# Môi trường: Python 3 (${framework || 'Core'})\nimport sys\n\ndef solve(raw_input: str) -> None:\n    # Tự viết tư duy xử lý của bạn tại đây\n    print(f"Output: {raw_input or 'Empty'}")\n\nif __name__ == "__main__":\n    data = sys.stdin.read().strip()\n    solve(data)\n`,
                'requirements.txt': framework && !fw.includes('thuần') ? `${framework.toLowerCase()}\n` : '# Python Standard Library\n',
            },
        };
    }

    if (lang.includes('java')) {
        return {
            monacoLang: 'java',
            entryFile: 'Main.java',
            extensions: ['Java 21 Language Support', 'Clean OOP Analyzer', ...(framework ? [framework] : [])],
            sdkNotes: `JDK 21 + ${framework || 'Java SE'}`,
            starterFiles: {
                'Main.java': `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        String input = scanner.hasNextLine() ? scanner.nextLine() : "";\n        System.out.println("Kết quả: " + input);\n    }\n}\n`,
            },
        };
    }

    if (lang.includes('c#') || lang.includes('csharp')) {
        return {
            monacoLang: 'csharp',
            entryFile: 'Program.cs',
            extensions: ['.NET 8 C# Dev Kit', 'Roslyn Analyzer', ...(framework ? [framework] : [])],
            sdkNotes: `.NET 8 SDK + ${framework || 'C# Console'}`,
            starterFiles: {
                'Program.cs': `using System;\n\nclass Program {\n    static void Main() {\n        string input = Console.In.ReadToEnd().Trim();\n        Console.WriteLine($"Output: {input}");\n    }\n}\n`,
            },
        };
    }

    if (lang.includes('go')) {
        return {
            monacoLang: 'go',
            entryFile: 'main.go',
            extensions: ['Gopls Language Server', 'Staticcheck Linter', ...(framework ? [framework] : [])],
            sdkNotes: `Go 1.22 + ${framework || 'Standard Package'}`,
            starterFiles: {
                'main.go': `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tvar text string\n\tif scanner.Scan() {\n\t\ttext = scanner.Text()\n\t}\n\tfmt.Println("Output:", text)\n}\n`,
            },
        };
    }

    // Mặc định C++
    return {
        monacoLang: 'cpp',
        entryFile: 'main.cpp',
        extensions: ['C++20 IntelliSense', 'GCC / Clang Diagnostics'],
        sdkNotes: 'C++20 Standard',
        starterFiles: {
            'main.cpp': `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string input;\n    getline(cin, input);\n    cout << "Output: " << input << endl;\n    return 0;\n}\n`,
        },
    };
}