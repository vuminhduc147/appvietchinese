
import React, { useState, useCallback, useRef, useEffect } from 'react';
import useTranslator from './hooks/useTranslator';
import { ConversationMessage, TranslatorStatus } from './types';
import MessageBubble from './components/MessageBubble';

const StatusIndicator: React.FC<{ status: TranslatorStatus }> = ({ status }) => {
    const statusInfo = {
        [TranslatorStatus.IDLE]: { text: 'Sẵn sàng dịch', color: 'bg-gray-500' },
        [TranslatorStatus.CONNECTING]: { text: 'Đang kết nối...', color: 'bg-yellow-500 animate-pulse' },
        [TranslatorStatus.LISTENING]: { text: 'Đang nghe...', color: 'bg-green-500 animate-pulse' },
        [TranslatorStatus.PROCESSING]: { text: 'Đang xử lý...', color: 'bg-blue-500' },
        [TranslatorStatus.ERROR]: { text: 'Lỗi', color: 'bg-red-600' },
    };

    return (
        <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusInfo[status].color}`}></div>
            <span className="text-slate-300">{statusInfo[status].text}</span>
        </div>
    );
};

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM11 5a1 1 0 0 1 2 0v6a1 1 0 0 1-2 0V5Z"></path>
        <path d="M12 15a5 5 0 0 0 5-5V5a1 1 0 0 0-2 0v5a3 3 0 0 1-6 0V5a1 1 0 0 0-2 0v5a5 5 0 0 0 5 5Z"></path>
        <path d="M12 18a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0v-1a1 1 0 0 0-1-1Z"></path>
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z"></path>
        <path d="M12 12a1 1 0 0 0 1-1V9a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1Z"></path>
        <path d="M12 12a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1Z"></path>
    </svg>
);


function App() {
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    const conversationEndRef = useRef<HTMLDivElement>(null);

    const onMessageReceived = useCallback((message: ConversationMessage) => {
        setConversation(prev => [...prev, message]);
    }, []);

    const { status, error, startSession, stopSession } = useTranslator(onMessageReceived);
    
    const isSessionActive = status === TranslatorStatus.CONNECTING || status === TranslatorStatus.LISTENING;

    const handleToggleSession = () => {
        if (isSessionActive) {
            stopSession();
        } else {
            setConversation([]);
            startSession();
        }
    };
    
    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);


    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white p-4 max-w-3xl mx-auto">
            <header className="text-center mb-4 border-b border-slate-700 pb-4">
                <h1 className="text-3xl font-bold text-cyan-300">Trình Dịch Thuật Trực Tiếp</h1>
                <p className="text-slate-400">Việt Nam <span className="mx-2">&harr;</span> Trung Quốc</p>
            </header>

            <main className="flex-1 overflow-y-auto mb-4 pr-2">
                {conversation.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <MicrophoneIcon className="w-16 h-16 mb-4"/>
                        <p className="text-lg">Nhấn nút bắt đầu để dịch</p>
                    </div>
                )}
                {conversation.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={conversationEndRef} />
            </main>

            <footer className="flex flex-col items-center justify-center gap-4 pt-4 border-t border-slate-700">
                 {error && <p className="text-red-500 text-center">{error}</p>}
                <StatusIndicator status={status} />
                <button
                    onClick={handleToggleSession}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50
                        ${isSessionActive 
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' 
                            : 'bg-cyan-500 hover:bg-cyan-600 focus:ring-cyan-300'}`}
                    aria-label={isSessionActive ? 'Dừng phiên dịch' : 'Bắt đầu phiên dịch'}
                >
                    {isSessionActive ? <StopIcon className="w-10 h-10"/> : <MicrophoneIcon className="w-10 h-10"/>}
                </button>
            </footer>
        </div>
    );
}

export default App;
