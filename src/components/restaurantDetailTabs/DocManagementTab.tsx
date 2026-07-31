import React, { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Restaurant, DocumentVerificationHistoryLog } from '../../types';
import { uploadImageToStorage } from '../../services/imageUploadService';
import { sendNotification } from '../../services/notificationService';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Eye,
  Download,
  RotateCcw,
  Clock,
  ShieldCheck,
  Calendar,
  AlertCircle,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';

interface DocManagementTabProps {
  restaurant: Restaurant;
  onUpdate: () => void;
  logAdminAction: (action: string, details: string, beforeVal?: any, afterVal?: any) => Promise<void>;
}

interface DocDef {
  key: string;
  label: string;
  urlKey: keyof Restaurant;
  statusKey: keyof Restaurant;
  reasonKey: keyof Restaurant;
  expiryKey?: keyof Restaurant;
  isRequired: boolean;
}

const REQUIRED_DOCS: DocDef[] = [
  { key: 'gst', label: 'GST Certificate', urlKey: 'gstDocumentUrl', statusKey: 'gstStatus', reasonKey: 'gstRejectionReason', isRequired: true },
  { key: 'fssai', label: 'FSSAI Certificate', urlKey: 'fssaiDocumentUrl', statusKey: 'fssaiStatus', reasonKey: 'fssaiRejectionReason', expiryKey: 'fssaiExpiryDate', isRequired: true },
  { key: 'pan', label: 'Owner PAN Card', urlKey: 'ownerPanDocumentUrl', statusKey: 'panStatus', reasonKey: 'panRejectionReason', isRequired: true },
  { key: 'aadhaar', label: 'Owner Aadhaar Card', urlKey: 'ownerAadhaarDocumentUrl', statusKey: 'aadhaarStatus', reasonKey: 'aadhaarRejectionReason', isRequired: true },
  { key: 'cheque', label: 'Cancelled Cheque / Bank Passbook', urlKey: 'chequeDocumentUrl', statusKey: 'chequeStatus', reasonKey: 'chequeRejectionReason', isRequired: true },
  { key: 'shop', label: 'Shop License (Optional)', urlKey: 'shopLicenseUrl', statusKey: 'shopLicenseStatus', reasonKey: 'shopLicenseRejectionReason', expiryKey: 'shopLicenseExpiry', isRequired: false },
  { key: 'trade', label: 'Trade License (Optional)', urlKey: 'tradeLicenseUrl', statusKey: 'tradeLicenseStatus', reasonKey: 'tradeLicenseRejectionReason', expiryKey: 'tradeLicenseExpiry', isRequired: false },
  { key: 'menu', label: 'Menu PDF (Optional)', urlKey: 'menuPdfUrl', statusKey: 'menuPdfStatus', reasonKey: 'menuPdfRejectionReason', isRequired: false },
];

export default function DocManagementTab({ restaurant, onUpdate, logAdminAction }: DocManagementTabProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [actionDoc, setActionDoc] = useState<{ docDef: DocDef; type: 'reject' | 'reupload' } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

  // Helper to check expiry
  const checkExpiryStatus = (dateStr?: string) => {
    if (!dateStr) return null;
    const expDate = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 0) return { expired: true, text: `Expired on ${dateStr}` };
    if (diffDays <= 30) return { expiringSoon: true, text: `Expiring in ${diffDays} days (${dateStr})` };
    return { valid: true, text: `Valid until ${dateStr}` };
  };

  // Update document approval status
  const handleApproveDoc = async (docDef: DocDef) => {
    setIsSubmitting(true);
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      const now = new Date().toISOString();
      const historyLog: DocumentVerificationHistoryLog = {
        id: 'LOG_' + Date.now(),
        docType: docDef.label,
        action: 'approved',
        adminEmail: auth.currentUser?.email || 'admin@tingtong.com',
        timestamp: now,
      };

      const updateData: any = {
        [docDef.statusKey]: 'verified',
        [docDef.reasonKey]: '',
        docVerificationHistory: arrayUnion(historyLog),
        updatedAt: now,
      };

      await updateDoc(restRef, updateData);
      await logAdminAction(
        'DOC_APPROVE',
        `Approved document ${docDef.label} for ${restaurant.name}`,
        restaurant[docDef.statusKey],
        'verified'
      );

      await sendNotification({
        recipientId: restaurant.id,
        recipientName: restaurant.name,
        recipientType: 'restaurant',
        title: `Document Approved: ${docDef.label}`,
        message: `Your ${docDef.label} has been verified and approved by Master Admin.`,
        type: 'approval',
      });

      alert(`${docDef.label} approved successfully!`);
      onUpdate();
    } catch (err: any) {
      alert('Error approving document: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Rejection or Reupload Request
  const handleConfirmAction = async () => {
    if (!actionDoc || !reasonInput.trim()) {
      alert('Please enter a clear reason for the restaurant partner.');
      return;
    }
    setIsSubmitting(true);
    const { docDef, type } = actionDoc;
    const newStatus = type === 'reject' ? 'rejected' : 'reupload_requested';

    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      const now = new Date().toISOString();
      const historyLog: DocumentVerificationHistoryLog = {
        id: 'LOG_' + Date.now(),
        docType: docDef.label,
        action: type === 'reject' ? 'rejected' : 'reupload_requested',
        reason: reasonInput.trim(),
        adminEmail: auth.currentUser?.email || 'admin@tingtong.com',
        timestamp: now,
      };

      const updateData: any = {
        [docDef.statusKey]: newStatus,
        [docDef.reasonKey]: reasonInput.trim(),
        docVerificationHistory: arrayUnion(historyLog),
        updatedAt: now,
      };

      await updateDoc(restRef, updateData);
      await logAdminAction(
        type === 'reject' ? 'DOC_REJECT' : 'DOC_REUPLOAD_REQUEST',
        `${type === 'reject' ? 'Rejected' : 'Requested re-upload for'} ${docDef.label}: ${reasonInput.trim()}`,
        restaurant[docDef.statusKey],
        newStatus
      );

      await sendNotification({
        recipientId: restaurant.id,
        recipientName: restaurant.name,
        recipientType: 'restaurant',
        title: type === 'reject' ? `Document Rejected: ${docDef.label}` : `Action Required: Re-upload ${docDef.label}`,
        message: `Reason: ${reasonInput.trim()}`,
        type: type === 'reject' ? 'rejection' : 'document_reupload',
      });

      alert(`Updated document status to ${newStatus}`);
      setActionDoc(null);
      setReasonInput('');
      onUpdate();
    } catch (err: any) {
      alert('Error updating document: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Upload by Admin for missing document
  const handleAdminFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docDef: DocDef) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocKey(docDef.key);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        const uploadedUrl = await uploadImageToStorage(
          dataUrl,
          'restaurantDocs',
          `${restaurant.id}_${docDef.key}_${Date.now()}.jpg`
        );

        const restRef = doc(db, 'restaurants', restaurant.id);
        const now = new Date().toISOString();
        await updateDoc(restRef, {
          [docDef.urlKey]: uploadedUrl,
          [docDef.statusKey]: 'under_review',
          updatedAt: now,
        });

        await logAdminAction(
          'DOC_ADMIN_UPLOAD',
          `Admin directly uploaded ${docDef.label} for ${restaurant.name}`
        );

        alert(`${docDef.label} uploaded successfully!`);
        onUpdate();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingDocKey(null);
    }
  };

  // Expiry Date Update
  const handleUpdateExpiry = async (docDef: DocDef, expiryVal: string) => {
    if (!docDef.expiryKey) return;
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      await updateDoc(restRef, {
        [docDef.expiryKey]: expiryVal,
        updatedAt: new Date().toISOString(),
      });
      await logAdminAction('UPDATE_EXPIRY', `Updated expiry date for ${docDef.label} to ${expiryVal}`);
      onUpdate();
    } catch (err: any) {
      alert('Failed to set expiry date: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Enterprise Compliance & Document Portal
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit, verify, approve or request re-uploads for mandatory regulatory merchant certificates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Total Verification Rate:</span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold">
            {
              REQUIRED_DOCS.filter((d) => restaurant[d.statusKey] === 'verified' || restaurant[d.statusKey] === 'approved').length
            }{' '}
            / {REQUIRED_DOCS.length} Passed
          </span>
        </div>
      </div>

      {/* Grid of Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIRED_DOCS.map((docDef) => {
          const docUrl = restaurant[docDef.urlKey] as string | undefined;
          const status = (restaurant[docDef.statusKey] as string) || 'pending';
          const reason = (restaurant[docDef.reasonKey] as string) || '';
          const expiryDate = docDef.expiryKey ? (restaurant[docDef.expiryKey] as string) : undefined;
          const expiryStatus = checkExpiryStatus(expiryDate);

          return (
            <div
              key={docDef.key}
              className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-md transition ${
                status === 'verified' || status === 'approved'
                  ? 'border-emerald-500/30'
                  : status === 'rejected'
                  ? 'border-rose-500/30'
                  : status === 'reupload_requested'
                  ? 'border-amber-500/30'
                  : 'border-slate-800'
              }`}
            >
              {/* Header Bar */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-100">{docDef.label}</h4>
                    {docDef.isRequired && (
                      <span className="text-[9px] font-mono font-bold text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Key: {docDef.key.toUpperCase()}</p>
                </div>

                {/* Status Badge */}
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                    status === 'verified' || status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : status === 'reupload_requested'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {status === 'verified' || status === 'approved' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </>
                  ) : status === 'rejected' ? (
                    <>
                      <XCircle className="w-3 h-3" /> Rejected
                    </>
                  ) : status === 'reupload_requested' ? (
                    <>
                      <RotateCcw className="w-3 h-3" /> Reupload Req.
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" /> Pending
                    </>
                  )}
                </span>
              </div>

              {/* Document Image or File Preview Area */}
              {docUrl ? (
                <div className="relative group bg-slate-950 border border-slate-850 rounded-xl overflow-hidden h-36 flex items-center justify-center">
                  {docUrl.toLowerCase().endsWith('.pdf') || docUrl.includes('/pdf') ? (
                    <div className="text-center p-4 space-y-2">
                      <FileText className="w-10 h-10 text-orange-400 mx-auto" />
                      <p className="text-xs font-mono font-semibold text-slate-200">PDF Document Attached</p>
                    </div>
                  ) : (
                    <img
                      src={docUrl}
                      alt={docDef.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  )}

                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setPreviewUrl(docUrl);
                        setPreviewTitle(docDef.label);
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-4 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold">No document uploaded yet</p>
                  <label className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border border-slate-700 transition">
                    <Upload className="w-3.5 h-3.5 text-orange-400" /> Upload For Merchant
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleAdminFileUpload(e, docDef)}
                      disabled={uploadingDocKey === docDef.key}
                    />
                  </label>
                </div>
              )}

              {/* Expiry Date Section */}
              {docDef.expiryKey && (
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" /> Expiry Date:
                    </span>
                    <input
                      type="date"
                      value={expiryDate || ''}
                      onChange={(e) => handleUpdateExpiry(docDef, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
                    />
                  </div>
                  {expiryStatus && (
                    <p
                      className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                        expiryStatus.expired
                          ? 'text-rose-400'
                          : expiryStatus.expiringSoon
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" /> {expiryStatus.text}
                    </p>
                  )}
                </div>
              )}

              {/* Reason / Remarks if rejected */}
              {reason && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-xs text-rose-300">
                  <span className="font-bold uppercase font-mono text-[10px] block">Admin Note / Fix Instructions:</span>
                  <p className="mt-0.5">{reason}</p>
                </div>
              )}

              {/* Admin Actions Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleApproveDoc(docDef)}
                  disabled={isSubmitting || !docUrl}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => setActionDoc({ docDef, type: 'reject' })}
                  disabled={isSubmitting || !docUrl}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={() => setActionDoc({ docDef, type: 'reupload' })}
                  disabled={isSubmitting || !docUrl}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Request Re-upload
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification History Log Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-400" /> Document Verification Audit Trail
        </h4>

        {(!restaurant.docVerificationHistory || restaurant.docVerificationHistory.length === 0) ? (
          <p className="text-xs text-slate-500 italic p-4 text-center">No verification action history logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {restaurant.docVerificationHistory
              .slice()
              .reverse()
              .map((log) => (
                <div key={log.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{log.docType}</span>
                      <span
                        className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                          log.action === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.action === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    {log.reason && <p className="text-slate-400 text-[11px] mt-1">Note: {log.reason}</p>}
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Verified By: {log.adminEmail}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Reason Input Modal Overlay */}
      {actionDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              {actionDoc.type === 'reject' ? 'Reject Document' : 'Request Document Re-upload'}
            </h4>
            <p className="text-xs text-slate-400">
              Provide feedback instructions for <span className="text-orange-400 font-bold">{actionDoc.docDef.label}</span>.
            </p>

            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Enter clear rejection reason or specific upload instructions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 outline-none focus:border-orange-500 h-28 resize-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setActionDoc(null);
                  setReasonInput('');
                }}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isSubmitting || !reasonInput.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40"
              >
                Confirm & Notify Merchant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-3xl w-full rounded-3xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-slate-100 text-sm">{previewTitle} Preview</h4>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-2xl p-2 border border-slate-850">
              {previewUrl.toLowerCase().endsWith('.pdf') || previewUrl.includes('/pdf') ? (
                <iframe src={previewUrl} className="w-full h-[60vh] rounded-xl border-none" title="PDF Preview" />
              ) : (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[65vh] object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
