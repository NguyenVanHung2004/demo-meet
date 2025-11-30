// src/lib/db.ts

import { Segment, Speaker, RAW_TRANSCRIPT_FILE, RAW_SUMMARY_FILE } from "./mockData";
import { parseTranscriptFile } from "./parser"; // [MỚI] Import parser
// [CẬP NHẬT] Định nghĩa trạng thái chi tiết
export type MeetingStatus = 
  | 'transcribing'  // Đang ghi biên bản (Audio -> Text)
  | 'transcribed'   // Đã ghi xong (Chờ người dùng Edit & Tóm tắt)
  | 'summarizing'   // Đang tóm tắt (Text -> Summary)
  | 'completed'     // Hoàn tất (Có cả Text & Summary)
  | 'failed';       // Lỗi
// Định nghĩa cấu trúc 1 cuộc họp
export interface Meeting {
  id: string;
  jobId?: string; // ID của Job đang chạy (nếu có)
  title: string;
  createdAt: number;
  duration: number;
  audioBlob: Blob;
  segments: Segment[];
  speakers: Speaker[];
  summary?: string;
  
  status: MeetingStatus; 
  isDeleted: boolean;    
  errorMessage?: string; 
}

const DB_NAME = "MeetingNotesDB";
const STORE_NAME = "meetings";
// [MỚI] Hàm cập nhật trạng thái (Chuyển vào thùng rác / Lưu trữ)
export const updateMeetingProcess = async (id: string, updates: Partial<Meeting>) => {
  const db = await openDB();
  const meeting = await getMeetingById(id);
  if (meeting) {
    const updated = { ...meeting, ...updates };
    await saveMeeting(updated);
  }
};

// [MỚI] Hàm xóa vĩnh viễn
export const toggleTrashMeeting = async (id: string, isDeleted: boolean) => {
  const db = await openDB();
  const meeting = await getMeetingById(id);
  if (meeting) {
    meeting.isDeleted = isDeleted;
    await saveMeeting(meeting);
  }
};
export const deleteMeetingPermanent = async (id: string) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 1. Mở kết nối DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 2. Lưu cuộc họp mới
export const saveMeeting = async (meeting: Meeting) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(meeting); // Dùng put để đè nếu trùng ID

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 3. Lấy tất cả cuộc họp (cho Dashboard)
export const getAllMeetings = async (): Promise<Meeting[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Meeting[];
      // Sắp xếp mới nhất lên đầu
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

// 4. Lấy 1 cuộc họp chi tiết
export const getMeetingById = async (id: string): Promise<Meeting | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 5. Hàm tạo dữ liệu mẫu (Seed Data)
// Chạy hàm này khi app khởi động để có sẵn cái "Weekly Sync"
export const seedInitialData = async () => {
  const meetings = await getAllMeetings();
  
  // Chỉ tạo nếu DB đang trống
  if (meetings.length === 0) {
    try {
      console.log("Đang khởi tạo dữ liệu mẫu...");
      
      // 1. Lấy file audio demo
      const response = await fetch("/demo.mp3");
      const blob = await response.blob();

      // 2. Parse nội dung Talkshow từ file mockData
      const parsedData = parseTranscriptFile(RAW_TRANSCRIPT_FILE);

      // 3. Tạo object Meeting hoàn chỉnh
      const seedMeeting: Meeting = {
        id: "demo-talkshow",
        title: "Talkshow: Tương lai ngành xuất bản (Demo)",
        createdAt: Date.now(), // Thời gian hiện tại
        duration: 480, // Khoảng 8 phút (ước lượng theo transcript)
        audioBlob: blob,

        // Dữ liệu xịn lấy từ Parser
        segments: parsedData.segments,
        speakers: parsedData.speakers,
        summary: RAW_SUMMARY_FILE,
        status: 'completed' // [MỚI] Mặc định là active
        ,
        isDeleted: false
      };
      
      // 4. Lưu vào DB
      await saveMeeting(seedMeeting);
      console.log("✅ Đã nạp dữ liệu mẫu thành công!");
      
      // Reload trang để hiển thị ngay (optional)
      window.location.reload(); 

    } catch (e) {
      console.error("Lỗi tạo data mẫu:", e);
    }
  }
};

// 6. Hàm cập nhật tiêu đề (Viết lại chuẩn Native IndexedDB)
export const updateMeetingTitle = async (id: string, newTitle: string) => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Bước 1: Lấy bản ghi cũ lên
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const meeting = getRequest.result as Meeting;
      
      if (meeting) {
        // Bước 2: Sửa tiêu đề
        meeting.title = newTitle;
        
        // Bước 3: Lưu đè lại
        const putRequest = store.put(meeting);
        
        putRequest.onsuccess = () => resolve(putRequest.result);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        // Không tìm thấy meeting thì thôi, resolve luôn
        resolve(null);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};