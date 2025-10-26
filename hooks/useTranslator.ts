
import { useState, useRef, useCallback } from 'react';
// Fix: LiveSession is not an exported member of @google/genai.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { ConversationMessage, TranslatorStatus, Language } from '../types';

// Fix: Define LiveSession interface based on usage as it's not exported from @google/genai
interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media: Blob }): void;
}

// Helper functions for audio processing
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

// Fix: Add createBlob helper function for efficient audio data processing, as recommended in the documentation.
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


const useTranslator = (
    onMessageReceived: (message: ConversationMessage) => void
) => {
    const [status, setStatus] = useState<TranslatorStatus>(TranslatorStatus.IDLE);
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const stopAudioProcessing = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    const stopSession = useCallback(async () => {
        setStatus(TranslatorStatus.IDLE);
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session:", e);
            } finally {
                sessionPromiseRef.current = null;
            }
        }
        stopAudioProcessing();
    }, [stopAudioProcessing]);


    const startSession = useCallback(async () => {
        if (status !== TranslatorStatus.IDLE && status !== TranslatorStatus.ERROR) {
            return;
        }

        setError(null);
        setStatus(TranslatorStatus.CONNECTING);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus(TranslatorStatus.LISTENING);
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            // Fix: Use the createBlob helper for more efficient audio processing.
                            const pcmBlob = createBlob(inputData);
                            if(sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcription
                        if (message.serverContent?.inputTranscription) {
                             currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current.trim();
                            const fullOutput = currentOutputTranscriptionRef.current.trim();
                            
                            if (fullInput && fullOutput) {
                                // Improved language detection: Check for Chinese characters first.
                                const isChinese = /[\u4e00-\u9fa5]/.test(fullInput);
                                
                                onMessageReceived({
                                    id: new Date().toISOString(),
                                    userInput: fullInput,
                                    modelTranslation: fullOutput,
                                    userLanguage: isChinese ? Language.ZH : Language.VI,
                                });
                            }

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        // Handle audio output
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const audioContext = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                            const source = audioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioContext.destination);

                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
                        setStatus(TranslatorStatus.ERROR);
                        stopAudioProcessing();
                    },
                    onclose: () => {
                        setStatus(TranslatorStatus.IDLE);
                        stopAudioProcessing();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: `You are a live, simultaneous interpreter for a conversation between a Vietnamese speaker and a Chinese speaker. Your ONLY task is to translate.
- If the user speaks Vietnamese, you INSTANTLY reply with the Chinese translation.
- If the user speaks Chinese, you INSTANTLY reply with the Vietnamese translation.
- Do NOT say anything else. No greetings, no explanations, no filler words. Just the pure translation.`,
                },
            });
            await sessionPromiseRef.current;
        } catch (e: any) {
            console.error("Failed to start session:", e);
            setError(e.message.includes('permission') ? 'Cần cấp quyền truy cập micro.' : 'Không thể khởi động phiên dịch.');
            setStatus(TranslatorStatus.ERROR);
            stopAudioProcessing();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, onMessageReceived, stopAudioProcessing]);

    return { status, error, startSession, stopSession };
};

export default useTranslator;
