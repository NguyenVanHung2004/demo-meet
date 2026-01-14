export const formatTranscriptText = (text: string): string => {
    if (!text) return "";
    // 1. Chuyển sạng thường
    const lower = text.toLowerCase().trim();
    // 2. Viết hoa chữ cái đầu
    if (lower.length > 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
};

export const formatWords = (words: any[]): any[] => {
    if (!words || words.length === 0) return [];

    return words.map((w, index) => {
        let newContent = w.word ? w.word.toLowerCase() : "";
        if (index === 0 && newContent.length > 0) {
            newContent = newContent.charAt(0).toUpperCase() + newContent.slice(1);
        }
        return {
            ...w,
            word: newContent
        };
    });
};
