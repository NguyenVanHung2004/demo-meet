// app/lib/db.ts
import { db } from "./firebase";
import { 
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, orderBy 
} from "firebase/firestore";
import { Segment, Speaker, RAW_TRANSCRIPT_FILE, RAW_SUMMARY_FILE } from "./mockData";
import { parseTranscriptFile } from "./parser";

// Định nghĩa trạng thái
export type MeetingStatus = 'transcribing' | 'transcribed' | 'summarizing' | 'completed' | 'failed';

// Định nghĩa Interface (Đã đổi audioBlob -> audioUrl)
export interface Meeting {
  id: string;
  userId: string;       // [QUAN TRỌNG] Phân biệt user
  jobId?: string;       // ID Job RunPod
  title: string;
  createdAt: number;
  duration: number;
  audioUrl: string;     // [THAY ĐỔI] Lưu đường dẫn thay vì file Blob
  segments: Segment[];
  speakers: Speaker[];
  summary?: string;
  status: MeetingStatus;
  isDeleted: boolean;
  errorMessage?: string;
}

const COLLECTION_NAME = "meetings";

// 1. Lưu hoặc Tạo mới cuộc họp (Create / Overwrite)
// Tương đương: store.put()
export const saveMeeting = async (meeting: Meeting) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, meeting.id);
    // Deep copy để tránh lỗi reference và đảm bảo object sạch
    const cleanData = JSON.parse(JSON.stringify(meeting));
    await setDoc(docRef, cleanData);
  } catch (error) {
    console.error("Lỗi lưu meeting:", error);
    throw error;
  }
};

// 2. Lấy tất cả cuộc họp của 1 User (Dashboard)
// Tương đương: store.getAll() nhưng có filter user
export const getAllMeetings = async (userId: string): Promise<Meeting[]> => {
  try {
    const meetingsRef = collection(db, COLLECTION_NAME);
    const q = query(
      meetingsRef, 
      where("userId", "==", userId), 
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Meeting);
  } catch (error) {
    console.error("Lỗi lấy danh sách:", error);
    return [];
  }
};

// 3. Lấy 1 cuộc họp chi tiết
// Tương đương: store.get(id)
export const getMeetingById = async (id: string): Promise<Meeting | undefined> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Meeting;
    }
    return undefined;
  } catch (error) {
    console.error("Lỗi lấy chi tiết:", error);
    return undefined;
  }
};

// 4. Cập nhật process (Thay đổi 1 phần dữ liệu)
export const updateMeetingProcess = async (id: string, updates: Partial<Meeting>) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, updates);
};

// 5. Chuyển vào thùng rác / Khôi phục
export const toggleTrashMeeting = async (id: string, isDeleted: boolean) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { isDeleted });
};

// 6. Xóa vĩnh viễn
export const deleteMeetingPermanent = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};

// 7. Cập nhật tiêu đề
export const updateMeetingTitle = async (id: string, newTitle: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { title: newTitle });
};

// 8. Lấy danh sách đang chạy (Cho PollingManager)
export const getActiveTranscribingMeetings = async (userId: string): Promise<Meeting[]> => {
  const q = query(
    collection(db, COLLECTION_NAME), 
    where("userId", "==", userId),
    where("status", "==", "transcribing")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Meeting);
};

// 9. Tạo dữ liệu mẫu (Seed Data)
// Logic: Thay vì fetch Blob, ta dùng luôn đường dẫn tĩnh trong folder public
export const seedInitialData = async (userId: string) => {
  if (!userId) return;

  const meetings = await getAllMeetings(userId);
  
  // Chỉ tạo nếu user chưa có cuộc họp nào
  if (meetings.length === 0) {
    try {
      console.log("🚀 Đang khởi tạo dữ liệu mẫu cho user mới...");
      
      const parsedData = parseTranscriptFile(RAW_TRANSCRIPT_FILE);

      const seedMeeting: Meeting = {
        id: `demo-${userId}`, // ID gắn với user để không trùng
        userId: userId,
        title: "Talkshow: Tương lai ngành xuất bản (Demo)",
        createdAt: Date.now(),
        duration: 480,
        // Firebase không lưu Blob, ta trỏ thẳng vào file trong folder public
        audioUrl: "/demo.mp3", 
        segments: parsedData.segments,
        speakers: parsedData.speakers,
        summary: RAW_SUMMARY_FILE,
        status: 'completed',
        isDeleted: false
      };
      
      await saveMeeting(seedMeeting);
      console.log("✅ Đã nạp dữ liệu mẫu!");
      return true;

    } catch (e) {
      console.error("Lỗi tạo data mẫu:", e);
    }
    return false;
  }
};