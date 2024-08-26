import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import io from 'socket.io-client';
import Split from 'react-split';
import Icon from './Icon.png'; // Adjust the path according to your file structure


const socket = io('http://localhost:8000');


const CodeEditor = () => {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [output, setOutput] = useState('');
    const [isBannerVisible, setIsBannerVisible] = useState(false);

    const iframeRef = useRef(null);
    const chatContainerRef = useRef(null);
    const isScrolling = useRef(false);

    const defaultTemplates = {
        javascript: "// JavaScript Template\nconsole.log('Hello, JavaScript!');",
        python: "# Python Template\nprint('Hello, Python!')",
        cpp: "// C++ Template\n#include <iostream>\nint main() {\n  std::cout << \"Hello, C++!\" << std::endl;\n  return 0;\n}",
        html: "<!-- HTML Template -->\n<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello HTML</title>\n</head>\n<body>\n  <h1>Hello, HTML!</h1>\n</body>\n</html>",
        css: "/* CSS Template */\nbody {\n  background-color: lightblue;\n}",
        json: "{\n  \"message\": \"Hello, JSON!\"\n}",
        typescript: "// TypeScript Template\nlet message: string = 'Hello, TypeScript!';\nconsole.log(message);",
    };

    useEffect(() => {
        setCode(defaultTemplates[language] || '');
    }, [language]);

    useEffect(() => {
        socket.on('chat message', (msg) => {
            setChatMessages((prevMessages) => [
                ...prevMessages,
                { type: 'text', content: msg.text, isUser: false },
                { type: 'code', content: msg.code, isUser: false }
            ]);
        });

        socket.on('response', (msg) => {
            setChatMessages((prevMessages) => [
                ...prevMessages,
                ...msg.content.map(item => ({ type: item.type, content: item.data, isUser: false }))
            ]);
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
            isUser: true,
        };

        socket.emit('chat message', message);
        setChatMessages((prevMessages) => [...prevMessages, { type: 'text', content: chatInput, isUser: true }]);
        setChatInput('');
    };

    const copyToClipboard = (code) => {
        navigator.clipboard.writeText(code).then(() => {
            setIsBannerVisible(true);
            setTimeout(() => {
                setIsBannerVisible(false);
            }, 1000);
        });
    };

    const handleScroll = () => {
        if (chatContainerRef.current && !isScrolling.current) {
            // Check if the user has scrolled to the top
            if (chatContainerRef.current.scrollTop <= 0) {
                // Fetch more messages only if the user is not already scrolling
                isScrolling.current = true;
                fetchMoreMessages().finally(() => {
                    isScrolling.current = false;
                });
            }
        }
    };

    const fetchMoreMessages = useCallback(async () => {
        // Implement the logic to fetch older messages from the server if needed
        // Currently, this function does nothing because we only use real-time messages

        // Example code to simulate fetching more messages if applicable:
        // const response = await axios.get('API_ENDPOINT_TO_FETCH_OLDER_MESSAGES');
        // const olderMessages = response.data.messages;
        // setChatMessages((prevMessages) => [...olderMessages, ...prevMessages]);

        // Example condition to stop fetching more messages if there are no more messages
        // if (olderMessages.length === 0) {
        //     setHasMoreMessages(false);
        // }
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (chatContainerRef.current) {
                chatContainerRef.current.removeEventListener('scroll', handleScroll);
            }
        };
    }, [handleScroll]);

    useEffect(() => {
        // Scroll to the bottom when chatMessages updates
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    return (
        <Split
            sizes={[70, 30]}
            direction="horizontal"
            style={{ display: 'flex', height: '100vh' }}
            className="split-horizontal"
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', padding: '10px', backgroundColor: '#282c34', justifyContent: 'space-between', color: '#fff' }}>
                    <select value={language} onChange={handleLanguageChange} style={{ padding: '10px', borderRadius: '5px', border: 'none', marginRight: '10px', backgroundColor: '#444', color: '#fff' }}>
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
                    <button onClick={runCode} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', backgroundColor: '#28a745', color: '#fff', cursor: 'pointer' }}>
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
                    height="calc(100vh - 50px)"
                    style={{ backgroundColor: '#fff' }} // Ensure the editor background is dark
                />
            </div>

            <Split
                sizes={[70, 30]}
                direction="vertical"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                className="split-vertical"
            >
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                    backgroundColor: '#000'
                }}>
                    <div style={{display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto'}}
                         ref={chatContainerRef}>
                        {chatMessages.reduce((acc, msg, index) => {
                            if (!msg.isUser && (index === 0 || chatMessages[index - 1].isUser)) {
                                acc.push(
                                    <div key={`icon-${index}`}
                                         style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
                                        <img
                                            src={Icon}  // Replace with your icon path
                                            alt="Receiver Icon"
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                marginRight: '10px',
                                            }}
                                        />
                                    </div>
                                );
                            }

                            acc.push(
                                <div
                                    key={`msg-${index}`}
                                    style={{
                                        // marginBottom: '15px',
                                        backgroundColor: msg.type === 'code' ? '#1e1e1e' : '',
                                        padding: msg.type === 'code' ? '15px': '5px',
                                        // borderRadius: '20px',
                                        maxWidth: '75%',
                                        alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                                        // color: msg.isUser ? '#fff' : '#fff',
                                        color: '#fff',
                                        textAlign: msg.isUser ? 'right' : 'left',
                                        boxShadow: msg.isUser ? '0 2px 5px rgba(0, 123, 255, 0.3)' : '0 2px 5px rgba(0, 0, 0, 0.1)',
                                    }}
                                >
                                    {msg.type === 'text' ? (
                                        <p style={{margin: 0}}>{msg.content}</p>
                                    ) : (
                                        <div style={{position: 'relative'}}>
                                            <pre style={{whiteSpace: 'pre-wrap', margin: 0}}>{msg.content}</pre>
                                            <button
                                                onClick={() => copyToClipboard(msg.content)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '5px',
                                                    right: '5px',
                                                    backgroundColor: '#555',
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '5px',
                                                    cursor: 'pointer',
                                                    borderRadius: '5px',
                                                }}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );

                            return acc;
                        }, [])}
                    </div>

                    <div style={{display: 'flex', padding: '10px', backgroundColor: '#282c34'}}>
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '5px',
                                border: 'none',
                                marginRight: '10px',
                                backgroundColor: '#444',
                                color: '#fff'
                            }}
                            placeholder="Type a message..."
                        />
                        <button onClick={sendChatMessage} style={{
                            padding: '10px 20px',
                            borderRadius: '5px',
                            border: 'none',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            cursor: 'pointer'
                        }}>
                            Send
                        </button>
                    </div>
                </div>

                <div style={{padding: '10px', backgroundColor: '#1e1e1e', color: '#e6e6e6', overflowY: 'auto'}}>
                    <h3 style={{color: '#fff'}}>Output:</h3>
                    <pre>{output}</pre>
                </div>
                {isBannerVisible && (
                    <div style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        zIndex: 1000,
                        fontSize: '1em',
                    }}>
                        Code copied!
                    </div>
                )}
            </Split>
        </Split>
    );
};

export default CodeEditor;
