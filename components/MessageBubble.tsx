
import React from 'react';
import { ConversationMessage, Language } from '../types';

interface MessageBubbleProps {
    message: ConversationMessage;
}

const LanguageBadge: React.FC<{ language: Language }> = ({ language }) => {
    const langInfo = {
        [Language.VI]: { label: 'VI', color: 'bg-blue-500' },
        [Language.ZH]: { label: 'ZH', color: 'bg-red-500' },
        [Language.UNKNOWN]: { label: '??', color: 'bg-gray-500' },
    };

    return (
        <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${langInfo[language].color}`}>
            {langInfo[language].label}
        </span>
    );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const isVietnamese = message.userLanguage === Language.VI;
    const alignment = isVietnamese ? 'items-start' : 'items-end';
    const bubbleColor = isVietnamese ? 'bg-slate-700' : 'bg-slate-800';

    return (
        <div className={`flex flex-col w-full max-w-lg mx-auto my-2 ${alignment}`}>
            <div className={`p-4 rounded-lg ${bubbleColor} w-full`}>
                <div className="flex items-center gap-3 mb-2">
                    <LanguageBadge language={message.userLanguage} />
                    <p className="text-lg text-slate-100">{message.userInput}</p>
                </div>
                <div className="border-t border-slate-600 my-2"></div>
                <div className="flex items-center gap-3">
                    <LanguageBadge language={isVietnamese ? Language.ZH : Language.VI} />
                    <p className="text-lg font-medium text-cyan-300">{message.modelTranslation}</p>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
