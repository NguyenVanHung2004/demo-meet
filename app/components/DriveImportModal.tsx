
"use client";

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, RefreshCcw, HardDrive, Video, FileVideo } from 'lucide-react';
import { uploadAudioToFirebase, startTranscriptionJob } from '../lib/api';
import { saveMeeting, Meeting } from '../lib/db'; // [MỚI]
import { useAuth } from '../context/AuthContext';

import { useGlobalUI } from '../context/GlobalUIProvider'; // [MỚI]

export default function DriveImportModal({ isOpen, onClose, onImportSuccess }: { isOpen: boolean; onClose: () => void; onImportSuccess: () => void }) {
    const { user } = useAuth();
    const { toast } = useGlobalUI(); // [MỚI] Import toast

    const [isConnected, setIsConnected] = useState(false);
    const [initializing, setInitializing] = useState(true); // [MỚI] Initial check state
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [importingId, setImportingId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false); // [NEW] Toggle state

    // Check connection status on mount or open
    useEffect(() => {
        if (isOpen) {
            checkDriveStatus();
        } else {
            setInitializing(true); // Reset on close
        }
    }, [isOpen, showAll]); // [NEW] Re-fetch when showAll changes

    // Check if we have a token (by trying to fetch files)
    const checkDriveStatus = async () => {
        if (!files.length) setLoading(true);
        try {
            const mode = showAll ? 'all' : 'meet';
            const res = await fetch(`/api/drive/list?mode=${mode}`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
                setIsConnected(true);
            } else {
                if (res.status === 401) {
                    setIsConnected(false);
                }
            }
        } catch (error) {
            console.error("DRIVE CHECK ERROR", error);
            setIsConnected(false);
        } finally {
            setLoading(false);
            setInitializing(false); // [MỚI] Done checking
        }
    };

    const handleConnect = () => {
        // Redirect to auth endpoint
        window.location.href = '/api/drive/auth';
    };

    const handleImport = async (file: any) => {
        if (!user) {
            alert("Vui lòng đăng nhập để import.");
            return;
        }

        setImportingId(file.id);
        try {
            // 1. Download from Drive via Proxy (Server)
            const downloadRes = await fetch(`/api/drive/download?fileId=${file.id}`);
            if (!downloadRes.ok) throw new Error("Failed to download from Drive");

            const blob = await downloadRes.blob();
            const fileObj = new File([blob], file.name, { type: blob.type });

            // 2. Upload to Firebase (Client SDK - Authenticated)
            const firebaseUrl = await uploadAudioToFirebase(fileObj, user.uid);

            // 3. Trigger Transcription
            const jobId = await startTranscriptionJob(firebaseUrl);

            // 4. Create local DB Record [MỚI]
            const tempId = crypto.randomUUID();
            const newMeeting: Meeting = {
                id: tempId,
                userId: user.uid,
                jobId: jobId,
                title: file.name.replace(/\.[^/.]+$/, ""),
                createdAt: Date.now(),
                duration: 0,
                audioUrl: firebaseUrl,
                segments: [],
                speakers: [],
                status: 'transcribing',
                isDeleted: false
            };
            await saveMeeting(newMeeting);

            alert(`Import started! Job ID: ${jobId}`);
            window.location.reload(); // Reload to update dashboard
            onClose();

        } catch (e: any) {
            console.error("Import Error:", e);
            alert("Import Error: " + e.message);
        } finally {
            setImportingId(null);
        }
    };

    const formatSize = (bytes: string) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(parseInt(bytes)) / Math.log(k));
        return parseFloat((parseInt(bytes) / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <HardDrive className="w-6 h-6 text-green-600" />
                        Google Drive Import
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {initializing ? (
                        <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                            Checking connection...
                        </div>
                    ) : !isConnected ? (
                        <div className="text-center py-10">
                            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HardDrive className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">Connect to Google Drive</h3>
                            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                Connect your account to import recordings directly from the "Meet Recordings" folder.
                            </p>
                            <button
                                onClick={handleConnect}
                                className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2 mx-auto shadow-sm"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                Sign in with Google
                            </button>
                        </div>
                    ) : (
                        <div>
                            {loading ? (
                                <div className="text-center py-10 text-gray-500 animate-pulse">Loading recordings...</div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-medium">Recent Recordings</h3>

                                        <div className="flex items-center gap-4">
                                            {/* [NEW] Show All Toggle */}
                                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={showAll}
                                                    onChange={(e) => setShowAll(e.target.checked)}
                                                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                                                />
                                                Show all videos
                                            </label>

                                            <button onClick={checkDriveStatus} className="text-sm text-green-600 hover:underline flex items-center gap-1">
                                                <RefreshCcw className="w-3 h-3" /> Refresh
                                            </button>
                                        </div>
                                    </div>

                                    {files.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                            No recordings found in "Meet Recordings" folder.
                                        </div>
                                    ) : (
                                        files.map((file) => (
                                            <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-green-300 hover:bg-green-50 transition group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded flex items-center justify-center">
                                                        <FileVideo className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 line-clamp-1 break-all">{file.name}</div>
                                                        <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                                                            <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                                                            <span>•</span>
                                                            <span>{formatSize(file.size)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleImport(file)}
                                                    disabled={importingId === file.id}
                                                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-green-600 hover:text-white hover:border-green-600 transition flex items-center gap-2 group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600"
                                                >
                                                    {importingId === file.id ? (
                                                        <>Importing...</>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-4 h-4" /> Import
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {isConnected && (
                    <div className="p-4 bg-gray-50 border-t text-center text-xs text-gray-500">
                        Connected to Google Drive • folder: Meet Recordings
                    </div>
                )}
            </div>
        </div>
    );
}
