'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { apiEndpoints } from '@/lib/api-endpoints';
import { toast } from 'sonner';
import { Upload, X, File, Image, FileText, Archive, FileCode } from 'lucide-react';

interface FileRecord {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url?: string;
  uploadedBy?: string;
  createdAt?: string;
}

interface FileUploadProps {
  onUpload: (file: FileRecord) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
];

const TYPE_ICONS: Record<string, any> = {
  'image': Image,
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileText,
  'text/plain': FileCode,
  'text/csv': FileCode,
  'application/zip': Archive,
};

function getFileIcon(mimetype: string) {
  if (mimetype.startsWith('image/')) return TYPE_ICONS['image'];
  return TYPE_ICONS[mimetype] ?? File;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function BlobImage({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center" />;
  return <img src={url} alt={file.name} className="h-10 w-10 rounded-lg object-cover" />;
}

export default function FileUpload({ onUpload, accept, multiple = false, maxSize = 10 * 1024 * 1024 }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) return `File exceeds max size of ${formatFileSize(maxSize)}`;
    if (accept) {
      const acceptTypes = accept.split(',').map((t) => t.trim());
      const matches = acceptTypes.some((t) => {
        if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t.toLowerCase());
        if (t.endsWith('/*')) return file.type.startsWith(t.replace('/*', '/'));
        return file.type === t;
      });
      if (!matches) return `File type "${file.type}" not accepted`;
    } else if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type "${file.type}" not allowed`;
    }
    return null;
  }, [accept, maxSize]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: File[] = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      valid.push(f);
    }
    if (multiple) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    } else {
      setSelectedFiles(valid.slice(0, 1));
    }
  }, [validateFile, multiple]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const upload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const formData = new FormData();
        formData.append('file', selectedFiles[i]);
        const res = await apiEndpoints.files.upload(formData);
        onUpload(res.data.file ?? res.data);
        setProgress(((i + 1) / selectedFiles.length) * 100);
      }
      toast.success(`File${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`);
      setSelectedFiles([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
        <Upload className={`h-8 w-8 mx-auto mb-3 ${isDragging ? 'text-violet-400' : 'text-slate-500'}`} />
        <p className="text-sm text-slate-300 font-medium">
          {isDragging ? 'Drop files here' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Max {formatFileSize(maxSize)} {multiple ? 'per file' : ''} &middot; Images, PDFs, Docs, Text, ZIP
        </p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <div key={`${file.name}-${i}`} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-700">
                {file.type.startsWith('image/') ? (
                  <BlobImage file={file} />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                {!uploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}

          {uploading && (
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <button
            onClick={upload}
            disabled={uploading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? `Uploading... ${Math.round(progress)}%` : `Upload ${selectedFiles.length > 1 ? `${selectedFiles.length} files` : 'file'}`}
          </button>
        </div>
      )}
    </div>
  );
}
