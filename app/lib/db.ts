// app/lib/db.ts
import { db } from "./firebase";
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy
} from "firebase/firestore";
import { Segment, Speaker, RAW_TRANSCRIPT_FILE, RAW_SUMMARY_FILE } from "./mockData";
import { parseTranscriptFile } from "./parser";

// Định nghĩa trạng thái
export type MeetingStatus = 'transcribing' | 'transcribed' | 'summarizing' | 'completed' | 'failed' | 'draft';
export type ActionItemStatus = 'pending' | 'draft' | 'sent';
// Thêm interface TaskItem
export interface TaskItem {
  id: number;
  task: string;
  assigneeName: string; // Tên AI gợi ý
  department?: string;
  team?: string; // [MỚI] Thêm trường team
  email: string[];        // Email người nhận thực tế
  deadline: string;
}
// Định nghĩa Interface (Đã đổi audioBlob -> audioUrl)
export interface Meeting {
  id: string;
  userId: string;       // [QUAN TRỌNG] Phân biệt user
  jobId?: string;       // ID Job RunPod
  title: string;
  createdAt: number;
  duration: number;
  audioUrl?: string;     // [THAY ĐỔI] Lưu đường dẫn thay vì file Blob (Optional cho Draft)
  segments: Segment[];
  speakers: Speaker[];
  summary?: string;
  status: MeetingStatus;
  isDeleted: boolean;
  errorMessage?: string;
  actionItems?: TaskItem[];
  actionStatus?: ActionItemStatus;
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