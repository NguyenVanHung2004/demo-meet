import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async () => {
    if (ffmpeg) return ffmpeg;

    const ffmpegInstance = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    // Load ffmpeg.wasm from unpkg CDN
    await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpeg = ffmpegInstance;
    return ffmpeg;
};

export const convertToMp3 = async (file: File, onProgress?: (progress: number) => void): Promise<File> => {
    const ffmpeg = await loadFFmpeg();

    if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
            onProgress(Math.round(progress * 100));
        });
    }

    const inputName = 'input.' + file.name.split('.').pop();
    const outputName = 'output.mp3';

    // Write file to FFmpeg FS
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Run conversion: -i input -vn (no video) -acodec libmp3lame -q:a 2 (high quality variable bitrate) output.mp3
    // Note: Standard ffmpeg.wasm build might not support libmp3lame depending on license, 
    // but usually supports basic mp3 encoding. If fails, we can try .wav
    try {
        await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputName]);
    } catch (e) {
        console.warn("MP3 Encoding failed, trying AAC/M4A", e);
        // Fallback or retry logic could go here
        throw e;
    }

    // Read result
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as any], { type: 'audio/mp3' });

    // Cleanup
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".mp3", { type: 'audio/mp3' });
};
