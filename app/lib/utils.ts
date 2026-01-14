export const formatTranscriptText = (text: string | any): string => {
    if (!text) return "";
    // FORCE STRING: Đảm bảo input luôn là string
    const str = String(text);
    // 1. Chuyển sạng thường
    const lower = str.toLowerCase().trim();
    // 2. Viết hoa chữ cái đầu
    if (lower.length > 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
};

export const formatWords = (words: any[]): any[] => {
    if (!words || !Array.isArray(words) || words.length === 0) return [];

    return words.map((w, index) => {
        // [FIX] Kiểm tra kỹ w.word
        const rawWord = w.word ? String(w.word) : "";
        let newContent = rawWord.toLowerCase();

        if (index === 0 && newContent.length > 0) {
            newContent = newContent.charAt(0).toUpperCase() + newContent.slice(1);
        }
        return {
            ...w,
            word: newContent
        };
    });
};
