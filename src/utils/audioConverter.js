import { Mp3Encoder } from 'lamejs';
import { WaveFile } from 'wavefile';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

export async function convertToMp3(audioBuffer, onProgress) {
    const mp3Encoder = new Mp3Encoder(
        audioBuffer.numberOfChannels,
        audioBuffer.sampleRate,
        128
    );

    const channels = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    const mp3Data = [];
    const sampleBlockSize = 1152;
    const totalChunks = Math.ceil(channels[0].length / CHUNK_SIZE);
    
    for (let chunk = 0; chunk < totalChunks; chunk++) {
        const start = chunk * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, channels[0].length);
        
        // Process this chunk
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
        
        for (let i = start; i < end; i += sampleBlockSize) {
            const leftChunk = channels[0].slice(i, i + sampleBlockSize);
            const rightChunk = channels[1]?.slice(i, i + sampleBlockSize) || leftChunk;
            
            const mp3buf = mp3Encoder.encodeBuffer(
                Int16Array.from(leftChunk.map(n => n * 32767)),
                Int16Array.from(rightChunk.map(n => n * 32767))
            );
            
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        onProgress?.((chunk + 1) / totalChunks);
    }

    const end = mp3Encoder.flush();
    if (end.length > 0) {
        mp3Data.push(end);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
}

export async function convertToWav(audioBuffer, onProgress) {
    const totalSamples = audioBuffer.length * audioBuffer.numberOfChannels;
    const chunkSize = CHUNK_SIZE;
    const chunks = Math.ceil(totalSamples / chunkSize);
    const samples = new Float32Array(totalSamples);
    
    for (let chunk = 0; chunk < chunks; chunk++) {
        const start = chunk * chunkSize;
        const end = Math.min(start + chunkSize, totalSamples);
        
        // Yield to main thread between chunks
        await new Promise(resolve => setTimeout(resolve, 0));
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = start / audioBuffer.numberOfChannels; 
                 i < end / audioBuffer.numberOfChannels; i++) {
                samples[i * audioBuffer.numberOfChannels + channel] = channelData[i];
            }
        }

        onProgress?.((chunk + 1) / chunks);
    }

    const wav = new WaveFile();
    wav.fromScratch(
        audioBuffer.numberOfChannels,
        audioBuffer.sampleRate,
        '32f',
        samples
    );

    return new Blob([wav.toBuffer()], { type: 'audio/wav' });
}