// app/lib/db.ts
import { db } from "./firebase";
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot
} from "firebase/firestore";
import { Segment, Speaker, RAW_TRANSCRIPT_FILE, RAW_SUMMARY_FILE } from "./mockData";
export type { Segment, Speaker };
import { parseTranscriptFile } from "./parser";
import { MeetingTemplate } from "./templates";

// Định nghĩa trạng thái
export type MeetingStatus = 'transcribing' | 'transcribed' | 'summarizing' | 'completed' | 'failed' | 'draft';
export type ActionItemStatus = 'pending' | 'draft' | 'sent';
// Thêm interface TaskItem
export interface TaskItem {
  id: number;
  task: string;
  assigneeName: string; // Tên AI gợi ý
  department?: string;
  team?: string;
  email: string[];        // Email người nhận thực tế
  deadline: string;
}
// Định nghĩa Interface (Đã đổi audioBlob -> audioUrl)
export interface Meeting {
  id: string;
  userId: string;
  jobId?: string;       // ID Job RunPod
  jobStartedAt?: number; // Thời điểm bắt đầu job (cho timeout)
  title: string;
  createdAt: number;
  duration: number;
  audioUrl?: string;
  segments: Segment[];
  speakers: Speaker[];
  summary?: string;
  status: MeetingStatus;
  isDeleted: boolean;
  errorMessage?: string;
  actionItems?: TaskItem[];
  actionStatus?: ActionItemStatus;
  isMinuteOnly?: boolean; // Flag for imported minutes without audio/transcript
  language?: "vi" | "en"; // Ngôn ngữ phiên âm: "vi" (mặc định) hoặc "en"
  folderId?: string | null;
  shareToken?: string;
  objectives?: string;
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
    console.warn("⚠️ Lỗi lưu meeting (có thể do limit 1MB). Đang thử giảm dung lượng...", error);
    try {
      const docRef = doc(db, COLLECTION_NAME, meeting.id);
      // Lược bỏ mảng words khỏi segments để tránh lỗi vượt quá 1MB
      const lightSegments = meeting.segments.map((s: any) => {
        const { words, ...rest } = s;
        return rest;
      });
      const lightMeeting = { ...meeting, segments: lightSegments };
      const cleanData = JSON.parse(JSON.stringify(lightMeeting));
      await setDoc(docRef, cleanData);
    } catch (fallbackError) {
      console.error("Vẫn lỗi sau khi giảm dung lượng:", fallbackError);
      throw fallbackError; // Bắn lỗi ra để EditorState.tsx catch được
    }
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

// 3.1 Lấy cuộc họp qua Share Token hoặc ID (Cho view Khách)
export const getMeetingByShareId = async (shareId: string): Promise<Meeting | undefined> => {
  try {
    // Ưu tiên tìm bằng shareToken
    const q = query(collection(db, COLLECTION_NAME), where("shareToken", "==", shareId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as Meeting;
    }

    // Fallback: Tìm bằng ID trực tiếp (nếu chưa có token hoặc token == ID)
    return await getMeetingById(shareId);
  } catch (error) {
    console.error("Lỗi lấy từ share link:", error);
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

// 7.1 Cập nhật folder cho meeting
export const updateMeetingFolder = async (meetingId: string, folderId: string | null) => {
  const docRef = doc(db, COLLECTION_NAME, meetingId);
  await updateDoc(docRef, { folderId: folderId });
};

// 7.2 Tạo Token Chia sẻ
export const generateMeetingShareToken = async (id: string) => {
  // Tạo token ngẫu nhiên đẹp, dài khoảng 16 ký tự: rand-rand
  const token = Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 10);
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { shareToken: token });
  return token;
};

// 8. Lấy danh sách đang chạy (Cho PollingManager)
// Dùng onSnapshot để lắng nghe real-time (TỐI ƯU HƠN GET LIÊN TỤC)
export const subscribeToActiveMeetings = (userId: string, onUpdate: (meetings: Meeting[]) => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("status", "==", "transcribing")
  );

  // Trả về hàm unsubscribe
  return onSnapshot(q, (snapshot) => {
    const meetings = snapshot.docs.map(doc => doc.data() as Meeting);
    onUpdate(meetings);
  }, (error) => {
    console.error("Lỗi listen active meetings:", error);
  });
};

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
      return true;

    } catch (e) {
      console.error("Lỗi tạo data mẫu:", e);
    }
    return false;
  }
};
// --- PHẦN MỚI: QUẢN LÝ MEMBER ---

export interface Member {
  id: string;
  name: string;
  email: string;
  department?: string; // Quan trọng để map
  team?: string;
}

// Hàm lấy sub-collection members của 1 user
// Cấu trúc: users/{userId}/members/{memberId}
const getMemberCollection = (userId: string) => {
  return collection(db, "users", userId, "members");
};

// 1. Lấy danh sách nhân viên
export const getMembers = async (userId: string): Promise<Member[]> => {
  if (!userId) return [];
  try {
    const q = query(getMemberCollection(userId), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  } catch (error) {
    console.error("Lỗi lấy danh sách member:", error);
    return [];
  }
};

// 2. Thêm hoặc Cập nhật nhân viên
export const saveMember = async (userId: string, member: Member) => {
  if (!userId) return;
  try {
    // Nếu có ID thì update, chưa có thì tạo mới (dùng doc() để tự sinh ID nếu cần)
    const memberRef = member.id
      ? doc(db, "users", userId, "members", member.id)
      : doc(getMemberCollection(userId)); // Tự sinh ID

    const memberData = { ...member, id: memberRef.id }; // Đảm bảo ID được lưu

    // Dùng setDoc với merge: true để an toàn
    await setDoc(memberRef, memberData, { merge: true });
    return memberData.id;
  } catch (error) {
    console.error("Lỗi lưu member:", error);
    throw error;
  }
};

// 3. Xóa nhân viên
export const deleteMember = async (userId: string, memberId: string) => {
  if (!userId || !memberId) return;
  try {
    const memberRef = doc(db, "users", userId, "members", memberId);
    await deleteDoc(memberRef);
  } catch (error) {
    console.error("Lỗi xóa member:", error);
    throw error;
  }
};
export const getExistingDepartments = async (userId: string): Promise<string[]> => {
  const members = await getMembers(userId);

  // Trích xuất mảng department
  const depts = members.map(m => m.department).filter((d): d is string => Boolean(d)); // Lấy tên và loại bỏ null/undefined

  // Loại bỏ trùng lặp bằng Set
  const uniqueDepts = Array.from(new Set(depts));

  // Sắp xếp A-Z
  return uniqueDepts.sort();
};
export const getExistingTeams = async (userId: string): Promise<string[]> => {
  const members = await getMembers(userId);
  const teams = members.map(m => m.team).filter(Boolean) as string[];
  return Array.from(new Set(teams)).sort();
};

// --- PHẦN MỚI: QUẢN LÝ CUSTOM TEMPLATES ---

const getTemplateCollection = (userId: string) => {
  return collection(db, "users", userId, "templates");
};

// 1. Lấy danh sách template tùy chỉnh
export const getCustomTemplates = async (userId: string): Promise<MeetingTemplate[]> => {
  if (!userId) return [];
  try {
    const q = query(getTemplateCollection(userId), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isCustom: true,
      userId
    } as MeetingTemplate));
  } catch (error) {
    console.error("Lỗi lấy custom templates:", error);
    return [];
  }
};

// 2. Lưu hoặc Tạo mới Template
export const saveCustomTemplate = async (userId: string, template: Partial<MeetingTemplate>) => {
  if (!userId) return;
  try {
    const templateRef = template.id
      ? doc(db, "users", userId, "templates", template.id)
      : doc(getTemplateCollection(userId)); // Tự sinh ID new

    const dataToSave = {
      name: template.name,
      description: template.description || "",
      structure: template.structure,
      updatedAt: Date.now()
    };

    await setDoc(templateRef, dataToSave, { merge: true });
    return templateRef.id;
  } catch (error) {
    console.error("Lỗi lưu template:", error);
    throw error;
  }
};

// 3. Xóa Template
export const deleteCustomTemplate = async (userId: string, templateId: string) => {
  if (!userId || !templateId) return;
  try {
    const docRef = doc(db, "users", userId, "templates", templateId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Lỗi xóa template:", error);
    throw error;
  }
};
// --- PHẦN MỚI: QUẢN LÝ THƯ MỤC (FOLDERS) ---

export interface Folder {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
}

const getFolderCollection = (userId: string) => {
  return collection(db, "users", userId, "folders");
};

export const saveFolder = async (userId: string, folder: Folder) => {
  if (!userId) return;
  try {
    const folderRef = folder.id
      ? doc(db, "users", userId, "folders", folder.id)
      : doc(getFolderCollection(userId));
    
    const folderData = { ...folder, id: folderRef.id };
    await setDoc(folderRef, folderData, { merge: true });
    return folderData.id;
  } catch (error) {
    console.error("Lỗi lưu folder:", error);
    throw error;
  }
};

export const getFolders = async (userId: string): Promise<Folder[]> => {
  if (!userId) return [];
  try {
    const q = query(getFolderCollection(userId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
  } catch (error) {
    console.error("Lỗi lấy danh sách folder:", error);
    return [];
  }
};

export const deleteFolder = async (userId: string, folderId: string) => {
  if (!userId || !folderId) return;
  try {
    const folderRef = doc(db, "users", userId, "folders", folderId);
    await deleteDoc(folderRef);
  } catch (error) {
    console.error("Lỗi xóa folder:", error);
    throw error;
  }
};

// --- PHẦN MỚI: QUẢN LÝ LIVE SESSIONS ---

export interface LiveSession {
  id: string;
  hostId: string;
  title: string;
  language?: "vi" | "en";
  segments: Segment[];
  summary: string;
  status: "live" | "ended";
  startedAt: number;
}

const LIVE_COLLECTION = "live_sessions";

// 1. Khởi tạo một phiên live
export const createLiveSession = async (session: LiveSession) => {
  try {
    const docRef = doc(db, LIVE_COLLECTION, session.id);
    const cleanData = JSON.parse(JSON.stringify(session));
    
    // Thêm trường expireAt (24h sau) để Firebase TTL tự động dọn dẹp (tính năng xóa rác)
    cleanData.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await setDoc(docRef, cleanData);
  } catch (error) {
    console.error("Lỗi tạo Live Session:", error);
    throw error;
  }
};

// 2. Cập nhật dữ liệu live (Segments và Summary)
export const updateLiveSession = async (sessionId: string, segments: Segment[], summary: string) => {
  try {
    const docRef = doc(db, LIVE_COLLECTION, sessionId);
    // Deep copy để tránh lỗi Reference của React/Firebase
    const cleanSegments = JSON.parse(JSON.stringify(segments));
    await updateDoc(docRef, {
      segments: cleanSegments,
      summary: summary
    });
  } catch (error) {
    console.warn("⚠️ Lỗi cập nhật Live Session (có thể do limit 1MB). Đang thử giảm dung lượng...", error);
    try {
      const docRef = doc(db, LIVE_COLLECTION, sessionId);
      const lightSegments = segments.map((s: any) => {
        const { words, ...rest } = s;
        return rest;
      });
      const cleanLightSegments = JSON.parse(JSON.stringify(lightSegments));
      await updateDoc(docRef, {
        segments: cleanLightSegments,
        summary: summary
      });
    } catch (fallbackError) {
      console.error("Vẫn lỗi sau khi giảm dung lượng Live Session:", fallbackError);
    }
  }
};

// 3. Kết thúc phiên live
export const endLiveSession = async (sessionId: string) => {
  if (!sessionId) return;
  try {
    const docRef = doc(db, LIVE_COLLECTION, sessionId);
    await updateDoc(docRef, { status: "ended" });
  } catch (error) {
    console.error("Lỗi kết thúc Live Session:", error);
  }
};

// 4. Lắng nghe dữ liệu live (Dành cho Viewer)
export const subscribeToLiveSession = (sessionId: string, onUpdate: (data: LiveSession | null) => void) => {
  const docRef = doc(db, LIVE_COLLECTION, sessionId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as LiveSession);
    } else {
      onUpdate(null);
    }
  }, (error) => {
    console.error("Lỗi lắng nghe Live Session:", error);
    onUpdate(null);
  });
};
