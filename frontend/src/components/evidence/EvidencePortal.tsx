// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Upload Portal
// File: src/components/evidence/EvidencePortal.tsx
//
// Used by: DEPT_SECURITY, DEPT_CISO users
// Purpose: Upload proof of remediation to close/remediate a finding
// Security: File type validation, size limits, hash preview before upload
// ─────────────────────────────────────────────────────────────────
 
import { useState, useCallback, useRef } from 'react';  srgw
import { useParams } from 'react-router-dom';     
import {
  Upload, FileText, Shield, CheckCircle2, AlertCircle, 
  Hash, Lock, Clock, ChevronDown, X, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type EvidenceType =
  | 'SCREENSHOT' | 'LOG_FILE' | 'CONFIGURATION_EXPORT' | 'POLICY_DOCUMENT'
  | 'SCAN_REPORT' | 'TEST_RESULT' | 'CERTIFICATE' | 'VIDEO_RECORDING' | 'OTHER';

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  recommendation: string;
  slaDate: string;
  asset?: { name: string };
  control?: { controlCode: string; name: string };
  _count: { evidence: number };
}

interface SelectedFile {
  file: File;
  hash?: string;
  hashComputing?: boolean;
  preview?: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-900 text-red-300 border-red-700',
  HIGH: 'bg-orange-900 text-orange-300 border-orange-700',
  MEDIUM: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  LOW: 'bg-slate-700 text-slate-300 border-slate-600',
  INFO: 'bg-slate-800 text-slate-400 border-slate-700',
};

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/json', 'application/zip',
];

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Main Component ─────────────────────────────────────────────

export function EvidencePortal({ finding }: { finding: Finding }) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('SCREENSHOT');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean; message: string; hash?: string; evidenceId?: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSlaBreached = finding.slaDate && new Date(finding.slaDate) < new Date();
  const daysUntilSla = finding.slaDate
    ? Math.ceil((new Date(finding.slaDate).getTime() - Date.now()) / 86400000)
    : null;

  // ── File selection & client-side hash ─────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert(`File type '${file.type}' is not permitted.`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File exceeds 50MB limit.');
      return;
    }

    const preview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : undefined;

    setSelectedFile({ file, hashComputing: true, preview });
    setUploadResult(null);

    // Compute SHA-256 on client — user can verify before uploading
    const hash = await computeSHA256(file);
    setSelectedFile({ file, hash, hashComputing: false, preview });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Upload ─────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile?.file || !selectedFile.hash) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile.file);
    formData.append('evidenceType', evidenceType);
    formData.append('description', description);
    formData.append('clientHash', selectedFile.hash); // Server will verify match

    try {
      const res = await fetch(`/api/findings/${finding.id}/evidence`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ncagp_token')}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Upload failed');

      setUploadResult({
        success: true,
        message: 'Evidence uploaded and cryptographically verified.',
        hash: data.sha256Hash,
        evidenceId: data.id,
      });
      setSelectedFile(null);
      setDescription('');
    } catch (err: any) {
      setUploadResult({ success: false, message: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 bg-slate-950 min-h-screen text-white">
      
      {/* Finding Header */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'px-2 py-0.5 rounded text-xs font-bold border',
              SEVERITY_BADGE[finding.severity],
            )}>
              {finding.severity}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white leading-tight mb-1">
                {finding.title}
              </h2>
              <p className="text-sm text-slate-400 line-clamp-2">{finding.description}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            {finding.asset && (
              <span className="text-slate-500">
                Asset: <span className="text-slate-300">{finding.asset.name}</span>
              </span>
            )}
            {finding.control && (
              <span className="text-slate-500">
                Control: <span className="text-slate-300 font-mono">{finding.control.controlCode}</span>
              </span>
            )}
            <span className="text-slate-500">
              Evidence: <span className="text-slate-300">{finding._count.evidence} uploaded</span>
            </span>
          </div>

          {/* SLA Warning */}
          {daysUntilSla !== null && (
            <div className={cn(
              'flex items-center gap-2 mt-3 p-2 rounded text-xs font-medium',
              isSlaBreached
                ? 'bg-red-950 border border-red-800 text-red-300'
                : daysUntilSla <= 2
                ? 'bg-orange-950 border border-orange-800 text-orange-300'
                : 'bg-slate-800 border border-slate-700 text-slate-400',
            )}>
              <Clock className="h-3 w-3 flex-shrink-0" />
              {isSlaBreached
                ? `SLA BREACHED — ${Math.abs(daysUntilSla)} days overdue`
                : `SLA: ${daysUntilSla} day${daysUntilSla !== 1 ? 's' : ''} remaining`}
              {' — '}
              {new Date(finding.slaDate).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation */}
      {finding.recommendation && (
        <Card className="bg-blue-950/30 border-blue-900/50">
          <CardContent className="pt-4">
            <div className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-1">
              Recommended Fix
            </div>
            <p className="text-sm text-slate-300">{finding.recommendation}</p>
          </CardContent>
        </Card>
      )}

      {/* Upload Zone */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-400" />
            Upload Evidence
          </CardTitle>
          <p className="text-xs text-slate-500">
            Files are SHA-256 hashed and stored immutably. Evidence cannot be deleted once uploaded.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-blue-500 bg-blue-950/30'
                : selectedFile
                ? 'border-green-700 bg-green-950/20'
                : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />

            {selectedFile ? (
              <div className="space-y-3">
                {selectedFile.preview && (
                  <img
                    src={selectedFile.preview}
                    alt="Preview"
                    className="max-h-32 mx-auto rounded object-contain"
                  />
                )}
                {!selectedFile.preview && (
                  <FileText className="h-10 w-10 text-green-400 mx-auto" />
                )}
                <div>
                  <div className="text-sm font-medium text-white">{selectedFile.file.name}</div>
                  <div className="text-xs text-slate-500">{formatFileSize(selectedFile.file.size)}</div>
                </div>

                {/* Client-side hash preview */}
                <div className="bg-slate-900 rounded-lg p-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Hash className="h-3 w-3" />
                    SHA-256 (computed in your browser)
                  </div>
                  {selectedFile.hashComputing ? (
                    <div className="text-xs text-slate-500 animate-pulse">Computing hash...</div>
                  ) : (
                    <div className="font-mono text-xs text-green-400 break-all">
                      {selectedFile.hash}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 mx-auto"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <div className="text-sm text-slate-400">
                  Drag & drop or <span className="text-blue-400">browse files</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  PNG, JPG, PDF, TXT, CSV, JSON, ZIP — max 50MB
                </div>
              </>
            )}
          </div>

          {/* Evidence type */}
          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Evidence Type</Label>
            <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {[
                  ['SCREENSHOT', 'Screenshot'],
                  ['LOG_FILE', 'Log File'],
                  ['CONFIGURATION_EXPORT', 'Configuration Export'],
                  ['POLICY_DOCUMENT', 'Policy Document'],
                  ['SCAN_REPORT', 'Scan Report'],
                  ['TEST_RESULT', 'Test Result'],
                  ['CERTIFICATE', 'Certificate'],
                  ['VIDEO_RECORDING', 'Video Recording'],
                  ['OTHER', 'Other'],
                ].map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-white hover:bg-slate-700">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">
              What does this evidence prove? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Screenshot showing MFA is now enforced on the admin portal. Taken on 2024-01-15."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 resize-none"
              rows={3}
            />
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2 p-3 bg-slate-800 rounded-lg text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
            <div>
              This evidence will be encrypted at rest and stored in NIC-India data centres.
              The SHA-256 hash ensures file integrity and provides non-repudiation.
              Evidence is <strong className="text-slate-400">permanently immutable</strong> once uploaded.
            </div>
          </div>

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || selectedFile.hashComputing || !description.trim() || uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading & verifying hash...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Upload Evidence Securely
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <div className={cn(
          'p-4 rounded-xl border',
          uploadResult.success
            ? 'bg-green-950 border-green-800 text-green-300'
            : 'bg-red-950 border-red-800 text-red-300',
        )}>
          <div className="flex items-center gap-2 font-semibold mb-2">
            {uploadResult.success
              ? <CheckCircle2 className="h-5 w-5" />
              : <AlertCircle className="h-5 w-5" />}
            {uploadResult.success ? 'Evidence Uploaded Successfully' : 'Upload Failed'}
          </div>
          <p className="text-sm">{uploadResult.message}</p>
          {uploadResult.hash && (
            <div className="mt-2">
              <div className="text-xs opacity-70 mb-0.5">Server-verified SHA-256:</div>
              <div className="font-mono text-xs break-all">{uploadResult.hash}</div>
            </div>
          )}
          {uploadResult.evidenceId && (
            <div className="text-xs opacity-70 mt-1">
              Evidence ID: <span className="font-mono">{uploadResult.evidenceId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
