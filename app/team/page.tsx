"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Search, Users, 
  Briefcase, Building2, Save, X 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useGlobalUI } from "../context/GlobalUIProvider";
// THÊM: import hàm lấy danh sách phòng ban existing
import { getMembers, saveMember, deleteMember, getExistingDepartments, Member } from "../lib/db";

// Danh sách gợi ý mặc định (Base suggestions)
const DEFAULT_DEPARTMENTS = [
  "Ban Giám Đốc",
  "Phòng IT",
  "Phòng Kế toán",
  "Phòng Nhân sự",
  "Phòng Marketing",
  "Phòng Sale",
  "Phòng Vận hành"
];

export default function TeamPage() {
  const { user, loading } = useAuth();
  const { toast, confirm } = useGlobalUI();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // State cho Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<Member>>({});

  // THÊM: State lưu danh sách gợi ý phòng ban
  const [deptSuggestions, setDeptSuggestions] = useState<string[]>(DEFAULT_DEPARTMENTS);

  // 1. Load dữ liệu khi vào trang
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      fetchMembers();
      // Load thêm gợi ý phòng ban
      fetchDepartmentSuggestions();
    }
  }, [user, loading]);

  const fetchMembers = async () => {
    if (!user) return;
    setIsLoadingData(true);
    const data = await getMembers(user.uid);
    setMembers(data);
    setIsLoadingData(false);
  };

  // THÊM: Hàm lấy danh sách phòng ban dynamic
  const fetchDepartmentSuggestions = async () => {
    if (!user) return;
    try {
      // Lấy danh sách đang có trong DB
      const dbDepts = await getExistingDepartments(user.uid);
      
      // Gộp với danh sách mặc định + Xóa trùng lặp
      const merged = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...dbDepts]));
      setDeptSuggestions(merged.sort());
    } catch (e) {
      console.error("Lỗi load suggestions", e);
    }
  };

  // 2. Xử lý Lưu (Thêm mới hoặc Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!editingMember.name || !editingMember.email || !editingMember.department) {
      toast.error("Vui lòng điền đủ thông tin bắt buộc");
      return;
    }

    try {
      await saveMember(user.uid, editingMember as Member);
      toast.success(editingMember.id ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên mới");
      setIsModalOpen(false);
      
      // Reload cả list member và list gợi ý phòng ban (nhỡ có phòng ban mới)
      fetchMembers(); 
      fetchDepartmentSuggestions(); 
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu dữ liệu");
    }
  };

  // 3. Xử lý Xóa
  const handleDelete = async (id: string) => {
    if (!user) return;
    const ok = await confirm({
      title: "Xóa nhân viên?",
      message: "Bạn có chắc muốn xóa nhân viên này khỏi danh sách?",
      type: "danger",
      confirmText: "Xóa ngay"
    });

    if (ok) {
      await deleteMember(user.uid, id);
      toast.success("Đã xóa thành công");
      fetchMembers();
      fetchDepartmentSuggestions(); // Update lại list gợi ý
    }
  };

  // 4. Mở Modal
  const openModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
    } else {
      setEditingMember({
        name: "", 
        email: "", 
        department: "", // Để trống để user tự nhập hoặc chọn
        team: "" 
      }); 
    }
    setIsModalOpen(true);
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* HEADER - Giữ nguyên */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Quản lý Nhân sự
            </h1>
            <p className="text-xs text-slate-500">Danh bạ dùng để giao việc tự động</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Thêm nhân viên
        </button>
      </header>

      {/* CONTENT - Giữ nguyên */}
      <main className="max-w-5xl mx-auto p-6">
        {/* Search Bar */}
        <div className="mb-6 relative">
          <input 
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            className="w-full pl-10 p-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* List Member - Giữ nguyên */}
        {isLoadingData ? (
          <div className="text-center py-12 text-slate-400">Đang tải danh sách...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Chưa có nhân viên nào.</p>
            <button onClick={() => openModal()} className="text-indigo-600 font-medium hover:underline">
              Thêm nhân viên đầu tiên ngay
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:border-indigo-300 transition-colors group">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{member.name}</h3>
                  <p className="text-sm text-slate-500 truncate mb-2">{member.email}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1 text-slate-600">
                      <Building2 className="w-3 h-3" /> {member.department}
                    </span>
                    {member.team && (
                      <span className="bg-blue-50 px-2 py-1 rounded flex items-center gap-1 text-blue-600">
                        <Briefcase className="w-3 h-3" /> {member.team}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(member)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(member.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editingMember.id ? "Sửa thông tin" : "Thêm nhân viên mới"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Tên - Giữ nguyên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ và Tên *</label>
                <input 
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="VD: Nguyễn Văn A"
                  value={editingMember.name || ""}
                  onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                />
              </div>

              {/* Email - Giữ nguyên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Google) *</label>
                <input 
                  required
                  type="email"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="nhanvien@congty.com"
                  value={editingMember.email || ""}
                  onChange={e => setEditingMember({...editingMember, email: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* --- PHẦN SỬA ĐỔI: COMBOBOX PHÒNG BAN --- */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phòng ban *</label>
                  
                  {/* Input nhập liệu bình thường nhưng có thêm list="..." */}
                  <input 
                    required
                    list="department-suggestions" // Link với datalist bên dưới
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Chọn hoặc nhập..."
                    value={editingMember.department || ""}
                    onChange={e => setEditingMember({...editingMember, department: e.target.value})}
                  />

                  {/* Danh sách gợi ý ẩn */}
                  <datalist id="department-suggestions">
                    {deptSuggestions.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
                {/* --- HẾT PHẦN SỬA ĐỔI --- */}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Team (Optional)</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="VD: Mobile"
                    value={editingMember.team || ""}
                    onChange={e => setEditingMember({...editingMember, team: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition flex justify-center items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}