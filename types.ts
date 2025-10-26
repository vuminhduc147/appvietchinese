
export enum Language {
    VI = 'VI',
    ZH = 'ZH',
    UNKNOWN = 'UNKNOWN',
}

export interface ConversationMessage {
    id: string;
    userInput: string;
    modelTranslation: string;
    userLanguage: Language;
}

export enum TranslatorStatus {
    IDLE = 'IDLE',
    CONNECTING = 'CONNECTING',
    LISTENING = 'LISTENING',
    PROCESSING = 'PROCESSING',
    ERROR = 'ERROR',
}
