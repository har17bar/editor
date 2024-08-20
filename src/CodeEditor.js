import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import io from 'socket.io-client';
import Split from 'react-split';

const socket = io('http://localhost:8000');

const CodeEditor = () => {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [output, setOutput] = useState('');

    const iframeRef = useRef(null);

    const defaultTemplates = {
        javascript: `// JavaScript Template\nconsole.log('Hello, JavaScript!');`,
        python: `# Python Template\nprint('Hello, Python!')`,
        java: `// Java Template\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Java!");\n  }\n}`,
        csharp: `// C# Template\nusing System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, C#!");\n  }\n}`,
        cpp: `// C++ Template\n#include <iostream>\nint main() {\n  std::cout << "Hello, C++!" << std::endl;\n  return 0;\n}`,
        html: `<!-- HTML Template -->\n<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello HTML</title>\n</head>\n<body>\n  <h1>Hello, HTML!</h1>\n</body>\n</html>`,
        css: `/* CSS Template */\nbody {\n  background-color: lightblue;\n}`,
        json: `{\n  "message": "Hello, JSON!"\n}`,
        typescript: `// TypeScript Template\nlet message: string = 'Hello, TypeScript!';\nconsole.log(message);`
    };

    useEffect(() => {
        setCode(defaultTemplates[language] || '');
    }, [language]);

    useEffect(() => {
        socket.on('chat message', (msg) => {
            setChatMessages((prevMessages) => [...prevMessages, { type: 'text', content: msg.text }]);
            setCode(msg.code);
        });

        socket.on('response', (msg) => {
            setChatMessages((prevMessages) => [...prevMessages, ...msg.content.map(item => ({ type: item.type, content: item.data }))]);
        });

        return () => {
            socket.off('chat message');
            socket.off('response');
        };
    }, []);

    const handleEditorChange = (value) => {
        setCode(value);
    };

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value);
    };

    const runCode = async () => {
        try {
            let codeToRun = code;

            if (language === 'typescript') {
                const compiledCode = window.ts.transpileModule(code, { compilerOptions: { module: window.ts.ModuleKind.CommonJS } });
                codeToRun = compiledCode.outputText;
            }

            if (language === 'javascript' || language === 'typescript') {
                let outputLogs = [];
                const originalConsoleLog = console.log;

                console.log = function (...args) {
                    outputLogs.push(args.join(' '));
                    originalConsoleLog.apply(console, args);
                };

                eval(codeToRun);

                console.log = originalConsoleLog;
                const output = outputLogs.join('\n');
                setOutput(output);
            } else if (language === 'html' || language === 'css') {
                updateIframeContent();
            } else {
                const response = await axios.post('API_ENDPOINT', { language, code });
                const output = response.data.output || 'Execution failed.';
                setOutput(output);
            }
        } catch (error) {
            setOutput(`Error: ${error.message}`);
        }
    };

    const updateIframeContent = () => {
        if (iframeRef.current) {
            const document = iframeRef.current.contentDocument;
            const htmlCode = language === 'html' ? code : document.body.innerHTML;
            const cssCode = language === 'css' ? code : '';

            const completeCode = `
                <style>${cssCode}</style>
                ${htmlCode}
            `;

            document.open();
            document.write(completeCode);
            document.close();
        }
    };

    const sendChatMessage = () => {
        const message = {
            text: chatInput,
            code: code,
        };

        socket.emit('chat message', message);
        setChatMessages((prevMessages) => [...prevMessages, { type: 'text', content: chatInput }]);
        setChatInput('');
    };

    const copyToClipboard = (code) => {
        navigator.clipboard.writeText(code).then(() => {
            alert("Code copied to clipboard!");
        });
    };

    return (
        <Split
            sizes={[70, 30]}
            direction="horizontal"
            style={{ display: 'flex', height: '100vh' }}
            className="split-horizontal"
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', padding: '10px', backgroundColor: '#282c34' }}>
                    <select value={language} onChange={handleLanguageChange} style={{ padding: '10px', borderRadius: '5px', border: 'none', marginRight: '10px' }}>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="csharp">C#</option>
                        <option value="cpp">C++</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="json">JSON</option>
                        <option value="typescript">TypeScript</option>
                    </select>
                    <button onClick={runCode} style={{ padding: '10px', borderRadius: '5px', border: 'none', backgroundColor: '#28a745', color: '#fff', cursor: 'pointer' }}>
                        Run Code
                    </button>
                </div>

                <Editor
                    language={language}
                    value={code}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        wordBasedSuggestions: true,
                        lint: true,
                        automaticLayout: true,
                        minimap: { enabled: false },
                    }}
                    height="calc(100vh - 50px)" // Adjust the height to account for the toolbar above
                />
            </div>

            <Split
                sizes={[70, 30]}
                direction="vertical"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                className="split-vertical"
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                        {chatMessages.map((msg, index) => (
                            <div key={index} style={{ marginBottom: '10px', backgroundColor: '#fff', padding: '10px', borderRadius: '5px' }}>
                                {msg.type === 'text' && <p>{msg.content}</p>}
                                {msg.type === 'code' && (
                                    <div style={{ backgroundColor: '#333', color: '#fff', padding: '10px', borderRadius: '5px', position: 'relative' }}>
                                        <code style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</code>
                                        <button
                                            onClick={() => copyToClipboard(msg.content)}
                                            style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#555', color: '#fff', border: 'none', padding: '5px', cursor: 'pointer' }}>
                                            Copy
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '5px' }}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                            placeholder="Type your message..."
                        />
                        <button onClick={sendChatMessage} style={{ marginLeft: '10px', padding: '10px', borderRadius: '5px', border: 'none', backgroundColor: '#007bff', color: '#fff', cursor: 'pointer' }}>
                            Send
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{output}</pre>
                </div>
            </Split>
        </Split>
    );
};

export default CodeEditor;
